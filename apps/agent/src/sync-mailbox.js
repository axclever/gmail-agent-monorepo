const { google } = require("googleapis");
const { headerMap, extractEmail, extractEmails, extractBodies } = require("./parsers");
const { GMAIL_EXCLUDE_QUERY, GMAIL_POLL_WINDOW_MINUTES, SKIP_SENDERS } = require("./env");
const { prisma, upsertPeopleFromEmails } = require("./persistence");
const { listSendAsEmailsFromGmail, isOutboundFrom } = require("./gmail-send-as");

const MAX_MESSAGES_PER_RUN = 50;
const DEFAULT_BASE_QUERY = "-in:chats";

function buildPollingQuery() {
  const safeMinutes = Number.isFinite(GMAIL_POLL_WINDOW_MINUTES) && GMAIL_POLL_WINDOW_MINUTES > 0
    ? Math.floor(GMAIL_POLL_WINDOW_MINUTES)
    : 30;
  const afterUnix = Math.floor((Date.now() - safeMinutes * 60 * 1000) / 1000);
  const parts = [DEFAULT_BASE_QUERY, `after:${afterUnix}`];
  if (GMAIL_EXCLUDE_QUERY && GMAIL_EXCLUDE_QUERY.trim()) {
    parts.push(GMAIL_EXCLUDE_QUERY.trim());
  }
  return parts.join(" ");
}

async function listLatestMessageIds(gmail, maxMessages = MAX_MESSAGES_PER_RUN, query = buildPollingQuery()) {
  const ids = [];
  let pageToken;
  while (ids.length < maxMessages) {
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: Math.min(100, maxMessages - ids.length),
      q: query,
      pageToken,
    });
    const refs = res.data.messages || [];
    for (const r of refs) if (r.id) ids.push(r.id);
    if (!res.data.nextPageToken || refs.length === 0) break;
    pageToken = res.data.nextPageToken;
  }
  return ids;
}

async function processMessage({ gmail, mailbox, messageId, profileEmail, sendAsEmails }) {
  const msgRes = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = msgRes.data;
  if (!msg.id || !msg.threadId) {
    return { skipped: true, skipReason: "missing_id_or_thread", created: 0, updated: 0 };
  }

  const headers = headerMap(msg.payload?.headers || []);
  const subject = headers.get("subject") || null;
  const fromRaw = headers.get("from") || "";
  const toRaw = headers.get("to") || "";
  const ccRaw = headers.get("cc") || "";
  const bccRaw = headers.get("bcc") || "";
  const fromEmail = extractEmail(fromRaw);
  if (fromEmail && SKIP_SENDERS.has(fromEmail)) {
    return { skipped: true, skipReason: "skip_sender", fromRaw, fromEmail, created: 0, updated: 0 };
  }

  const toEmails = extractEmails(toRaw);
  const ccEmails = extractEmails(ccRaw);
  const bccEmails = extractEmails(bccRaw);
  const labelIds = msg.labelIds || [];
  const isRead = !labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");
  const hasAttachments = JSON.stringify(msg.payload || {}).includes("attachmentId");

  const allEmails = [...(fromEmail ? [fromEmail] : []), ...toEmails, ...ccEmails, ...bccEmails];
  const personIds = await upsertPeopleFromEmails(allEmails);
  const fromPersonId = fromEmail ? personIds.get(fromEmail) || null : null;
  const direction = isOutboundFrom(fromEmail, profileEmail, sendAsEmails) ? "OUTBOUND" : "INBOUND";
  const internalMs = msg.internalDate ? Number(msg.internalDate) : null;
  const gmailInternalDate = internalMs && Number.isFinite(internalMs) ? new Date(internalMs) : null;

  const thread = await prisma.gmailThread.upsert({
    where: { mailboxId_gmailThreadId: { mailboxId: mailbox.id, gmailThreadId: msg.threadId } },
    update: { subject, snippet: msg.snippet || null, lastMessageAt: gmailInternalDate },
    create: {
      mailboxId: mailbox.id,
      gmailThreadId: msg.threadId,
      subject,
      snippet: msg.snippet || null,
      lastMessageAt: gmailInternalDate,
    },
    select: { id: true },
  });

  const { textBody, htmlBody } = extractBodies(msg.payload);
  const existing = await prisma.gmailMessage.findUnique({
    where: { mailboxId_gmailMessageId: { mailboxId: mailbox.id, gmailMessageId: msg.id } },
    select: { id: true },
  });
  if (existing) {
    return { skipped: true, skipReason: "already_exists", created: 0, updated: 0 };
  }
  const savedMessage = await prisma.gmailMessage.upsert({
    where: { mailboxId_gmailMessageId: { mailboxId: mailbox.id, gmailMessageId: msg.id } },
    update: {
      threadId: thread.id,
      gmailInternalDate,
      direction,
      subject,
      snippet: msg.snippet || null,
      textBody: textBody || null,
      htmlBody: htmlBody || null,
      fromPersonId,
      isRead,
      isStarred,
      hasAttachments,
      internetMessageId: headers.get("message-id") || null,
      inReplyTo: headers.get("in-reply-to") || null,
      references: headers.get("references") || null,
      headersJson: msg.payload?.headers || null,
      labelIdsJson: labelIds || null,
      rawPayloadJson: msg.payload || null,
      classificationStatus: "PENDING",
      classifiedAt: null,
    },
    create: {
      mailboxId: mailbox.id,
      threadId: thread.id,
      gmailMessageId: msg.id,
      gmailInternalDate,
      direction,
      subject,
      snippet: msg.snippet || null,
      textBody: textBody || null,
      htmlBody: htmlBody || null,
      fromPersonId,
      isRead,
      isStarred,
      hasAttachments,
      internetMessageId: headers.get("message-id") || null,
      inReplyTo: headers.get("in-reply-to") || null,
      references: headers.get("references") || null,
      headersJson: msg.payload?.headers || null,
      labelIdsJson: labelIds || null,
      rawPayloadJson: msg.payload || null,
      classificationStatus: "PENDING",
      classifiedAt: null,
    },
    select: { id: true },
  });
  await prisma.gmailMessageRecipient.deleteMany({ where: { messageId: savedMessage.id } });

  const recipientRows = [];
  for (const email of toEmails) {
    const personId = personIds.get(email);
    if (personId) recipientRows.push({ messageId: savedMessage.id, personId, type: "TO" });
  }
  for (const email of ccEmails) {
    const personId = personIds.get(email);
    if (personId) recipientRows.push({ messageId: savedMessage.id, personId, type: "CC" });
  }
  for (const email of bccEmails) {
    const personId = personIds.get(email);
    if (personId) recipientRows.push({ messageId: savedMessage.id, personId, type: "BCC" });
  }
  if (recipientRows.length > 0) {
    await prisma.gmailMessageRecipient.createMany({ data: recipientRows, skipDuplicates: true });
  }

  return {
    skipped: false,
    created: existing ? 0 : 1,
    updated: 0,
    threadId: thread.id,
  };
}

