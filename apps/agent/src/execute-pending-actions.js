/**
 * Runs pending Gmail actions for one mailbox (e.g. send_templated_email).
 * The main handler calls this only when `EXECUTE_PENDING_ACTIONS=true`; otherwise actions stay PENDING.
 *
 * @param {import("@prisma/client").GmailMailbox} mailbox
 */

const { prisma } = require("./persistence");
const { createGmailForMailbox } = require("./gmail-auth");
const { sendTemplatedEmail } = require("./send-templated-email");
const { composeDraftReviewAction } = require("./compose-draft-review");
const { sendTelegramThreadSummaryAction } = require("./send-telegram-thread-summary");

async function executePendingActionsForMailbox(mailbox) {
  const pending = await prisma.gmailAction.findMany({
    where: {
      status: "PENDING",
      type: { in: ["send_templated_email", "draft_review_request", "telegram_thread_summary"] },
      decision: { mailboxId: mailbox.id },
    },
    take: 25,
    orderBy: { createdAt: "asc" },
    include: {
      decision: { select: { id: true, threadId: true } },
    },
  });

  if (pending.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  const { gmail, latestAccessToken, latestRefreshToken } = createGmailForMailbox(mailbox);

  let succeeded = 0;
  let failed = 0;

  for (const action of pending) {
    const payload = action.payloadJson && typeof action.payloadJson === "object" ? action.payloadJson : {};
    const params =
      payload.params && typeof payload.params === "object" && !Array.isArray(payload.params)
        ? payload.params
        : {};

    try {
      await prisma.gmailAction.update({
        where: { id: action.id },
        data: { status: "RUNNING" },
      });

      if (!action.decision?.threadId) {
        throw new Error(`${action.type}: decision has no threadId`);
      }

      const mailboxContext = {
        id: mailbox.id,
        userId: mailbox.userId,
        email: mailbox.email,
        sendAsEmails: mailbox.sendAsEmails || [],
        defaultSendAsEmail: mailbox.defaultSendAsEmail || null,
      };

      let result;
      if (action.type === "send_templated_email") {
        result = await sendTemplatedEmail({
          gmail,
          mailbox: mailboxContext,
          params,
          threadId: action.decision.threadId,
        });
      } else if (action.type === "draft_review_request") {
        result = await composeDraftReviewAction({
          mailbox: mailboxContext,
          threadId: action.decision.threadId,
          actionId: action.id,
        });
      } else if (action.type === "telegram_thread_summary") {
        result = await sendTelegramThreadSummaryAction({
          threadId: action.decision.threadId,
          actionId: action.id,
        });
      } else {
        throw new Error(`Unsupported action type: ${action.type}`);
      }

      await prisma.gmailAction.update({
        where: { id: action.id },
        data: {
          status: "SUCCESS",
          executedAt: new Date(),
          resultJson: result,
          errorText: null,
        },
      });
      succeeded += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[agent] action execution failed", {
        mailboxId: mailbox.id,
        actionId: action.id,
        actionType: action.type,
        decisionId: action.decision?.id || null,
        threadId: action.decision?.threadId || null,
        error: msg,
      });
      await prisma.gmailAction.update({
        where: { id: action.id },
        data: {
          status: "ERROR",
          executedAt: new Date(),
          errorText: msg.slice(0, 2000),
        },
      });
      failed += 1;
    }
  }

  if (latestAccessToken || latestRefreshToken) {
    await prisma.gmailMailbox.update({
      where: { id: mailbox.id },
      data: {
        accessToken: latestAccessToken ?? mailbox.accessToken,
        refreshToken: latestRefreshToken ?? mailbox.refreshToken,
      },
    });
  }

  return { attempted: pending.length, succeeded, failed };
}

module.exports = {
  executePendingActionsForMailbox,
};
