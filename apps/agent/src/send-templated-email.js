const { renderEmailTemplate } = require("@gmail-agent/email-templates");
const { prisma } = require("./persistence");

function toBase64UrlUtf8(text) {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function buildRfc822PlainText({ from, to, subject, body }) {
  const safeSubject = subject.replace(/\r?\n/g, " ").trim();
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
  ];
  return lines.join("\r\n");
}

/**
 * Latest inbound message on the thread: recipient address + Person fields for Mustache.
 * Rule `variables` are merged on top (override).
 */
async function resolveLastInboundPersonContext(threadId) {
  const msg = await prisma.gmailMessage.findFirst({
    where: { threadId, direction: "INBOUND" },
    orderBy: [{ gmailInternalDate: "desc" }, { createdAt: "desc" }],
    include: {
      fromPerson: { select: { email: true, name: true, firstSeenAt: true, lastSeenAt: true } },
    },
  });
  const p = msg?.fromPerson;
  const replyToEmail = p?.email?.trim() || null;
  const personView = {};
  if (p) {
    personView.email = p.email || "";
    personView.name = p.name ?? "";
    personView.firstSeenAt = p.firstSeenAt instanceof Date ? p.firstSeenAt.toISOString() : "";
    personView.lastSeenAt = p.lastSeenAt instanceof Date ? p.lastSeenAt.toISOString() : "";
  }
  return { replyToEmail, personView };
}

/**
 * @param {object} opts
 * @param {import("googleapis").gmail_v1.Gmail} opts.gmail
 * @param {{ id: string; email: string; sendAsEmails?: string[]; defaultSendAsEmail?: string | null }} opts.mailbox
 * @param {{ templateKey: string; to?: string; variables?: Record<string, unknown>; createDraft?: boolean; fromAliasEmail?: string }} opts.params
 * @param {string} opts.threadId - internal thread id
 */
async function sendTemplatedEmail({ gmail, mailbox, params, threadId }) {
  const templateKey = String(params.templateKey || "").trim();
  if (!templateKey) throw new Error("send_templated_email: missing templateKey");

  const template = await prisma.gmailEmailTemplate.findUnique({
    where: {
      mailboxId_templateKey: { mailboxId: mailbox.id, templateKey },
    },
  });
  if (!template) {
    throw new Error(`send_templated_email: template not found: ${templateKey}`);
  }

  const { replyToEmail, personView } = await resolveLastInboundPersonContext(threadId);

  let to = String(params.to || "").trim();
  if (!to) {
    to = replyToEmail || "";
  }
  if (!to) {
    throw new Error("send_templated_email: no recipient (ensure thread has an inbound sender, or pass params.to)");
  }

  const ruleVars =
    params.variables && typeof params.variables === "object" && !Array.isArray(params.variables)
      ? params.variables
      : {};
  const variables = { ...personView, ...ruleVars };

  const { subject, body } = renderEmailTemplate(template.subject, template.body, variables);

  const thread = await prisma.gmailThread.findUnique({
    where: { id: threadId },
    select: { gmailThreadId: true },
  });

  const requestedAlias = String(params.fromAliasEmail || "").trim().toLowerCase();
  const defaultAlias = String(mailbox.defaultSendAsEmail || "").trim().toLowerCase();
  const allowedSenders = new Set(
    [mailbox.email, ...(Array.isArray(mailbox.sendAsEmails) ? mailbox.sendAsEmails : [])]
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const fromEmail =
    requestedAlias && allowedSenders.has(requestedAlias)
      ? requestedAlias
      : defaultAlias && allowedSenders.has(defaultAlias)
        ? defaultAlias
        : mailbox.email;

  const rfc822 = buildRfc822PlainText({
    from: fromEmail,
    to,
    subject,
    body,
  });

  const raw = toBase64UrlUtf8(rfc822);
  // Safety lock: real sends are disabled for now.
  const createDraft = true;
  const gmailThreadId = thread?.gmailThreadId || null;

  if (createDraft) {
    const draftReq = { message: { raw } };
    if (gmailThreadId) {
      draftReq.message.threadId = gmailThreadId;
    }
    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: draftReq,
    });
    return {
      mode: "draft",
      draftId: draft.data.id || null,
      gmailMessageId: draft.data.message?.id || null,
      threadId: draft.data.message?.threadId || gmailThreadId,
      to,
      fromAliasEmail: fromEmail,
      templateKey,
      subject,
    };
  }

  // Unreachable while safety lock is enabled.
  throw new Error("Direct email sending is disabled. Only draft creation is allowed.");
}

module.exports = {
  sendTemplatedEmail,
  buildRfc822PlainText,
};
