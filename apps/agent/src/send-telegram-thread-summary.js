const { prisma } = require("./persistence");
const { TELEGRAM_BOT_URL, TELEGRAM_BOT_API_TOKEN, TELEGRAM_BOT_TARGET } = require("./env");

function toText(v) {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  return s || "-";
}

function formatSummaryInfo(thread) {
  const bits = [
    `status: ${toText(thread.status)}`,
    `intent: ${toText(thread.lastIntent)}`,
    `priority: ${toText(thread.priority)}`,
    `replyRequired: ${String(!!thread.replyRequired)}`,
    `actionRequired: ${String(!!thread.actionRequired)}`,
    `needsEvaluation: ${String(!!thread.needsEvaluation)}`,
  ];
  return bits.join(" | ");
}

function summaryTextFromThread(thread) {
  const analysis =
    thread.threadAnalysisJson &&
    typeof thread.threadAnalysisJson === "object" &&
    !Array.isArray(thread.threadAnalysisJson)
      ? thread.threadAnalysisJson
      : null;
  const analysisSummary = typeof analysis?.summary === "string" ? analysis.summary.trim() : "";
  return analysisSummary || toText(thread.summary) || toText(thread.snippet);
}

async function sendTelegramThreadSummaryAction({ threadId, actionId }) {
  if (!TELEGRAM_BOT_URL) throw new Error("TELEGRAM_BOT_URL is not set");
  if (!TELEGRAM_BOT_API_TOKEN) throw new Error("TELEGRAM_BOT_API_TOKEN is not set");

  const thread = await prisma.gmailThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      subject: true,
      status: true,
      summary: true,
      snippet: true,
      lastIntent: true,
      priority: true,
      replyRequired: true,
      actionRequired: true,
      needsEvaluation: true,
      lastMessageAt: true,
      lastMessageDirection: true,
      threadAnalysisJson: true,
      messages: {
        orderBy: [{ gmailInternalDate: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { fromPerson: { select: { email: true } } },
      },
    },
  });

  if (!thread) throw new Error("telegram_thread_summary: thread not found");

  const lastEmailFrom = thread.messages[0]?.fromPerson?.email || "-";
  const threadLinkBase = String(process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const linkToThread = `${threadLinkBase}/inbox?threadId=${encodeURIComponent(thread.id)}`;

  const payload = {
    type: "thread_summary_notification",
    target: TELEGRAM_BOT_TARGET || "onpro-logs-channel",
    subject: toText(thread.subject),
    lastMessageTime: thread.lastMessageAt ? thread.lastMessageAt.toISOString() : "-",
    lastEmailFrom: toText(lastEmailFrom),
    direction: toText(thread.lastMessageDirection),
    summaryInfo: formatSummaryInfo(thread),
    summaryText: summaryTextFromThread(thread),
    linkToThread,
  };

  const res = await fetch(TELEGRAM_BOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-token": TELEGRAM_BOT_API_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram summary endpoint failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`);
  }

  return {
    actionId,
    mode: "telegram_thread_summary",
    subject: payload.subject,
    linkToThread,
    target: payload.target,
  };
}

module.exports = {
  sendTelegramThreadSummaryAction,
};
