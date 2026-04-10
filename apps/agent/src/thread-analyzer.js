const { prisma } = require("./persistence");
const { OPENAI_MINI_MODEL, OPENAI_STRONG_MODEL, CLASSIFIER_CONFIDENCE_THRESHOLD } = require("./env");
const { INTENTS } = require("./classifier");

const MAX_TRANSCRIPT_CHARS = 28_000;
const MAX_MESSAGE_BODY_CHARS = 4_000;

function coerceBoolean(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "1"].includes(s)) return true;
    if (["false", "no", "0"].includes(s)) return false;
  }
  return false;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

function validateIntent(value) {
  const normalized = String(value || "").toLowerCase();
  return INTENTS.includes(normalized) ? normalized : "other";
}

/** Skip expensive thread analysis for noise / automated traffic (MVP). */
function shouldSkipThreadAnalysisForMessageClassification(cls) {
  if (!cls) return true;
  const cat = String(cls.category || "").toLowerCase();
  if (cat === "spam") return true;
  const mt = String(cls.messageType || "").toLowerCase();
  if (mt === "system_notification") return true;
  return false;
}

function normalizeThreadAnalysisPayload(payload, modelUsed) {
  const waitingRaw = String(payload?.waitingOn || "me").toLowerCase();
  const waitingOn = waitingRaw === "them" ? "them" : "me";
  return {
    summary: String(payload?.summary || "").trim().slice(0, 2000),
    currentIntent: validateIntent(payload?.currentIntent ?? payload?.intent),
    stage: String(payload?.stage || "unknown")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 64) || "unknown",
    needsReply: coerceBoolean(payload?.needsReply),
    waitingOn,
    confidence: clamp01(payload?.confidence),
    model: modelUsed,
  };
}

function shouldEscalateThreadAnalysis(normalized, transcriptLength, messageCount) {
  const lowConfidence = (normalized.confidence ?? 0) < CLASSIFIER_CONFIDENCE_THRESHOLD;
  const complex = transcriptLength > 8000 || (messageCount ?? 0) >= 8;
  return lowConfidence || complex;
}

function buildThreadTranscript(thread) {
  let buf = `Subject: ${thread.subject || ""}\n\n`;
  for (const m of thread.messages) {
    const from = m.fromPerson?.email || "?";
    const text = (m.textBody || m.snippet || "").slice(0, MAX_MESSAGE_BODY_CHARS);
    buf += `[${m.direction}] ${from}\n${text}\n\n`;
    if (buf.length > MAX_TRANSCRIPT_CHARS) break;
  }
  return buf.slice(0, MAX_TRANSCRIPT_CHARS);
}

async function analyzeThreadOnce(model, transcript) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const prompt = [
    "You analyze an email thread for a CRM assistant.",
    "Return ONLY strict JSON with keys:",
    "summary, currentIntent, stage, needsReply, waitingOn, confidence.",
    "- summary: 1-4 sentences, what matters now.",
    `- currentIntent: one of ${INTENTS.join("|")}`,
    "- stage: short snake_case conversation state (e.g. waiting_for_reply, negotiation, resolved).",
    "- needsReply: boolean — should the mailbox owner send a substantive reply?",
    '- waitingOn: exactly "me" or "them" — who should act next.',
    "- confidence: number 0-1 how sure you are.",
    "",
    "Transcript:",
    transcript,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI thread analysis failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty thread analysis");
  return JSON.parse(content);
}

/**
 * Rebuild thread-level analysis from full message history. Call after classifying a new inbound.
 * Uses mini model first; escalates to strong model on low confidence or heavy threads.
 */
async function analyzeThreadById(threadId) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { skipped: true, reason: "no_api_key" };

  const thread = await prisma.gmailThread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: [{ gmailInternalDate: "asc" }, { createdAt: "asc" }],
        include: { fromPerson: { select: { email: true } } },
      },
    },
  });

  if (!thread || thread.messages.length === 0) {
    return { skipped: true, reason: "no_messages" };
  }

  const transcript = buildThreadTranscript(thread);
  const transcriptLength = transcript.length;
  const messageCount = thread.messages.length;

  let raw = await analyzeThreadOnce(OPENAI_MINI_MODEL, transcript);
  let normalized = normalizeThreadAnalysisPayload(raw, OPENAI_MINI_MODEL);
  let escalated = false;

  if (
    OPENAI_STRONG_MODEL &&
    OPENAI_STRONG_MODEL !== OPENAI_MINI_MODEL &&
    shouldEscalateThreadAnalysis(normalized, transcriptLength, messageCount)
  ) {
    try {
      raw = await analyzeThreadOnce(OPENAI_STRONG_MODEL, transcript);
      normalized = normalizeThreadAnalysisPayload(raw, OPENAI_STRONG_MODEL);
      escalated = true;
    } catch {
      // keep mini result
    }
  }

  const stored = {
    ...normalized,
    ...(escalated ? { analysisEscalated: true, analysisPrimaryModel: OPENAI_MINI_MODEL } : {}),
  };

  await prisma.gmailThread.update({
    where: { id: threadId },
    data: {
      threadAnalysisJson: stored,
      threadAnalysisAt: new Date(),
    },
  });

  return { ok: true, threadId, model: normalized.model, escalated };
}

module.exports = {
  analyzeThreadById,
  shouldSkipThreadAnalysisForMessageClassification,
};
