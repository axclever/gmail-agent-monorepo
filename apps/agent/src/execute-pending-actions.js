const { prisma } = require("./persistence");
const { createGmailForMailbox } = require("./gmail-auth");
const { sendTemplatedEmail } = require("./send-templated-email");

/**
 * Runs pending Gmail actions for one mailbox (e.g. send_templated_email).
 * @param {import("@prisma/client").GmailMailbox} mailbox
 */
async function executePendingActionsForMailbox(mailbox) {
  const pending = await prisma.gmailAction.findMany({
    where: {
      status: "PENDING",
      type: "send_templated_email",
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
    const params = payload.params && typeof payload.params === "object" && !Array.isArray(payload.params) ? payload.params : {};

    try {
      await prisma.gmailAction.update({
        where: { id: action.id },
        data: { status: "RUNNING" },
      });

      if (!action.decision?.threadId) {
        throw new Error("send_templated_email: decision has no threadId");
      }

      const result = await sendTemplatedEmail({
        gmail,
        mailbox: { id: mailbox.id, email: mailbox.email },
        params,
        threadId: action.decision.threadId,
      });

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
