const { ensureLocalEnvLoaded } = require("./env");
const { prisma, refreshThreadDerivedFields, computeThreadProcessingState } = require("./persistence");
const { syncMailbox } = require("./sync-mailbox");
const { classifyPendingMessagesForMailbox } = require("./classify-pending");
const { evaluateRulesForMailboxThreads } = require("./decision-engine");
const { executePendingActionsForMailbox } = require("./execute-pending-actions");

async function handler() {
  ensureLocalEnvLoaded();

  const summary = {
    message: "Gmail sync completed",
    mailboxes: [],
    classification: [],
    processingState: [],
    decisions: [],
    actionRuns: [],
    errors: [],
  };

  try {
    const mailboxes = await prisma.gmailMailbox.findMany({
      where: { provider: "GMAIL", status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });

    const ingestByMailboxId = new Map();
    for (const mailbox of mailboxes) {
      try {
        const ingest = await syncMailbox(mailbox);
        ingestByMailboxId.set(mailbox.id, ingest);
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
        const ingest = ingestByMailboxId.get(mailbox.id);
        const cls = await classifyPendingMessagesForMailbox(mailbox.id);
        summary.classification.push({
          mailboxId: mailbox.id,
          ...cls,
        });

        const syncTouched = ingest?.touchedThreadIds || [];
        const threadIdsToRefresh = [...new Set([...syncTouched, ...cls.touchedThreadIds])];
        await refreshThreadDerivedFields(threadIdsToRefresh);
        const processingState = await computeThreadProcessingState(threadIdsToRefresh);
        summary.processingState.push({
          mailboxId: mailbox.id,
          ...processingState,
        });

        const decision = await evaluateRulesForMailboxThreads(mailbox.id, threadIdsToRefresh);
        summary.decisions.push({
          mailboxId: mailbox.id,
          ...decision,
          affectedThreads: threadIdsToRefresh.length,
        });

        const actionRun = await executePendingActionsForMailbox(mailbox);
        summary.actionRuns.push({
          mailboxId: mailbox.id,
          ...actionRun,
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

