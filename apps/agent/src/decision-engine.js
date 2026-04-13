const { prisma } = require("./persistence");
const { buildConditionContextFromThreadRow, ruleConditionsMatch } = require("@gmail-agent/rule-conditions");

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

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [];
}

function ruleMatchesThread(rule, threadState, conditionContext) {
  const conditions = parseJsonArray(rule.conditions);
  return ruleConditionsMatch(conditions, conditionContext);
}

async function evaluateRulesForThreads({ mailboxId, threadIds, latestMessageIdByThread }) {
  if (threadIds.length === 0) return { decisions: 0, actions: 0 };

  const rules = await prisma.gmailRule.findMany({
    where: { mailboxId, enabled: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  console.info("[decision-engine] enabled rules loaded", {
    mailboxId,
    ruleCount: rules.length,
    threadIds: threadIds.length,
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
    if (thread.needsEvaluation !== true) continue;

    const latestMessage = await prisma.gmailMessage.findFirst({
      where: { threadId },
      orderBy: [{ gmailInternalDate: "desc" }, { createdAt: "desc" }],
      select: {
        subject: true,
        snippet: true,
        textBody: true,
        htmlBody: true,
        fromPerson: {
          select: {
            email: true,
            customFieldsJson: true,
          },
        },
      },
    });

    const clsByKind = new Map();
    for (const row of thread.classifications) {
      if (!clsByKind.has(row.kind)) clsByKind.set(row.kind, row.value);
    }

    let replyNeededBool = thread.replyRequired;
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
      replyRequired: !!thread.replyRequired,
      actionRequired: !!thread.actionRequired,
      needsEvaluation: !!thread.needsEvaluation,
      waitingOnOtherParty: !!thread.waitingOnOtherParty,
      status: thread.status || null,
    };

    const conditionContext = buildConditionContextFromThreadRow(thread, latestMessage);

    for (const rule of rules) {
      if (!ruleMatchesThread(rule, threadState, conditionContext)) continue;

      const actions = parseJsonArray(rule.actions).filter((a) => a && typeof a === "object");
      if (actions.length === 0) continue;

      const primaryType = String(actions[0].type || "").trim() || "unknown";

      const decision = await prisma.gmailDecision.create({
        data: {
          mailboxId,
          threadId,
          messageId: latestMessageIdByThread.get(threadId) || null,
          ruleId: rule.id,
          decisionType: primaryType,
          status: "PENDING",
          reason: `Matched rule '${rule.name}' (${rule.ruleKey})`,
        },
        select: { id: true },
      });
      decisionsCount += 1;
      console.info("[decision-engine] rule matched", {
        mailboxId,
        threadId,
        ruleId: rule.id,
        ruleKey: rule.ruleKey,
        actionsPlanned: actions.length,
      });

      for (const action of actions) {
        const type = String(action.type || "").trim() || primaryType;
        const params = action.params && typeof action.params === "object" && !Array.isArray(action.params) ? action.params : {};

        const integrationIdRaw =
          type === "run_integration" && params.integrationId != null
            ? String(params.integrationId).trim()
            : "";
        const integrationId = integrationIdRaw || undefined;

        await prisma.gmailAction.create({
          data: {
            decisionId: decision.id,
            type,
            status: "PENDING",
            ...(integrationId ? { integrationId } : {}),
            payloadJson: {
              ruleId: rule.id,
              ruleKey: rule.ruleKey,
              ruleName: rule.name,
              rulePriority: rule.priority,
              ruleVersion: rule.version,
              params,
              matchedState: threadState,
            },
          },
        });
        actionsCount += 1;
      }

      if (rule.stopProcessing) break;
    }
  }

  console.info("[decision-engine] evaluation finished", {
    mailboxId,
    decisions: decisionsCount,
    actions: actionsCount,
  });
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