async function syncMailbox(mailbox) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  if (!mailbox.refreshToken && !mailbox.accessToken) throw new Error(`Mailbox ${mailbox.email} has no OAuth tokens`);

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({
    refresh_token: mailbox.refreshToken || undefined,
    access_token: mailbox.accessToken || undefined,
  });

  let latestAccessToken = mailbox.accessToken;
  let latestRefreshToken = mailbox.refreshToken;
  oauth2.on("tokens", (tokens) => {
    if (tokens.access_token) latestAccessToken = tokens.access_token;
    if (tokens.refresh_token) latestRefreshToken = tokens.refresh_token;
    // Do not persist tokens.expiry_date — that is access-token TTL (~1h).
    // tokenExpiresAt is refresh / re-auth deadline, set from OAuth callback (refresh_token_expires_in).
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const syncRun = await prisma.gmailSyncRun.create({
    data: { mailboxId: mailbox.id, status: "RUNNING" },
    select: { id: true },
  });

  try {
    const profileRes = await gmail.users.getProfile({ userId: "me" });
    const profileEmail = (profileRes.data.emailAddress || mailbox.email).toLowerCase();
    const currentHistoryId = profileRes.data.historyId || null;

    let sendAsEmails = Array.isArray(mailbox.sendAsEmails) ? [...mailbox.sendAsEmails] : [];
    try {
      sendAsEmails = await listSendAsEmailsFromGmail(gmail);
      await prisma.gmailMailbox.update({
        where: { id: mailbox.id },
        data: { sendAsEmails },
      });
    } catch (e) {
      console.warn(
        `[sync-mailbox] sendAs list skipped for mailbox ${mailbox.id}:`,
        e instanceof Error ? e.message : String(e),
      );
    }

    const pollQuery = buildPollingQuery();
    const mode = "polling-window";
    let messageIds = await listLatestMessageIds(gmail, MAX_MESSAGES_PER_RUN, pollQuery);
    if (messageIds.length > MAX_MESSAGES_PER_RUN) {
      messageIds = messageIds.slice(0, MAX_MESSAGES_PER_RUN);
    }

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let skippedBySender = 0;
    let skippedInvalid = 0;
    let skippedAlreadyExists = 0;
    const touchedThreadIds = new Set();
    for (const messageId of messageIds) {
      const result = await processMessage({ gmail, mailbox, messageId, profileEmail, sendAsEmails });
      if (result.skipped) {
        skipped += 1;
        if (result.skipReason === "skip_sender") skippedBySender += 1;
        if (result.skipReason === "missing_id_or_thread") skippedInvalid += 1;
        if (result.skipReason === "already_exists") skippedAlreadyExists += 1;
        console.info("[sync-mailbox] message skipped", {
          mailboxId: mailbox.id,
          messageId,
          reason: result.skipReason || "unknown",
          fromEmail: result.fromEmail || null,
          fromRaw: result.fromRaw || null,
        });
        continue;
      }
      fetched += 1;
      created += result.created;
      updated += result.updated;
      if (result.threadId) touchedThreadIds.add(result.threadId);
    }

    const mailboxUpdate = {
      email: profileEmail,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      lastHistoryId: currentHistoryId || mailbox.lastHistoryId || null,
      accessToken: latestAccessToken || mailbox.accessToken || null,
      refreshToken: latestRefreshToken || mailbox.refreshToken || null,
      tokenExpiresAt: mailbox.tokenExpiresAt,
    };

    await prisma.gmailMailbox.update({ where: { id: mailbox.id }, data: mailboxUpdate });
    await prisma.gmailSyncRun.update({
      where: { id: syncRun.id },
      data: { status: "SUCCESS", finishedAt: new Date(), fetchedCount: fetched, newCount: created, updatedCount: updated },
    });

    return {
      mailboxId: mailbox.id,
      email: profileEmail,
      mode,
      pollQuery,
      changedCandidates: messageIds.length,
      fetched,
      created,
      updated,
      skipped,
      skippedBySender,
      skippedInvalid,
      skippedAlreadyExists,
      lastHistoryId: mailboxUpdate.lastHistoryId,
      touchedThreadIds: [...touchedThreadIds],
    };
  } catch (error) {
    await prisma.gmailSyncRun.update({
      where: { id: syncRun.id },
      data: { status: "ERROR", finishedAt: new Date(), errorText: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

module.exports = {
  syncMailbox,
};

