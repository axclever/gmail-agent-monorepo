const { prisma } = require("@gmail-agent/db");

async function upsertPeopleFromEmails(emails) {
  const idsByEmail = new Map();
  for (const email of emails) {
    const person = await prisma.person.upsert({
      where: { email },
      update: { lastSeenAt: new Date() },
      create: { email, firstSeenAt: new Date(), lastSeenAt: new Date() },
      select: { id: true, email: true },
    });
    idsByEmail.set(person.email.toLowerCase(), person.id);
  }
  return idsByEmail;
}

async function saveMessageClassifications(messageId, cls) {
  const replyNeededStr = cls.replyNeeded === true ? "true" : "false";
  const nextByKind = {
    CATEGORY: cls.category,
    INTENT: cls.intent,
    PRIORITY: cls.priority,
    REPLY_NEEDED: replyNeededStr,
    MESSAGE_TYPE: cls.messageType,
  };
  const latestRows = await prisma.gmailMessageClassification.findMany({
    where: { messageId },
    orderBy: { createdAt: "desc" },
  });
  const latestByKind = new Map();
  for (const row of latestRows) if (!latestByKind.has(row.kind)) latestByKind.set(row.kind, row);

  for (const [kind, value] of Object.entries(nextByKind)) {
    const latest = latestByKind.get(kind);
    if (latest && latest.value === value) continue;
    await prisma.gmailMessageClassification.create({
      data: {
        messageId,
        kind,
        value,
        confidence: cls.confidence,
        model: cls.model,
        rawJson: cls.rawJson || { classifier: cls.model, derivedAt: new Date().toISOString() },
      },
    });
  }
  await prisma.gmailMessage.update({
    where: { id: messageId },
    data: {
      classificationStatus: "DONE",
      classifiedAt: new Date(),
      templateKey: cls.templateKey?.trim() ? cls.templateKey.trim().slice(0, 120) : null,
    },
  });
}

async function refreshThreadDerivedFields(threadIds) {
  if (threadIds.length === 0) return;
  for (const threadId of threadIds) {
    const thread = await prisma.gmailThread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          orderBy: { gmailInternalDate: "desc" },
          include: { classifications: { orderBy: { createdAt: "desc" } } },
        },
      },
    });
    if (!thread) continue;
    const byKind = new Map();
    for (const msg of thread.messages) for (const c of msg.classifications) if (!byKind.has(c.kind)) byKind.set(c.kind, c);

    const messagesByTime = [...thread.messages].sort((a, b) => {
      const aTs = a.gmailInternalDate ? new Date(a.gmailInternalDate).getTime() : new Date(a.createdAt).getTime();
      const bTs = b.gmailInternalDate ? new Date(b.gmailInternalDate).getTime() : new Date(b.createdAt).getTime();
      return bTs - aTs;
    });
    const lastMessage = messagesByTime[0] || null;
    const lastMessageDirection = lastMessage?.direction || null;
    const lastInboundAt =
      messagesByTime.find((m) => m.direction === "INBOUND")?.gmailInternalDate ||
      messagesByTime.find((m) => m.direction === "INBOUND")?.createdAt ||
      null;
    const lastOutboundAt =
      messagesByTime.find((m) => m.direction === "OUTBOUND")?.gmailInternalDate ||
      messagesByTime.find((m) => m.direction === "OUTBOUND")?.createdAt ||
      null;

    const lastIntent = byKind.get("INTENT")?.value || null;
    const priority = byKind.get("PRIORITY")?.value || null;
    const category = byKind.get("CATEGORY")?.value || null;
    const messageType = byKind.get("MESSAGE_TYPE")?.value || null;

    const hasUnrepliedInbound =
      !!lastInboundAt && (!lastOutboundAt || new Date(lastInboundAt).getTime() > new Date(lastOutboundAt).getTime());
    const needsReply = hasUnrepliedInbound;
    const waitingOnOtherParty = lastMessageDirection === "OUTBOUND" && !hasUnrepliedInbound;
    const status = needsReply
      ? "NEEDS_REPLY"
      : waitingOnOtherParty
        ? "WAITING_ON_OTHER_PARTY"
        : "IDLE";
    const summaryParts = [];
    if (category) summaryParts.push(`category: ${category}`);
    if (lastIntent) summaryParts.push(`intent: ${lastIntent}`);
    if (priority) summaryParts.push(`priority: ${priority}`);
    if (messageType) summaryParts.push(`type: ${messageType}`);
    const summary = summaryParts.length ? summaryParts.join(" | ") : thread.snippet || null;

    await prisma.gmailThread.update({
      where: { id: thread.id },
      data: {
        summary,
        lastSummarizedAt: new Date(),
        lastIntent,
        priority,
        replyRequired: null,
        actionRequired: null,
        needsEvaluation: false,
        waitingOnOtherParty,
        status,
        lastMessageDirection,
        lastInboundAt,
        lastOutboundAt,
        hasUnrepliedInbound,
        messageCount: thread.messages.length,
      },
    });

    const nextThreadByKind = {
      CATEGORY: category,
      INTENT: lastIntent,
      PRIORITY: priority,
      MESSAGE_TYPE: messageType,
    };
    const latestThreadCls = await prisma.gmailThreadClassification.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
    });
    const latestThreadByKind = new Map();
    for (const row of latestThreadCls) if (!latestThreadByKind.has(row.kind)) latestThreadByKind.set(row.kind, row);

    for (const [kind, value] of Object.entries(nextThreadByKind)) {
      if (value === null || value === undefined || value === "") continue;
      const latest = latestThreadByKind.get(kind);
      if (latest && latest.value === value) continue;
      await prisma.gmailThreadClassification.create({
        data: {
          threadId: thread.id,
          kind,
          value,
          confidence: 0.6,
          model: "rules-v1",
          rawJson: { source: "message_classifications" },
        },
      });
    }
  }
}

