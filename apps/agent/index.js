const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { prisma } = require("@gmail-agent/db");

const SKIP_SENDERS = new Set(["no-reply@partnerpage.io"]);
const GMAIL_EXCLUDE_QUERY = "-from:no-reply@partnerpage.io";

function ensureLocalEnvLoaded() {
  if (process.env.NODE_ENV === "production") return;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    // eslint-disable-next-line global-require
    require("dotenv").config({ path: envPath });
    break;
  }
}

function decodeBase64Url(value) {
  if (!value) return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function headerMap(headers = []) {
  const map = new Map();
  for (const h of headers) {
    if (!h?.name) continue;
    map.set(h.name.toLowerCase(), h.value || "");
  }
  return map;
}

function extractEmail(raw = "") {
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function extractEmails(raw = "") {
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

function extractBodies(payload) {
  let textBody = "";
  let htmlBody = "";

  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || "";

    if (mime === "text/plain" && part.body?.data && !textBody) {
      textBody = decodeBase64Url(part.body.data);
    }
    if (mime === "text/html" && part.body?.data && !htmlBody) {
      htmlBody = decodeBase64Url(part.body.data);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child);
    }
  };

  walk(payload);
  return { textBody, htmlBody };
}

async function upsertPeopleFromEmails(emails) {
  const idsByEmail = new Map();
  for (const email of emails) {
    const person = await prisma.person.upsert({
      where: { email },
      update: { lastSeenAt: new Date() },
      create: {
        email,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
      select: { id: true, email: true },
    });
    idsByEmail.set(person.email.toLowerCase(), person.id);
  }
  return idsByEmail;
}

async function listLatestMessageIds(gmail, maxMessages = 500) {
  const ids = [];
  let pageToken = undefined;

  while (ids.length < maxMessages) {
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: Math.min(100, maxMessages - ids.length),
      q: GMAIL_EXCLUDE_QUERY,
      pageToken,
    });
    const refs = res.data.messages || [];
    for (const r of refs) {
      if (r.id) ids.push(r.id);
    }
    if (!res.data.nextPageToken || refs.length === 0) break;
    pageToken = res.data.nextPageToken;
  }

  return ids;
}

async function listChangedMessageIds(gmail, startHistoryId) {
  const ids = new Set();
  let pageToken = undefined;

  while (true) {
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
      maxResults: 500,
    });

    const history = res.data.history || [];
    for (const h of history) {
      for (const add of h.messagesAdded || []) {
        const id = add.message?.id;
        if (id) ids.add(id);
      }
      // Some accounts may still provide messages collection, keep as fallback.
      for (const m of h.messages || []) {
        if (m?.id) ids.add(m.id);
      }
    }

    if (!res.data.nextPageToken) break;
    pageToken = res.data.nextPageToken;
  }

  return [...ids];
}

async function processMessage({ gmail, mailbox, messageId, profileEmail }) {
  const msgRes = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  const msg = msgRes.data;
  if (!msg.id || !msg.threadId) return { skipped: true, created: 0, updated: 0 };

  const headers = headerMap(msg.payload?.headers || []);
  const subject = headers.get("subject") || null;
  const fromRaw = headers.get("from") || "";
  const toRaw = headers.get("to") || "";
  const ccRaw = headers.get("cc") || "";
  const bccRaw = headers.get("bcc") || "";
  const fromEmail = extractEmail(fromRaw);
  if (fromEmail && SKIP_SENDERS.has(fromEmail)) {
    return { skipped: true, created: 0, updated: 0 };
  }

  const toEmails = extractEmails(toRaw);
  const ccEmails = extractEmails(ccRaw);
  const bccEmails = extractEmails(bccRaw);
  const labelIds = msg.labelIds || [];
  const isRead = !labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");
  const hasAttachments = JSON.stringify(msg.payload || {}).includes("attachmentId");

  const allEmails = [
    ...(fromEmail ? [fromEmail] : []),
    ...toEmails,
    ...ccEmails,
    ...bccEmails,
  ];
  const personIds = await upsertPeopleFromEmails(allEmails);
  const fromPersonId = fromEmail ? personIds.get(fromEmail) || null : null;
  const direction = fromEmail === profileEmail ? "OUTBOUND" : "INBOUND";
  const internalMs = msg.internalDate ? Number(msg.internalDate) : null;
  const gmailInternalDate =
    internalMs && Number.isFinite(internalMs) ? new Date(internalMs) : null;

  const thread = await prisma.gmailThread.upsert({
    where: {
      mailboxId_gmailThreadId: {
        mailboxId: mailbox.id,
        gmailThreadId: msg.threadId,
      },
    },
    update: {
      subject,
      snippet: msg.snippet || null,
      lastMessageAt: gmailInternalDate,
    },
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
    where: {
      mailboxId_gmailMessageId: {
        mailboxId: mailbox.id,
        gmailMessageId: msg.id,
      },
    },
    select: { id: true },
  });

  const savedMessage = await prisma.gmailMessage.upsert({
    where: {
      mailboxId_gmailMessageId: {
        mailboxId: mailbox.id,
        gmailMessageId: msg.id,
      },
    },
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
    },
    select: { id: true },
  });

  await prisma.gmailMessageRecipient.deleteMany({
    where: { messageId: savedMessage.id },
  });

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
    await prisma.gmailMessageRecipient.createMany({
      data: recipientRows,
      skipDuplicates: true,
    });
  }

  return { skipped: false, created: existing ? 0 : 1, updated: existing ? 1 : 0 };
}

