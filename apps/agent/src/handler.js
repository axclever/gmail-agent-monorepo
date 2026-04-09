const { ensureLocalEnvLoaded } = require("./env");
const { prisma } = require("./persistence");
const { syncMailbox } = require("./sync-mailbox");
const { classifyPendingMessagesForMailbox } = require("./classify-pending");
const { evaluateRulesForMailboxThreads } = require("./decision-engine");

async function handler() {
  ensureLocalEnvLoaded();

  const summary = {
    message: "Gmail sync completed",
    mailboxes: [],
    classification: [],
    decisions: [],
    errors: [],
  };

  try {
    const mailboxes = await prisma.gmailMailbox.findMany({
      where: { provider: "GMAIL", status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });

    for (const mailbox of mailboxes) {
      try {
        const ingest = await syncMailbox(mailbox);
        summary.mailboxes.push(ingest);
      } catch (error) {
        summary.errors.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const mailbox of mailboxes) {
      try {
        const cls = await classifyPendingMessagesForMailbox(mailbox.id);
        summary.classification.push({
          mailboxId: mailbox.id,
          ...cls,
        });

        const decision = await evaluateRulesForMailboxThreads(mailbox.id, cls.touchedThreadIds);
        summary.decisions.push({
          mailboxId: mailbox.id,
          ...decision,
          affectedThreads: cls.touchedThreadIds.length,
        });
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
}

module.exports = {
  handler,
};

