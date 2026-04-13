/**
 * Evaluates rule conditions[] against a fact context built per thread.
 * Field paths: classification.*, email.*, thread.*, person.*
 * Thread-only facts (recommended): thread.lastMessageDirection, thread.intent.
 * Optional per-row `join`: "AND" | "OR" — combines with the previous result (first row ignores join).
 */

function normStr(v) {
  return String(v ?? "").trim().toLowerCase();
}

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

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]*>/g, " ");
}

function buildEmailHaystack(latestMessage) {
  if (!latestMessage) return "";
  const parts = [
    latestMessage.subject,
    latestMessage.snippet,
    latestMessage.textBody,
    stripHtml(latestMessage.htmlBody || ""),
  ].filter((p) => p && String(p).trim());
  return parts.join("\n").toLowerCase();
}

function buildClassificationFacts(clsByKind, replyNeededBool) {
  const category = clsByKind.get("CATEGORY") || null;
  return {
    label: category,
    category,
    intent: clsByKind.get("INTENT") || null,
    priority: clsByKind.get("PRIORITY") || null,
    replyNeeded: replyNeededBool,
    messageType: clsByKind.get("MESSAGE_TYPE") || null,
  };
}

function valuesEqual(actual, expected) {
  if (actual === expected) return true;
  const aBool = replyNeededToBool(actual);
  const eBool = replyNeededToBool(expected);
  if (aBool !== null && eBool !== null) return aBool === eBool;
  if (typeof actual === "string" || typeof expected === "string") {
    return normStr(actual) === normStr(expected);
  }
  return false;
}

function evaluateOperator({ operator, actual, value }) {
  const op = String(operator || "").toLowerCase();

  if (op === "equals") {
    return valuesEqual(actual, value);
  }

  if (op === "contains_any") {
    const text = typeof actual === "string" ? actual : normStr(actual);
    const needles = Array.isArray(value) ? value : [value];
    return needles.some((n) => text.includes(normStr(n)));
  }

  if (op === "not_equals") {
    return !valuesEqual(actual, value);
  }

  return false;
}

function evaluateOneCondition(raw, context, haystack) {
  if (!raw || typeof raw !== "object") return false;
  const field = String(raw.field || "").trim();
  const operator = String(raw.operator || "equals").trim();
  const value = raw.value;

  let actual;
  if (field.startsWith("classification.")) {
    const sub = field.slice("classification.".length);
    actual = context.classification ? context.classification[sub] : undefined;
  } else if (field.startsWith("email.")) {
    const sub = field.slice("email.".length);
    if (sub === "subject_body_text") {
      actual = haystack;
    } else {
      actual = context.email ? context.email[sub] : undefined;
    }
  } else if (field.startsWith("thread.")) {
    const sub = field.slice("thread.".length);
    actual = context.thread ? context.thread[sub] : undefined;
  } else if (field.startsWith("person.")) {
    const sub = field.slice("person.".length);
    const parts = sub.split(".");
    actual = context.person;
    for (const key of parts) {
      if (actual == null || typeof actual !== "object") {
        actual = undefined;
        break;
      }
      actual = actual[key];
    }
  } else {
    return false;
  }

  return evaluateOperator({
    operator,
    actual,
    value,
  });
}

/**
 * @param {unknown} conditions - JSON array
 * @param {{ classification: object, email: { subject_body_text: string }, thread: object }} context
 */
function ruleConditionsMatch(conditions, context) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true;
  }

  const haystack = context.email?.subject_body_text ?? "";

  let acc = evaluateOneCondition(conditions[0], context, haystack);
  for (let i = 1; i < conditions.length; i += 1) {
    const raw = conditions[i];
    const join = String(raw.join || "AND").toUpperCase();
    const next = evaluateOneCondition(raw, context, haystack);
    if (join === "OR") {
      acc = acc || next;
    } else {
      acc = acc && next;
    }
  }
  return acc;
}

/**
 * Same fact object as `decision-engine` uses for `ruleConditionsMatch`.
 * @param {object} thread - GmailThread row with `classifications[]`
 * @param {object | null | undefined} latestMessage - latest message fields for haystack
 */
function buildConditionContextFromThreadRow(thread, latestMessage) {
  const clsByKind = new Map();
  for (const row of thread.classifications || []) {
    if (!clsByKind.has(row.kind)) clsByKind.set(row.kind, row.value);
  }
  let replyNeededBool = thread.replyRequired;
  if (replyNeededBool === null || replyNeededBool === undefined) {
    replyNeededBool = replyNeededToBool(clsByKind.get("REPLY_NEEDED"));
  }
  const classification = buildClassificationFacts(clsByKind, replyNeededBool);
  const subjectBodyText = buildEmailHaystack(latestMessage);
  const senderCustom =
    latestMessage?.fromPerson?.customFieldsJson &&
    typeof latestMessage.fromPerson.customFieldsJson === "object" &&
    !Array.isArray(latestMessage.fromPerson.customFieldsJson)
      ? latestMessage.fromPerson.customFieldsJson
      : {};
  return {
    classification,
    email: { subject_body_text: subjectBodyText },
    thread: {
      status: thread.status || null,
      hasUnrepliedInbound: !!thread.hasUnrepliedInbound,
      replyRequired: !!thread.replyRequired,
      lastMessageDirection: thread.lastMessageDirection || null,
      intent: clsByKind.get("INTENT") || thread.lastIntent || null,
      waitingOnOtherParty: !!thread.waitingOnOtherParty,
    },
    person: {
      sender: {
        email: latestMessage?.fromPerson?.email || null,
        ...senderCustom,
      },
    },
  };
}

module.exports = {
  buildClassificationFacts,
  buildEmailHaystack,
  buildConditionContextFromThreadRow,
  ruleConditionsMatch,
};
