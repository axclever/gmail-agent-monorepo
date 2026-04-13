export type ConditionRowState = {
  id: string;
  /** Combines with previous row; ignored for the first row in the list. */
  join: "AND" | "OR";
  field: string;
  operator: string;
  valueStr: string;
};

export type ActionRowState = {
  id: string;
  type: "create_draft" | "notify" | "send_templated_email" | "";
  templateId: string;
  channel: string;
  /** GmailEmailTemplate.templateKey */
  emailTemplateKey: string;
};

export type RuleEmailTemplateOption = {
  templateKey: string;
  name: string;
  subject: string;
  body: string;
};

/** Admin UI: thread-level facts only (matches `conditionContext.thread` in the agent). */
export const THREAD_CONDITION_FIELDS: { value: string; label: string }[] = [
  { value: "thread.lastMessageDirection", label: "Thread · last message direction" },
  { value: "thread.intent", label: "Thread · last message intent" },
];

export const THREAD_LAST_MESSAGE_DIRECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "INBOUND", label: "Inbound" },
  { value: "OUTBOUND", label: "Outbound" },
];

/** Keep in sync with `apps/agent/src/classifier.js` INTENTS. */
export const THREAD_INTENT_OPTIONS: { value: string; label: string }[] = [
  { value: "question", label: "Question" },
  { value: "follow_up", label: "Follow up" },
  { value: "meeting_request", label: "Meeting request" },
  { value: "pricing_request", label: "Pricing request" },
  { value: "complaint", label: "Complaint" },
  { value: "status_update", label: "Status update" },
  { value: "request_for_action", label: "Request for action" },
  { value: "confirmation", label: "Confirmation" },
  { value: "information", label: "Information" },
  { value: "other", label: "Other" },
];

export const CONDITION_OPERATORS: { value: string; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains_any", label: "contains any" },
];

export const TEMPLATE_OPTIONS = ["lead_followup_v1"] as const;
export const CHANNEL_OPTIONS = ["telegram"] as const;

export const BOOLEAN_FIELDS = new Set([
  "classification.replyNeeded",
  "thread.hasUnrepliedInbound",
  "thread.replyRequired",
  "thread.waitingOnOtherParty",
]);

const SUPPORTED_THREAD_CONDITION_FIELDS = new Set([
  "thread.lastMessageDirection",
  "thread.intent",
]);

export function isSupportedThreadConditionField(field: string): boolean {
  return SUPPORTED_THREAD_CONDITION_FIELDS.has(field.trim());
}

function newRowId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `r_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyConditionRow(): ConditionRowState {
  return {
    id: newRowId(),
    join: "AND",
    field: "",
    operator: "equals",
    valueStr: "",
  };
}

export function emptyActionRow(): ActionRowState {
  return {
    id: newRowId(),
    type: "",
    templateId: "lead_followup_v1",
    channel: "telegram",
    emailTemplateKey: "",
  };
}

export function valueToInputString(field: string, value: unknown): string {
  if (BOOLEAN_FIELDS.has(field)) {
    if (value === true) return "true";
    if (value === false) return "false";
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value == null) return "";
  return String(value);
}

export function parseConditionValue(field: string, operator: string, valueStr: string): unknown {
  const v = valueStr.trim();
  if (BOOLEAN_FIELDS.has(field)) {
    if (v === "true") return true;
    if (v === "false") return false;
    return v;
  }
  if (operator === "contains_any") {
    if (v.startsWith("[")) {
      try {
        const p = JSON.parse(v) as unknown;
        return Array.isArray(p) ? p : [p];
      } catch {
        /* fall through */
      }
    }
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : [];
  }
  return v;
}

export function conditionsToJson(rows: ConditionRowState[]): unknown[] {
  const valid = rows.filter((r) => r.field.trim());
  return valid.map((r, i) => {
    const field = r.field.trim();
    const simple = isSupportedThreadConditionField(field);
    return {
      ...(i > 0 ? { join: r.join } : {}),
      field,
      operator: simple ? "equals" : r.operator.trim() || "equals",
      value: simple ? r.valueStr.trim() : parseConditionValue(field, r.operator, r.valueStr),
    };
  });
}

export function conditionsFromJson(json: unknown): ConditionRowState[] {
  if (!Array.isArray(json) || json.length === 0) {
    return [];
  }
  return json.map((item, i) => {
    const o = item as Record<string, unknown>;
    const field = String(o.field ?? "");
    return {
      id: newRowId(),
      join: i === 0 ? "AND" : String(o.join || "AND").toUpperCase() === "OR" ? "OR" : "AND",
      field,
      operator: String(o.operator ?? "equals"),
      valueStr: valueToInputString(field, o.value),
    };
  });
}

export function actionsToJson(rows: ActionRowState[]): unknown[] {
  return rows
    .filter((r) => r.type === "create_draft" || r.type === "notify" || r.type === "send_templated_email")
    .map((r) => {
      if (r.type === "create_draft") {
        return {
          type: "create_draft",
          params: { templateId: r.templateId.trim() || "lead_followup_v1" },
        };
      }
      if (r.type === "send_templated_email") {
        const key = r.emailTemplateKey.trim();
        if (!key) {
          throw new Error("send_templated_email: choose a template key.");
        }
        return {
          type: "send_templated_email",
          params: { templateKey: key, variables: {} },
        };
      }
      return {
        type: "notify",
        params: { channel: r.channel.trim() || "telegram" },
      };
    });
}

export function actionsFromJson(json: unknown): ActionRowState[] {
  if (!Array.isArray(json) || json.length === 0) {
    return [emptyActionRow()];
  }
  const out: ActionRowState[] = [];
  for (const item of json) {
    const o = item as Record<string, unknown>;
    const t = String(o.type ?? "");
    const p = (o.params as Record<string, unknown>) || {};
    if (t === "create_draft") {
      out.push({
        id: newRowId(),
        type: "create_draft",
        templateId: String(p.templateId ?? "lead_followup_v1"),
        channel: "telegram",
        emailTemplateKey: "",
      });
    } else if (t === "notify") {
      out.push({
        id: newRowId(),
        type: "notify",
        templateId: "lead_followup_v1",
        channel: String(p.channel ?? "telegram"),
        emailTemplateKey: "",
      });
    } else if (t === "send_templated_email") {
      out.push({
        id: newRowId(),
        type: "send_templated_email",
        templateId: "lead_followup_v1",
        channel: "telegram",
        emailTemplateKey: String(p.templateKey ?? ""),
      });
    }
  }
  return out.length > 0 ? out : [emptyActionRow()];
}
