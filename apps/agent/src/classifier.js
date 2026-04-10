const {
  OPENAI_MINI_MODEL,
  OPENAI_STRONG_MODEL,
  CLASSIFIER_CONFIDENCE_THRESHOLD,
} = require("./env");

const CATEGORIES = [
  "sales",
  "support",
  "operations",
  "billing",
  "internal",
  "personal",
  "spam",
  "newsletter",
  "unknown",
];

const INTENTS = [
  "question",
  "follow_up",
  "meeting_request",
  "pricing_request",
  "complaint",
  "status_update",
  "request_for_action",
  "confirmation",
  "information",
  "other",
];

const MESSAGE_TYPES = [
  "human_message",
  "auto_reply",
  "system_notification",
  "transactional",
  "marketing",
  "bulk_outreach",
  "unknown",
];

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

function stripHtmlForHeuristics(html) {
  if (!html) return "";
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefer plain text; if almost empty, approximate from HTML. */
function primaryEmailBody(textBody, htmlBody) {
  const t = (textBody || "").trim();
  if (t.length >= 20) return t;
  const fromHtml = stripHtmlForHeuristics(htmlBody || "");
  return t ? `${t}\n${fromHtml}` : fromHtml;
}

/** First non-empty line looks like "Hi Name," */
function bodyStartsWithHiNameComma(body) {
  const lines = String(body || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] || "";
  return /^\s*Hi\s+[^,\n]+,/i.test(first);
}

/**
 * Deterministic template / outreach rules (expand here). When a rule matches, sets `templateKey`
 * on the message; overrides model output when applicable.
 *
 * @param {{
 *   subject?: string | null;
 *   fromEmail?: string | null;
 *   ccEmails?: string[] | null;
 *   textBody?: string | null;
 *   htmlBody?: string | null;
 * }} input
 * @returns {string | null} snake_case template key or null
 */
function applyTemplateKeyHeuristics({ subject, fromEmail, ccEmails, textBody, htmlBody }) {
  const subjLower = (subject || "").trim().toLowerCase();
  const from = (fromEmail || "").trim().toLowerCase();

  const hasCc = Array.isArray(ccEmails) && ccEmails.some((e) => e && String(e).trim());
  const body = primaryEmailBody(textBody, htmlBody);
  const bodyLower = body.toLowerCase();

  if (
    from === "lydia.leeds@leadround.io" &&
    hasCc &&
    subjLower.startsWith("introduction to") &&
    bodyStartsWithHiNameComma(body) &&
    bodyLower.includes("please meet") &&
    bodyLower.includes("who should be able to help with")
  ) {
    return "introduction_meet_vendor";
  }

  const outreachSenders = new Set(["lydia.leeds@leadround.io", "lydia.leeds@leadround.org"]);
  if (subjLower.includes("help with") && outreachSenders.has(from)) {
    return "outreach-email";
  }

  return null;
}

function mergeTemplateKeyHeuristics(classification, ctx) {
  const key = applyTemplateKeyHeuristics(ctx);
  if (!key) return classification;
  return { ...classification, templateKey: key };
}

function classifyMessageFieldsRules({ subject, snippet, textBody, htmlBody, fromEmail }) {
  const haystack = `${subject || ""}\n${snippet || ""}\n${textBody || ""}\n${htmlBody || ""}`.toLowerCase();
  const from = (fromEmail || "").toLowerCase();

  let category = "unknown";
  if (from.includes("no-reply") || haystack.includes("unsubscribe") || haystack.includes("newsletter")) {
    category = "newsletter";
  } else if (haystack.includes("viagra") || haystack.includes("crypto giveaway")) {
    category = "spam";
  } else if (
    haystack.includes("invoice") ||
    haystack.includes("payment") ||
    haystack.includes("subscription") ||
    haystack.includes("billing")
  ) {
    category = "billing";
  } else if (
    haystack.includes("shipment") ||
    haystack.includes("delivery") ||
    haystack.includes("tracking") ||
    haystack.includes("order #") ||
    haystack.includes("order number")
  ) {
    category = "operations";
  } else if (haystack.includes("internal") || haystack.includes("all-hands") || haystack.includes("team@")) {
    category = "internal";
  } else if (
    haystack.includes("support") ||
    haystack.includes("help") ||
    haystack.includes("ticket") ||
    haystack.includes("issue")
  ) {
    category = "support";
  } else if (
    haystack.includes("pricing") ||
    haystack.includes("quote") ||
    haystack.includes("demo") ||
    haystack.includes("sales")
  ) {
    category = "sales";
  } else if (from.endsWith("@gmail.com") || from.endsWith("@yahoo.com") || from.endsWith("@outlook.com")) {
    category = "personal";
  }

  let intent = "information";
  if (haystack.includes("?") || haystack.includes("can you") || haystack.includes("could you")) intent = "question";
  if (haystack.includes("follow up") || haystack.includes("following up")) intent = "follow_up";
  if (haystack.includes("meeting") || haystack.includes("calendar") || haystack.includes("schedule")) {
    intent = "meeting_request";
  }
  if (haystack.includes("pricing") || haystack.includes("cost") || haystack.includes("budget")) intent = "pricing_request";
  if (haystack.includes("complaint") || haystack.includes("not happy") || haystack.includes("frustrated")) {
    intent = "complaint";
  }
  if (haystack.includes("status") || haystack.includes("update on") || haystack.includes("progress")) {
    intent = "status_update";
  }
  if (haystack.includes("please confirm") || haystack.includes("confirmed") || haystack.includes("agreed")) {
    intent = "confirmation";
  }
  if (
    haystack.includes("please ") ||
    haystack.includes("action required") ||
    haystack.includes("need you to")
  ) {
    intent = "request_for_action";
  }

  let priority = "low";
  if (haystack.includes("asap") || haystack.includes("urgent") || haystack.includes("immediately")) priority = "high";
  else if (haystack.includes("today") || haystack.includes("soon") || haystack.includes("tomorrow")) priority = "medium";

  const replyNeeded =
    haystack.includes("?") ||
    haystack.includes("please reply") ||
    haystack.includes("let me know") ||
    haystack.includes("can you");

  let messageType = "human_message";
  if (haystack.includes("out of office") || haystack.includes("automatic reply") || haystack.includes("auto-reply")) {
    messageType = "auto_reply";
  } else if (
    haystack.includes("do not reply") ||
    haystack.includes("system notification") ||
    haystack.includes("security alert") ||
    haystack.includes("password reset")
  ) {
    messageType = "system_notification";
  } else if (
    haystack.includes("receipt") ||
    haystack.includes("order confirmation") ||
    haystack.includes("your order")
  ) {
    messageType = "transactional";
  } else if (
    category === "newsletter" ||
    haystack.includes("unsubscribe") ||
    haystack.includes("campaign")
  ) {
    messageType = "marketing";
  } else if (haystack.includes("cold outreach") || haystack.includes("reaching out")) {
    messageType = "bulk_outreach";
  }

  return {
    category,
    intent,
    priority,
    replyNeeded,
    messageType,
    templateKey: null,
    confidence: 0.6,
    model: "rules-v1",
    rawJson: null,
  };
}

function validateEnum(value, options, fallback) {
  if (!value) return fallback;
  const normalized = String(value).toLowerCase();
  return options.includes(normalized) ? normalized : fallback;
}

function normalizeLLMClassification(payload, fallbackModel) {
  const templateRaw = payload?.template_key ?? payload?.templateKey;
  const templateKey =
    templateRaw != null && String(templateRaw).trim() ? String(templateRaw).trim().slice(0, 120) : null;

  return {
    category: validateEnum(payload?.category, CATEGORIES, "unknown"),
    intent: validateEnum(payload?.intent, INTENTS, "other"),
    priority: validateEnum(payload?.priority, ["low", "medium", "high"], "low"),
    replyNeeded: coerceBoolean(payload?.reply_needed ?? payload?.replyNeeded),
    messageType: validateEnum(payload?.message_type ?? payload?.messageType, MESSAGE_TYPES, "unknown"),
    templateKey,
    confidence: Number.isFinite(Number(payload?.confidence)) ? Math.max(0, Math.min(1, Number(payload.confidence))) : 0.5,
    model: payload?.model || fallbackModel,
    rawJson: payload?.raw_json ?? payload?.rawJson ?? null,
  };
}

/** Re-run classification with the strong model when mini is uncertain or the message/thread context is heavy. */
function shouldEscalateToStrongModel({ classification, subject, snippet, textBody, htmlBody, threadMessageCount }) {
  const totalTextLength = `${subject || ""}${snippet || ""}${textBody || ""}${htmlBody || ""}`.length;
  const lowConfidence = (classification?.confidence ?? 0) < CLASSIFIER_CONFIDENCE_THRESHOLD;
  const complexContext = totalTextLength > 8000 || (threadMessageCount ?? 0) >= 8;
  return lowConfidence || complexContext;
}

async function classifyWithOpenAI({ subject, snippet, textBody, htmlBody, fromEmail, toEmails, ccEmails, threadMessageCount }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const templateCtx = { subject, fromEmail, ccEmails, textBody, htmlBody };
  if (!apiKey) {
    return mergeTemplateKeyHeuristics(
      classifyMessageFieldsRules({ subject, snippet, textBody, htmlBody, fromEmail }),
      templateCtx,
    );
  }

  const classifyOnce = async (model) => {
    const prompt = [
      "You are classifying an email for CRM workflow.",
      "Return ONLY strict JSON with keys:",
      "category, intent, priority, reply_needed (boolean), message_type, template_key (string or null), confidence, model, raw_json.",
      `Allowed category: ${CATEGORIES.join("|")}`,
      `Allowed intent: ${INTENTS.join("|")}`,
      "Allowed priority: low|medium|high",
      "reply_needed: true or false only",
      `Allowed message_type: ${MESSAGE_TYPES.join("|")}`,
      "template_key: short snake_case id for a reply template, or null if none",
      "",
      `from: ${fromEmail || "-"}`,
      `to: ${(toEmails || []).join(", ") || "-"}`,
      `cc: ${(ccEmails || []).join(", ") || "-"}`,
      `subject: ${subject || ""}`,
      `snippet: ${snippet || ""}`,
      `textBody: ${textBody ? textBody.slice(0, 6000) : ""}`,
      `htmlBody: ${htmlBody ? htmlBody.slice(0, 2000) : ""}`,
    ].join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI classification failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty classification content");
    return normalizeLLMClassification(JSON.parse(content), model);
  };

  try {
    let cls = await classifyOnce(OPENAI_MINI_MODEL);

    if (
      OPENAI_STRONG_MODEL &&
      OPENAI_STRONG_MODEL !== OPENAI_MINI_MODEL &&
      shouldEscalateToStrongModel({
        classification: cls,
        subject,
        snippet,
        textBody,
        htmlBody,
        threadMessageCount,
      })
    ) {
      try {
        const strongCls = await classifyOnce(OPENAI_STRONG_MODEL);
        const prevRaw =
          strongCls.rawJson != null && typeof strongCls.rawJson === "object" && !Array.isArray(strongCls.rawJson)
            ? strongCls.rawJson
            : {};
        cls = {
          ...strongCls,
          rawJson: {
            ...prevRaw,
            classificationEscalated: true,
            classificationPrimaryModel: OPENAI_MINI_MODEL,
            classificationFinalModel: OPENAI_STRONG_MODEL,
          },
        };
      } catch (strongErr) {
        const prevRaw =
          cls.rawJson != null && typeof cls.rawJson === "object" && !Array.isArray(cls.rawJson) ? cls.rawJson : {};
        cls = {
          ...cls,
          rawJson: {
            ...prevRaw,
            classificationEscalationFailed: true,
            classificationStrongModel: OPENAI_STRONG_MODEL,
            classificationStrongError:
              strongErr instanceof Error ? strongErr.message : String(strongErr),
          },
        };
      }
    }

    return mergeTemplateKeyHeuristics(cls, templateCtx);
  } catch (err) {
    const fallback = classifyMessageFieldsRules({ subject, snippet, textBody, htmlBody, fromEmail });
    return mergeTemplateKeyHeuristics(
      { ...fallback, rawJson: { error: err instanceof Error ? err.message : String(err), fallback: true } },
      templateCtx,
    );
  }
}

module.exports = {
  classifyWithOpenAI,
  INTENTS,
};
