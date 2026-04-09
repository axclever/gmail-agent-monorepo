const { classifyWithOpenAI } = require("./classifier");
const { prisma, saveMessageClassifications, refreshThreadDerivedFields } = require("./persistence");

function splitRecipients(recipients) {
  const toEmails = [];
  const ccEmails = [];
  for (const row of recipients) {
    const email = row.person?.email || null;
    if (!email) continue;
    if (row.type === "TO") toEmails.push(email);
    if (row.type === "CC") ccEmails.push(email);
  }
  return { toEmails, ccEmails };
}

async function classifyPendingMessagesForMailbox(mailboxId, limit = 500) {
  const messages = await prisma.gmailMessage.findMany({
    where: {
      mailboxId,
      OR: [{ classificationStatus: null }, { classificationStatus: "PENDING" }, { classificationStatus: "ERROR" }],
    },
    orderBy: [{ gmailInternalDate: "asc" }, { createdAt: "asc" }],
    take: limit,
    include: {
      fromPerson: { select: { email: true } },
      recipients: { include: { person: { select: { email: true } } } },
    },
  });

  const touchedThreadIds = new Set();
  let classified = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const threadMessageCount = await prisma.gmailMessage.count({
        where: { threadId: message.threadId },
      });
      const { toEmails, ccEmails } = splitRecipients(message.recipients);

      const cls = await classifyWithOpenAI({
        subject: message.subject || "",
        snippet: message.snippet || "",
        textBody: message.textBody || "",
        htmlBody: message.htmlBody || "",
        fromEmail: message.fromPerson?.email || "",
        toEmails,
        ccEmails,
        threadMessageCount,
      });

      await saveMessageClassifications(message.id, cls);
      touchedThreadIds.add(message.threadId);
      classified += 1;
    } catch (error) {
      await prisma.gmailMessage.update({
        where: { id: message.id },
        data: {
          classificationStatus: "ERROR",
          classifiedAt: new Date(),
        },
      });
      failed += 1;
    }
  }

  const threadIds = [...touchedThreadIds];
  await refreshThreadDerivedFields(threadIds);

  return {
    mailboxId,
    pendingCandidates: messages.length,
    classified,
    failed,
    touchedThreadIds: threadIds,
  };
}

module.exports = {
  classifyPendingMessagesForMailbox,
};

