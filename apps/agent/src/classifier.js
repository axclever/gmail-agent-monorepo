const {
  OPENAI_MINI_MODEL,
  OPENAI_STRONG_MODEL,
  CLASSIFIER_CONFIDENCE_THRESHOLD,
} = require("./env");

function classifyMessageFieldsRules({ subject, snippet, textBody, htmlBody, fromEmail }) {
  const haystack = `${subject || ""}\n${snippet || ""}\n${textBody || ""}\n${htmlBody || ""}`.toLowerCase();
  const from = (fromEmail || "").toLowerCase();

  let category = "unknown";
  if (from.includes("no-reply") || haystack.includes("unsubscribe") || haystack.includes("newsletter")) {
    category = "newsletter";
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
  } else if (haystack.includes("viagra") || haystack.includes("crypto giveaway")) {
    category = "spam";
  }

  let intent = "info";
  if (haystack.includes("?") || haystack.includes("can you") || haystack.includes("could you")) intent = "question";
  if (haystack.includes("follow up") || haystack.includes("following up")) intent = "follow_up";
  if (haystack.includes("meeting") || haystack.includes("calendar") || haystack.includes("schedule")) {
    intent = "meeting_request";
  }
  if (haystack.includes("pricing") || haystack.includes("cost") || haystack.includes("budget")) intent = "pricing";
  if (haystack.includes("complaint") || haystack.includes("not happy") || haystack.includes("frustrated")) {
    intent = "complaint";
  }

  let priority = "low";
  if (haystack.includes("asap") || haystack.includes("urgent") || haystack.includes("immediately")) priority = "high";
  else if (haystack.includes("today") || haystack.includes("soon") || haystack.includes("tomorrow")) priority = "medium";

  const replyNeeded =
    haystack.includes("?") ||
    haystack.includes("please reply") ||
    haystack.includes("let me know") ||
    haystack.includes("can you");

  let messageType = "conversation";
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
    category === "newsletter" ||
    haystack.includes("unsubscribe") ||
    haystack.includes("campaign")
  ) {
    messageType = "marketing";
  }

  return {
    category,
    intent,
    priority,
    replyNeeded: replyNeeded ? "yes" : "no",
    messageType,
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
  return {
    category: validateEnum(payload?.category, ["sales", "support", "personal", "spam", "newsletter", "unknown"], "unknown"),
    intent: validateEnum(payload?.intent, ["question", "follow_up", "meeting_request", "pricing", "complaint", "info"], "info"),
    priority: validateEnum(payload?.priority, ["low", "medium", "high"], "low"),
    replyNeeded: validateEnum(payload?.reply_needed, ["yes", "no"], "no"),
    messageType: validateEnum(
      payload?.message_type,
      ["conversation", "auto_reply", "system_notification", "marketing", "unknown"],
      "unknown",
    ),
    confidence: Number.isFinite(Number(payload?.confidence)) ? Math.max(0, Math.min(1, Number(payload.confidence))) : 0.5,
    model: payload?.model || fallbackModel,
    rawJson: payload?.raw_json || null,
  };
}

function shouldEscalateClassification({ classification, subject, snippet, textBody, htmlBody, threadMessageCount }) {
  const totalTextLength = `${subject || ""}${snippet || ""}${textBody || ""}${htmlBody || ""}`.length;
  const lowConfidence = (classification?.confidence || 0) < CLASSIFIER_CONFIDENCE_THRESHOLD;
  const unknownOrWeak =
    classification?.category === "unknown" ||
    classification?.intent === "info" ||
    (classification?.replyNeeded === "yes" && classification?.priority !== "high");
  const longContext = totalTextLength > 8000 || threadMessageCount >= 8;
  return lowConfidence || unknownOrWeak || longContext;
}

async function classifyWithOpenAI({ subject, snippet, textBody, htmlBody, fromEmail, toEmails, ccEmails, threadMessageCount }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return classifyMessageFieldsRules({ subject, snippet, textBody, htmlBody, fromEmail });

  const classifyOnce = async (model) => {
    const prompt = [
      "You are classifying an email for CRM workflow.",
      "Return ONLY strict JSON with keys:",
      "category, intent, priority, reply_needed, message_type, confidence, model, raw_json.",
      "Allowed category: sales|support|personal|spam|newsletter|unknown",
      "Allowed intent: question|follow_up|meeting_request|pricing|complaint|info",
      "Allowed priority: low|medium|high",
      "Allowed reply_needed: yes|no",
      "Allowed message_type: conversation|auto_reply|system_notification|marketing|unknown",
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
    // Escalation is intentionally disabled for cost control.
    return cls;
  } catch (err) {
    const fallback = classifyMessageFieldsRules({ subject, snippet, textBody, htmlBody, fromEmail });
    return { ...fallback, rawJson: { error: err instanceof Error ? err.message : String(err), fallback: true } };
  }
}

module.exports = {
  classifyWithOpenAI,
};