async function computeThreadProcessingState(threadIds) {
  if (threadIds.length === 0) return { processed: 0, needsEvaluation: 0 };

  const activeActionStatuses = ["PENDING", "RUNNING", "RETRYING"];
  const terminalStatuses = new Set(["CLOSED", "ARCHIVED", "DONE", "RESOLVED"]);
  let processed = 0;
  let needsEvaluationCount = 0;

  for (const threadId of threadIds) {
    const thread = await prisma.gmailThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        status: true,
        lastIntent: true,
        priority: true,
        lastMessageDirection: true,
        hasUnrepliedInbound: true,
        lastInboundAt: true,
        threadAnalysisJson: true,
      },
    });
    if (!thread) continue;

    const statusNormalized = String(thread.status || "").toUpperCase();
    const isTerminal = terminalStatuses.has(statusNormalized);
    const replyRequired =
      thread.lastMessageDirection === "INBOUND" &&
      thread.hasUnrepliedInbound === true &&
      !isTerminal;

    // MVP rule: actionRequired follows replyRequired.
    const actionRequired = replyRequired;

    const latestDecision = await prisma.gmailDecision.findFirst({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastDecisionAt = latestDecision?.createdAt || null;

    const activeAction = await prisma.gmailAction.findFirst({
      where: {
        status: { in: activeActionStatuses },
        decision: { threadId: thread.id },
      },
      select: { id: true },
    });
    const hasActiveAction = !!activeAction;

    const decisionIsStale =
      !!thread.lastInboundAt && (!lastDecisionAt || new Date(lastDecisionAt).getTime() < new Date(thread.lastInboundAt).getTime());
    const needsEvaluation = actionRequired === true && decisionIsStale && !hasActiveAction;

    await prisma.gmailThread.update({
      where: { id: thread.id },
      data: {
        replyRequired,
        actionRequired,
        needsEvaluation,
        lastEvaluatedAt: new Date(),
        lastDecisionAt,
      },
    });
    processed += 1;
    if (needsEvaluation) needsEvaluationCount += 1;
  }

  return { processed, needsEvaluation: needsEvaluationCount };
}

module.exports = {
  prisma,
  upsertPeopleFromEmails,
  saveMessageClassifications,
  refreshThreadDerivedFields,
  computeThreadProcessingState,
};