async function syncMailbox(mailbox, summary) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }
  if (!mailbox.refreshToken && !mailbox.accessToken) {
    throw new Error(`Mailbox ${mailbox.email} has no OAuth tokens`);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({
    refresh_token: mailbox.refreshToken || undefined,
    access_token: mailbox.accessToken || undefined,
  });

  let latestAccessToken = mailbox.accessToken;
  let latestRefreshToken = mailbox.refreshToken;
  let latestExpiry = mailbox.tokenExpiresAt ? mailbox.tokenExpiresAt.getTime() : null;
  oauth2.on("tokens", (tokens) => {
    if (tokens.access_token) latestAccessToken = tokens.access_token;
    if (tokens.refresh_token) latestRefreshToken = tokens.refresh_token;
    if (tokens.expiry_date) latestExpiry = tokens.expiry_date;
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const syncRun = await prisma.gmailSyncRun.create({
    data: {
      mailboxId: mailbox.id,
      status: "RUNNING",
    },
    select: { id: true },
  });

  try {
    const profileRes = await gmail.users.getProfile({ userId: "me" });
    const profileEmail = (profileRes.data.emailAddress || mailbox.email).toLowerCase();
    const currentHistoryId = profileRes.data.historyId || null;

    let mode = "full";
    let messageIds = [];
    if (mailbox.lastHistoryId) {
      try {
        messageIds = await listChangedMessageIds(gmail, mailbox.lastHistoryId);
        mode = "incremental";
      } catch (e) {
        const reason = e?.errors?.[0]?.reason || e?.code || "";
        // If history cursor is stale/invalid, fallback to full resync.
        if (reason === 404 || String(reason).toLowerCase().includes("history")) {
          messageIds = await listLatestMessageIds(gmail, 500);
          mode = "full-fallback";
        } else {
          throw e;
        }
      }
    } else {
      messageIds = await listLatestMessageIds(gmail, 500);
      mode = "full-initial";
    }

    let fetched = 0;
    let created = 0;
    let updated = 0;

    for (const messageId of messageIds) {
      const result = await processMessage({
        gmail,
        mailbox,
        messageId,
        profileEmail,
      });
      if (result.skipped) continue;
      fetched += 1;
      created += result.created;
      updated += result.updated;
    }

    const mailboxUpdate = {
      email: profileEmail,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      lastHistoryId: currentHistoryId || mailbox.lastHistoryId || null,
      accessToken: latestAccessToken || mailbox.accessToken || null,
      refreshToken: latestRefreshToken || mailbox.refreshToken || null,
      tokenExpiresAt:
        latestExpiry && Number.isFinite(latestExpiry) ? new Date(latestExpiry) : mailbox.tokenExpiresAt,
    };

    await prisma.gmailMailbox.update({
      where: { id: mailbox.id },
      data: mailboxUpdate,
    });

    await prisma.gmailSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        fetchedCount: fetched,
        newCount: created,
        updatedCount: updated,
      },
    });

    summary.mailboxes.push({
      mailboxId: mailbox.id,
      email: profileEmail,
      mode,
      changedCandidates: messageIds.length,
      fetched,
      created,
      updated,
      lastHistoryId: mailboxUpdate.lastHistoryId,
    });
  } catch (error) {
    await prisma.gmailSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        errorText: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

exports.handler = async function handler() {
  ensureLocalEnvLoaded();

  const summary = {
    message: "Gmail sync completed",
    mailboxes: [],
    errors: [],
  };

  try {
    const mailboxes = await prisma.gmailMailbox.findMany({
      where: { provider: "GMAIL", status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });

    for (const mailbox of mailboxes) {
      try {
        await syncMailbox(mailbox, summary);
      } catch (error) {
        summary.errors.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      statusCode: summary.errors.length > 0 ? 207 : 200,
      body: JSON.stringify(summary),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Gmail sync failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    };
  }
};
