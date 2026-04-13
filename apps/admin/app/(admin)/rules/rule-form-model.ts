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
  type: "send_templated_email" | "run_integration" | "create_draft" | "notify" | "";
  /** GmailEmailTemplate.templateKey */
  emailTemplateKey: string;
  /** For send_templated_email: when true, create Gmail draft instead of immediate send. */
  createDraft: boolean;
  /** For send_templated_email: explicit sender alias (Gmail Send-as). */
  fromAliasEmail: string;
  /** Integration.id for run_integration */
  integrationId: string;
  /** Legacy create_draft only — kept for round-trip when rule still uses old JSON. */
  templateId: string;
  /** Legacy notify only — kept for round-trip when rule still uses old JSON. */
  channel: string;
};

export type RuleIntegrationOption = {
  id: string;
  name: string;
  type: string;
};

export type RuleSendAsOption = {
  email: string;
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
  { value: "person.senderAttr", label: "Person · sender attribute" },
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

export const BOOLEAN_FIELDS = new Set([
  "classification.replyNeeded",
  "thread.hasUnrepliedInbound",
  "thread.replyRequired",
  "thread.waitingOnOtherParty",
]);

const SUPPORTED_THREAD_CONDITION_FIELDS = new Set([
  "thread.lastMessageDirection",
  "thread.intent",
  "person.senderAttr",
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
    emailTemplateKey: "",
    createDraft: true,
    fromAliasEmail: "",
    integrationId: "",
    templateId: "lead_followup_v1",
    channel: "telegram",
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
    const fieldRaw = r.field.trim();
    const senderAttr = fieldRaw === "person.senderAttr" ? r.valueStr.trim() : "";
    const eqIdx = senderAttr.indexOf("=");
    const senderKey = eqIdx > 0 ? senderAttr.slice(0, eqIdx).trim() : "";
    const senderValue = eqIdx > 0 ? senderAttr.slice(eqIdx + 1).trim() : senderAttr;
    const field = fieldRaw === "person.senderAttr" && senderKey ? `person.sender.${senderKey}` : fieldRaw;
    const simple = isSupportedThreadConditionField(fieldRaw);
    return {
      ...(i > 0 ? { join: r.join } : {}),
      field,
      operator: simple ? "equals" : r.operator.trim() || "equals",
      value:
        fieldRaw === "person.senderAttr"
          ? senderValue
          : simple
            ? r.valueStr.trim()
            : parseConditionValue(field, r.operator, r.valueStr),
    };
  });
}

export function conditionsFromJson(json: unknown): ConditionRowState[] {
  if (!Array.isArray(json) || json.length === 0) {
    return [];
  }
  return json.map((item, i) => {
    const o = item as Record<string, unknown>;
    const rawField = String(o.field ?? "");
    const senderPrefix = "person.sender.";
    const isSenderField = rawField.startsWith(senderPrefix);
    const field = isSenderField ? "person.senderAttr" : rawField;
    const senderKey = isSenderField ? rawField.slice(senderPrefix.length).trim() : "";
    const senderValueStr = valueToInputString(rawField, o.value);
    return {
      id: newRowId(),
      join: i === 0 ? "AND" : String(o.join || "AND").toUpperCase() === "OR" ? "OR" : "AND",
      field,
      operator: isSenderField ? "equals" : String(o.operator ?? "equals"),
      valueStr: isSenderField ? `${senderKey}=${senderValueStr}` : valueToInputString(field, o.value),
    };
  });
}

type PersistedActionRow = ActionRowState & {
  type: "create_draft" | "notify" | "send_templated_email" | "run_integration";
};

export function actionsToJson(rows: ActionRowState[]): unknown[] {
  return rows
    .filter(
      (r): r is PersistedActionRow =>
        r.type === "create_draft" ||
        r.type === "notify" ||
        r.type === "send_templated_email" ||
        r.type === "run_integration",
    )
    .map((r) => {
      switch (r.type) {
        case "create_draft":
          return {
            type: "create_draft",
            params: { templateId: r.templateId.trim() || "lead_followup_v1" },
          };
        case "notify":
          return {
            type: "notify",
            params: { channel: r.channel.trim() || "telegram" },
          };
        case "send_templated_email": {
          const key = r.emailTemplateKey.trim();
          if (!key) {
            throw new Error("send_templated_email: choose a template key.");
          }
          return {
            type: "send_templated_email",
            params: {
              templateKey: key,
              variables: {},
              createDraft: r.createDraft !== false,
              ...(r.fromAliasEmail.trim()
                ? { fromAliasEmail: r.fromAliasEmail.trim().toLowerCase() }
                : {}),
            },
          };
        }
        case "run_integration": {
          const id = r.integrationId.trim();
          if (!id) {
            throw new Error("run_integration: choose an integration.");
          }
          return {
            type: "run_integration",
            params: { integrationId: id },
          };
        }
        default:
          throw new Error(`Unexpected action type: ${String((r as { type?: string }).type)}`);
      }
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
        emailTemplateKey: "",
        createDraft: true,
        fromAliasEmail: "",
        integrationId: "",
        templateId: String(p.templateId ?? "lead_followup_v1"),
        channel: "telegram",
      });
    } else if (t === "notify") {
      out.push({
        id: newRowId(),
        type: "notify",
        emailTemplateKey: "",
        createDraft: true,
        fromAliasEmail: "",
        integrationId: "",
        templateId: "lead_followup_v1",
        channel: String(p.channel ?? "telegram"),
      });
    } else if (t === "send_templated_email") {
      out.push({
        id: newRowId(),
        type: "send_templated_email",
        emailTemplateKey: String(p.templateKey ?? ""),
        createDraft: p.createDraft === false ? false : true,
        fromAliasEmail: String(p.fromAliasEmail ?? ""),
        integrationId: "",
        templateId: "lead_followup_v1",
        channel: "telegram",
      });
    } else if (t === "run_integration") {
      out.push({
        id: newRowId(),
        type: "run_integration",
        emailTemplateKey: "",
        createDraft: true,
        fromAliasEmail: "",
        integrationId: String(p.integrationId ?? ""),
        templateId: "lead_followup_v1",
        channel: "telegram",
      });
    }
  }
  return out.length > 0 ? out : [emptyActionRow()];
}
