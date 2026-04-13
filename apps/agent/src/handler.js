const { ensureLocalEnvLoaded, EXECUTE_PENDING_ACTIONS } = require("./env");
const { prisma, refreshThreadDerivedFields, computeThreadProcessingState } = require("./persistence");
const { syncMailbox } = require("./sync-mailbox");
const { classifyPendingMessagesForMailbox } = require("./classify-pending");
const { evaluateRulesForMailboxThreads } = require("./decision-engine");
const { executePendingActionsForMailbox } = require("./execute-pending-actions");

async function handler() {
  ensureLocalEnvLoaded();
  const runStartedAt = Date.now();

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
    console.info("[agent] run started", {
      executePendingActions: EXECUTE_PENDING_ACTIONS,
      startedAt: new Date(runStartedAt).toISOString(),
    });

    const mailboxes = await prisma.gmailMailbox.findMany({
      where: { provider: "GMAIL", status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });
    console.info("[agent] active mailboxes loaded", { count: mailboxes.length });

    const ingestByMailboxId = new Map();
    for (const mailbox of mailboxes) {
      try {
        const t0 = Date.now();
        console.info("[agent] sync stage started", {
          mailboxId: mailbox.id,
          email: mailbox.email,
        });
        const ingest = await syncMailbox(mailbox);
        ingestByMailboxId.set(mailbox.id, ingest);
        summary.mailboxes.push(ingest);
        console.info("[agent] sync stage finished", {
          mailboxId: mailbox.id,
          email: mailbox.email,
          durationMs: Date.now() - t0,
          mode: ingest.mode,
          changedCandidates: ingest.changedCandidates,
          fetched: ingest.fetched,
          created: ingest.created,
          updated: ingest.updated,
        });
      } catch (error) {
        console.error("[agent] sync stage failed", {
          mailboxId: mailbox.id,
          email: mailbox.email,
          error: error instanceof Error ? error.message : String(error),
        });
        summary.errors.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const mailbox of mailboxes) {
      try {
        console.info("[agent] mailbox pipeline started", {
          mailboxId: mailbox.id,
          email: mailbox.email,
        });
        const ingest = ingestByMailboxId.get(mailbox.id);
        const classifyStartedAt = Date.now();
        console.info("[agent] classification stage started", { mailboxId: mailbox.id });
        const cls = await classifyPendingMessagesForMailbox(mailbox.id);
        summary.classification.push({
          mailboxId: mailbox.id,
          ...cls,
        });
        console.info("[agent] classification stage finished", {
          mailboxId: mailbox.id,
          durationMs: Date.now() - classifyStartedAt,
          pendingCandidates: cls.pendingCandidates,
          classified: cls.classified,
          failed: cls.failed,
          touchedThreads: cls.touchedThreadIds.length,
        });

        const syncTouched = ingest?.touchedThreadIds || [];
        const backlogThreads = await prisma.gmailThread.findMany({
          where: {
            mailboxId: mailbox.id,
            OR: [{ needsEvaluation: true }, { actionRequired: true, hasUnrepliedInbound: true }],
          },
          orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
          take: 200,
          select: { id: true },
        });
        const threadIdsToRefresh = [
          ...new Set([...syncTouched, ...cls.touchedThreadIds, ...backlogThreads.map((t) => t.id)]),
        ];
        console.info("[agent] backlog threads considered", {
          mailboxId: mailbox.id,
          backlogCount: backlogThreads.length,
        });
        console.info("[agent] processing-state stage started", {
          mailboxId: mailbox.id,
          threadIds: threadIdsToRefresh.length,
        });
        await refreshThreadDerivedFields(threadIdsToRefresh);
        const processingState = await computeThreadProcessingState(threadIdsToRefresh);
        summary.processingState.push({
          mailboxId: mailbox.id,
          ...processingState,
        });
        console.info("[agent] processing-state stage finished", {
          mailboxId: mailbox.id,
          processed: processingState.processed,
          needsEvaluation: processingState.needsEvaluation,
        });

        const rulesStartedAt = Date.now();
        console.info("[agent] rules stage started", {
          mailboxId: mailbox.id,
          affectedThreads: threadIdsToRefresh.length,
        });
        const decision = await evaluateRulesForMailboxThreads(mailbox.id, threadIdsToRefresh);
        summary.decisions.push({
          mailboxId: mailbox.id,
          ...decision,
          affectedThreads: threadIdsToRefresh.length,
        });
        console.info("[agent] rules stage finished", {
          mailboxId: mailbox.id,
          durationMs: Date.now() - rulesStartedAt,
          decisions: decision.decisions,
          actionsCreated: decision.actions,
        });

        if (EXECUTE_PENDING_ACTIONS) {
          const actionStartedAt = Date.now();
          console.info("[agent] action execution stage started", {
            mailboxId: mailbox.id,
          });
          const actionRun = await executePendingActionsForMailbox(mailbox);
          summary.actionRuns.push({
            mailboxId: mailbox.id,
            ...actionRun,
          });
          console.info("[agent] action execution stage finished", {
            mailboxId: mailbox.id,
            durationMs: Date.now() - actionStartedAt,
            attempted: actionRun.attempted,
            succeeded: actionRun.succeeded,
            failed: actionRun.failed,
          });
        } else {
          summary.actionRuns.push({
            mailboxId: mailbox.id,
            skipped: true,
            reason:
              "Pending actions are not executed (set EXECUTE_PENDING_ACTIONS=true to enable). Rules still create GmailDecision + GmailAction rows.",
          });
          console.info("[agent] action execution skipped", {
            mailboxId: mailbox.id,
            reason: "EXECUTE_PENDING_ACTIONS=false",
          });
        }
        console.info("[agent] mailbox pipeline finished", {
          mailboxId: mailbox.id,
          email: mailbox.email,
        });
      } catch (error) {
        console.error("[agent] mailbox pipeline failed", {
          mailboxId: mailbox.id,
          email: mailbox.email,
          error: error instanceof Error ? error.message : String(error),
        });
        summary.errors.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.info("[agent] run finished", {
      durationMs: Date.now() - runStartedAt,
      mailboxes: summary.mailboxes.length,
      errors: summary.errors.length,
    });
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

