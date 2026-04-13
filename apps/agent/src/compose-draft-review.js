const crypto = require("crypto");
const { prisma } = require("./persistence");
const { OPENAI_STRONG_MODEL, TELEGRAM_BOT_URL, TELEGRAM_BOT_API_TOKEN, TELEGRAM_BOT_TARGET } = require("./env");
const DEFAULT_EMAIL_SIGNATURE = "________\nLydia Leeds\nProject Facilitation Manager";

function makeDraftReviewId() {
  return `drv_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function truncate(value, max) {
  return String(value || "").slice(0, max);
}

function extractLatestInboundEmail(thread) {
  const inbound = (thread.messages || []).find((m) => m.direction === "INBOUND") || null;
  const to = inbound?.fromPerson?.email?.trim() || "";
  return {
    to,
    subject: inbound?.subject?.trim() || thread.subject?.trim() || "Re: Follow-up",
    sourceText: inbound?.textBody?.trim() || inbound?.snippet?.trim() || "",
  };
}

function buildThreadAnalysisContext(thread) {
  const analysis =
    thread.threadAnalysisJson &&
    typeof thread.threadAnalysisJson === "object" &&
    !Array.isArray(thread.threadAnalysisJson)
      ? thread.threadAnalysisJson
      : null;
  const analysisSummary = typeof analysis?.summary === "string" ? analysis.summary.trim() : "";
  const aiSummary = analysisSummary || (thread.summary || "").trim() || "No summary available yet.";
  return {
    aiSummary,
    analysisIntent: typeof analysis?.currentIntent === "string" ? analysis.currentIntent : null,
    analysisStage: typeof analysis?.stage === "string" ? analysis.stage : null,
    analysisNeedsReply:
      typeof analysis?.needsReply === "boolean"
        ? analysis.needsReply
        : analysis?.needsReply != null
          ? String(analysis.needsReply)
          : null,
    analysisWaitingOn:
      typeof analysis?.waitingOn === "string"
        ? analysis.waitingOn
        : typeof analysis?.waitingOnOtherParty === "boolean"
          ? String(analysis.waitingOnOtherParty)
          : null,
    rawAnalysis: analysis,
  };
}

function normalizeComposedBodyWithoutSignature(value) {
  let text = String(value || "").trim();
  text = text.replace(/_{3,}[\s\S]*$/m, "").trim();
  text = text.replace(/\n?(best regards|kind regards|regards|sincerely)[\s\S]*$/i, "").trim();
  return text;
}

function appendSignature(bodyText) {
  const core = String(bodyText || "").trim();
  if (!core) return DEFAULT_EMAIL_SIGNATURE;
  return `${core}\n\n${DEFAULT_EMAIL_SIGNATURE}`;
}

async function composeDraftBodyWithLlm({ to, subject, aiSummary, sourceText, analysis }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return normalizeComposedBodyWithoutSignature(
      `Hi,\n\nThanks for your email.\n\n${aiSummary ? `Summary: ${aiSummary}\n\n` : ""}I will get back to you shortly.`,
    );
  }

  const analysisJson = analysis?.rawAnalysis ? truncate(JSON.stringify(analysis.rawAnalysis), 2200) : "";
  const prompt = [
    "You draft concise professional email replies.",
    "Return ONLY JSON with key: bodyText.",
    "bodyText should be plain text with short paragraphs.",
    "Keep tone polite and professional, but brief.",
    "Do NOT include signature, sender name, title, separator lines, or sign-off block.",
    "Do NOT include Subject line. Generate only the reply text body.",
    "",
    `Thread AI summary: ${truncate(aiSummary || "", 1600)}`,
    `Thread AI intent: ${analysis?.analysisIntent || "-"}`,
    `Thread AI stage: ${analysis?.analysisStage || "-"}`,
    `Thread AI needsReply: ${analysis?.analysisNeedsReply ?? "-"}`,
    `Thread AI waitingOn: ${analysis?.analysisWaitingOn || "-"}`,
    analysisJson ? `Thread AI raw analysis JSON: ${analysisJson}` : "",
    `Original subject: ${truncate(subject || "", 300)}`,
    `Recipient email: ${truncate(to || "", 200)}`,
    `Latest inbound text: ${truncate(sourceText || "", 5000)}`,
  ].join("\n");

  console.info("[llm] draft compose request started", {
    model: OPENAI_STRONG_MODEL,
    promptLength: prompt.length,
  });
  const startedAt = Date.now();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_STRONG_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI draft compose failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI draft compose returned empty content");
  const parsed = JSON.parse(content);
  const out = {
    bodyText: normalizeComposedBodyWithoutSignature(parsed?.bodyText || ""),
  };
  if (!out.bodyText) {
    throw new Error("OpenAI draft compose returned empty bodyText");
  }
  console.info("[llm] draft compose request finished", {
    model: OPENAI_STRONG_MODEL,
    durationMs: Date.now() - startedAt,
    bodyLength: out.bodyText.length,
  });
  return out;
}

async function sendDraftReviewToTelegram(payload) {
  if (!TELEGRAM_BOT_URL) {
    throw new Error("TELEGRAM_BOT_URL is not set");
  }
  if (!TELEGRAM_BOT_API_TOKEN) {
    throw new Error("TELEGRAM_BOT_API_TOKEN is not set");
  }

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
    throw new Error(`Telegram endpoint failed: ${res.status} ${res.statusText} ${truncate(body, 500)}`);
  }
}

async function composeDraftReviewAction({ mailbox, threadId, actionId }) {
  const thread = await prisma.gmailThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      subject: true,
      summary: true,
      threadAnalysisJson: true,
      messages: {
        orderBy: [{ gmailInternalDate: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          direction: true,
          subject: true,
          snippet: true,
          textBody: true,
          fromPerson: { select: { email: true } },
        },
      },
    },
  });
  if (!thread) throw new Error("compose_draft: thread not found");

  const { to, subject, sourceText } = extractLatestInboundEmail(thread);
  if (!to) throw new Error("compose_draft: latest inbound sender email not found");
  const analysis = buildThreadAnalysisContext(thread);
  const replySubject = subject || thread.subject?.trim() || "Re: Follow-up";
  const composed = await composeDraftBodyWithLlm({
    to,
    subject: replySubject,
    aiSummary: analysis.aiSummary,
    sourceText,
    analysis,
  });
  const finalBodyText = appendSignature(composed.bodyText);

  const reviewId = makeDraftReviewId();
  await prisma.draftReview.create({
    data: {
      id: reviewId,
      userId: mailbox.userId || null,
      status: "PENDING",
      subject: replySubject,
      draftBody: finalBodyText,
      fromAliasEmail: mailbox.defaultSendAsEmail || mailbox.email,
    },
  });

  const payload = {
    type: "draft_review_request",
    reviewId,
    target: TELEGRAM_BOT_TARGET || "onpro-logs-channel",
    summary: analysis.aiSummary,
    email: {
      to,
      subject: replySubject,
      bodyText: finalBodyText,
    },
    actions: {
      approve: { callbackData: `draft:approve:${reviewId}` },
      reject: { callbackData: `draft:reject:${reviewId}` },
      edit: { callbackData: `draft:edit:${reviewId}` },
    },
  };
  await sendDraftReviewToTelegram(payload);

  return {
    actionId,
    mode: "draft_review_request",
    reviewId,
    target: payload.target,
    to,
    subject: replySubject,
  };
}

module.exports = {
  composeDraftReviewAction,
};
