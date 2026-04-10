const { prisma } = require("./persistence");

function replyNeededToBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (["true", "yes", "1"].includes(s)) return true;
    if (["false", "no", "0"].includes(s)) return false;
  }
  return null;
}

function matchesCondition(threadState, key, expected) {
  if (key === "replyNeeded") {
    const actual = replyNeededToBool(threadState[key]);
    if (Array.isArray(expected)) {
      return expected.some((e) => replyNeededToBool(e) === actual);
    }
    if (typeof expected === "object" && expected !== null) {
      if (Object.prototype.hasOwnProperty.call(expected, "eq")) {
        return actual === replyNeededToBool(expected.eq);
      }
      if (Object.prototype.hasOwnProperty.call(expected, "neq")) {
        return actual !== replyNeededToBool(expected.neq);
      }
      if (Object.prototype.hasOwnProperty.call(expected, "in") && Array.isArray(expected.in)) {
        return expected.in.some((e) => replyNeededToBool(e) === actual);
      }
      if (Object.prototype.hasOwnProperty.call(expected, "notIn") && Array.isArray(expected.notIn)) {
        return !expected.notIn.some((e) => replyNeededToBool(e) === actual);
      }
    }
    const exp = replyNeededToBool(expected);
    if (exp === null) return actual === null;
    return actual === exp;
  }

  const actual = threadState[key];
  if (Array.isArray(expected)) return expected.includes(actual);
  if (typeof expected === "object" && expected !== null) {
    if (Object.prototype.hasOwnProperty.call(expected, "in") && Array.isArray(expected.in)) {
      return expected.in.includes(actual);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "notIn") && Array.isArray(expected.notIn)) {
      return !expected.notIn.includes(actual);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "eq")) return actual === expected.eq;
    if (Object.prototype.hasOwnProperty.call(expected, "neq")) return actual !== expected.neq;
  }
  return actual === expected;
}

function ruleMatchesThread(rule, threadState) {
  const conditions = rule.conditionsJson && typeof rule.conditionsJson === "object" ? rule.conditionsJson : {};
  for (const [key, expected] of Object.entries(conditions)) {
    if (!matchesCondition(threadState, key, expected)) return false;
  }
  return true;
}

async function evaluateRulesForThreads({ mailboxId, threadIds, latestMessageIdByThread }) {
  if (threadIds.length === 0) return { decisions: 0, actions: 0 };

  const rules = await prisma.gmailRule.findMany({
    where: { mailboxId, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  if (rules.length === 0) return { decisions: 0, actions: 0 };

  let decisionsCount = 0;
  let actionsCount = 0;

  for (const threadId of threadIds) {
    const thread = await prisma.gmailThread.findUnique({
      where: { id: threadId },
      include: {
        classifications: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!thread) continue;

    const clsByKind = new Map();
    for (const row of thread.classifications) {
      if (!clsByKind.has(row.kind)) clsByKind.set(row.kind, row.value);
    }

    let replyNeededBool = thread.replyNeeded;
    if (replyNeededBool === null || replyNeededBool === undefined) {
      replyNeededBool = replyNeededToBool(clsByKind.get("REPLY_NEEDED"));
    }

    const threadState = {
      category: clsByKind.get("CATEGORY") || null,
      intent: clsByKind.get("INTENT") || thread.lastIntent || null,
      priority: clsByKind.get("PRIORITY") || thread.priority || null,
      replyNeeded: replyNeededBool,
      messageType: clsByKind.get("MESSAGE_TYPE") || null,
      lastMessageDirection: thread.lastMessageDirection || null,
      hasUnrepliedInbound: !!thread.hasUnrepliedInbound,
      needsReply: !!thread.needsReply,
      actionRequired: !!thread.actionRequired,
      waitingOnOtherParty: !!thread.waitingOnOtherParty,
      status: thread.status || null,
    };

    for (const rule of rules) {
      if (!ruleMatchesThread(rule, threadState)) continue;

      const decision = await prisma.gmailDecision.create({
        data: {
          mailboxId,
          threadId,
          messageId: latestMessageIdByThread.get(threadId) || null,
          ruleId: rule.id,
          decisionType: rule.actionType,
          status: "PENDING",
          reason: `Matched rule '${rule.name}'`,
        },
        select: { id: true },
      });
      decisionsCount += 1;

      await prisma.gmailAction.create({
        data: {
          decisionId: decision.id,
          type: rule.actionType,
          status: "PENDING",
          payloadJson: {
            ruleId: rule.id,
            ruleName: rule.name,
            rulePriority: rule.priority,
            actionConfig: rule.actionConfigJson || null,
            matchedState: threadState,
          },
        },
      });
      actionsCount += 1;

      if (rule.stopProcessing) break;
    }
  }

  return { decisions: decisionsCount, actions: actionsCount };
}

async function buildLatestMessageIdByThread(threadIds) {
  const latestByThread = new Map();
  if (threadIds.length === 0) return latestByThread;

  for (const threadId of threadIds) {
    const msg = await prisma.gmailMessage.findFirst({
      where: { threadId },
      orderBy: [{ gmailInternalDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    if (msg?.id) latestByThread.set(threadId, msg.id);
  }
  return latestByThread;
}

async function evaluateRulesForMailboxThreads(mailboxId, threadIds) {
  const latestMessageIdByThread = await buildLatestMessageIdByThread(threadIds);
  return evaluateRulesForThreads({ mailboxId, threadIds, latestMessageIdByThread });
}

module.exports = {
  evaluateRulesForThreads,
  evaluateRulesForMailboxThreads,
};

