"use client";

import React, { type Dispatch, type SetStateAction } from "react";
import { useEffect, useMemo } from "react";
import { Box, Button, Checkbox, Flex, IconButton, Select, Separator, Text, TextField } from "@radix-ui/themes";
import { X } from "lucide-react";
import { ConditionMatchesPreview } from "./condition-matches-preview";
import {
  BOOLEAN_FIELDS,
  CONDITION_OPERATORS,
  type ActionRowState,
  type ConditionRowState,
  type RuleEmailTemplateOption,
  type RuleIntegrationOption,
  type RuleSendAsOption,
  emptyActionRow,
  emptyConditionRow,
  isSupportedThreadConditionField,
  THREAD_CONDITION_FIELDS,
  THREAD_INTENT_OPTIONS,
  THREAD_LAST_MESSAGE_DIRECTION_OPTIONS,
} from "./rule-form-model";

const EMPTY_VALUE = "__empty__";

function conditionFieldSelectItems(row: ConditionRowState): { value: string; label: string }[] {
  const items = [...THREAD_CONDITION_FIELDS];
  const f = row.field.trim();
  const known = new Set(THREAD_CONDITION_FIELDS.map((x) => x.value));
  if (f && !known.has(f) && !isSupportedThreadConditionField(f)) {
    items.push({ value: row.field, label: `Legacy: ${row.field}` });
  }
  return items;
}

function SendEmailActionFields({
  row,
  emailTemplates,
  sendAsOptions,
  defaultFromAlias,
  disabled,
  updateAction,
}: {
  row: ActionRowState;
  emailTemplates: RuleEmailTemplateOption[];
  sendAsOptions: RuleSendAsOption[];
  defaultFromAlias: string;
  disabled: boolean;
  updateAction: (id: string, patch: Partial<ActionRowState>) => void;
}) {
  const tpl = useMemo(
    () => emailTemplates.find((t) => t.templateKey === row.emailTemplateKey.trim()),
    [emailTemplates, row.emailTemplateKey],
  );

  return (
    <Flex direction="column" gap="2" style={{ flex: "1 1 320px", minWidth: 220 }}>
      <Flex align="center" gap="2" wrap="wrap">
        <Text size="2" color="gray" style={{ flexShrink: 0 }}>
          Template
        </Text>
        <Box style={{ flex: "1 1 200px", minWidth: 160 }}>
          <Select.Root
            value={row.emailTemplateKey.trim() ? row.emailTemplateKey : EMPTY_VALUE}
            onValueChange={(v) =>
              updateAction(row.id, { emailTemplateKey: v === EMPTY_VALUE ? "" : v })
            }
            disabled={disabled || emailTemplates.length === 0}
          >
            <Select.Trigger variant="surface" placeholder="Template" style={{ width: "100%", minHeight: 36 }} />
            <Select.Content position="popper">
              <Select.Item value={EMPTY_VALUE}>Template…</Select.Item>
              {emailTemplates.map((t) => (
                <Select.Item key={t.templateKey} value={t.templateKey}>
                  {t.name} ({t.templateKey})
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Box>
      </Flex>

      <Flex align="center" gap="2" wrap="wrap">
        <Text size="2" color="gray" style={{ flexShrink: 0 }}>
          From alias
        </Text>
        <Box style={{ flex: "1 1 200px", minWidth: 160 }}>
          <Select.Root
            value={row.fromAliasEmail.trim() || defaultFromAlias || EMPTY_VALUE}
            onValueChange={(v) => updateAction(row.id, { fromAliasEmail: v === EMPTY_VALUE ? "" : v })}
            disabled={disabled || sendAsOptions.length === 0}
          >
            <Select.Trigger variant="surface" placeholder="From alias" style={{ width: "100%", minHeight: 36 }} />
            <Select.Content position="popper">
              <Select.Item value={EMPTY_VALUE}>Primary mailbox address</Select.Item>
              {sendAsOptions.map((s) => (
                <Select.Item key={s.email} value={s.email}>
                  {s.email}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Box>
      </Flex>

      {emailTemplates.length === 0 ? (
        <Text size="2" color="gray">
          Add templates under Email templates in the sidebar. The message is sent to the last inbound sender on the
          thread.
        </Text>
      ) : null}

      {tpl ? (
        <Box style={{ width: "100%" }}>
          <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
            Preview
          </Text>
          <Text size="1" color="gray" style={{ display: "block", marginBottom: 8 }}>
            Stored subject and body (placeholders unchanged).
          </Text>
          <Flex
            direction="column"
            gap="2"
            p="3"
            style={{
              borderRadius: "var(--radius-3)",
              border: "1px solid var(--gray-6)",
              background: "var(--gray-a2)",
              fontFamily: "var(--code-font-family, ui-monospace, monospace)",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <Box>
              <Text size="1" weight="bold" style={{ display: "block", marginBottom: 4 }}>
                Subject
              </Text>
              {tpl.subject}
            </Box>
            <Separator size="4" />
            <Box>
              <Text size="1" weight="bold" style={{ display: "block", marginBottom: 4 }}>
                Body
              </Text>
              {tpl.body}
            </Box>
          </Flex>
        </Box>
      ) : emailTemplates.length > 0 ? (
        <Text size="2" color="gray">
          Select a template to see preview.
        </Text>
      ) : null}
    </Flex>
  );
}

function ComposeDraftActionFields() {
  return (
    <Text size="2" color="gray" style={{ flex: "1 1 320px", minWidth: 220 }}>
      Creates a draft review request from thread context (summary + latest inbound message), generates a reply with
      LLM, stores it in draft reviews, and sends it to the Telegram endpoint for approve/reject/edit flow.
    </Text>
  );
}

function RunIntegrationActionFields({
  row,
  integrations,
  disabled,
  updateAction,
}: {
  row: ActionRowState;
  integrations: RuleIntegrationOption[];
  disabled: boolean;
  updateAction: (id: string, patch: Partial<ActionRowState>) => void;
}) {
  const knownIds = new Set(integrations.map((i) => i.id));
  const orphanId = row.integrationId.trim();
  const showOrphan = orphanId && !knownIds.has(orphanId);

  return (
    <Flex direction="column" gap="2" style={{ flex: "1 1 320px", minWidth: 220 }}>
      <Flex align="center" gap="2" wrap="wrap">
        <Text size="2" color="gray" style={{ flexShrink: 0 }}>
          Integration
        </Text>
        <Box style={{ flex: "1 1 200px", minWidth: 160 }}>
          <Select.Root
            value={row.integrationId.trim() || EMPTY_VALUE}
            onValueChange={(v) =>
              updateAction(row.id, { integrationId: v === EMPTY_VALUE ? "" : v })
            }
            disabled={disabled || integrations.length === 0}
          >
            <Select.Trigger variant="surface" placeholder="Integration" style={{ width: "100%", minHeight: 36 }} />
            <Select.Content position="popper">
              <Select.Item value={EMPTY_VALUE}>Integration…</Select.Item>
              {integrations.map((i) => (
                <Select.Item key={i.id} value={i.id}>
                  {i.name} ({i.type})
                </Select.Item>
              ))}
              {showOrphan ? (
                <Select.Item value={orphanId}>Missing: {orphanId.slice(0, 12)}…</Select.Item>
              ) : null}
            </Select.Content>
          </Select.Root>
        </Box>
      </Flex>

      {integrations.length === 0 ? (
        <Text size="2" color="gray">
          Add an integration under Integrations in the sidebar. When the rule matches, a pending action is created for
          the worker to run it (execution is gated by agent settings).
        </Text>
      ) : (
        <Text size="2" color="gray">
          Triggers a run for the selected integration when the rule matches.
        </Text>
      )}
    </Flex>
  );
}

type Props = {
  name: string;
  setName: (v: string) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  conditionRows: ConditionRowState[];
  setConditionRows: Dispatch<SetStateAction<ConditionRowState[]>>;
  actionRows: ActionRowState[];
  setActionRows: Dispatch<SetStateAction<ActionRowState[]>>;
  emailTemplates: RuleEmailTemplateOption[];
  integrations: RuleIntegrationOption[];
  sendAsOptions: RuleSendAsOption[];
  defaultSendAsEmail: string | null;
  formError: string | null;
  disabled: boolean;
  mailboxConnected: boolean;
  submitLabel: string;
  footer?: React.ReactNode;
};

export function RuleFormFields({
  name,
  setName,
  enabled,
  setEnabled,
  conditionRows,
  setConditionRows,
  actionRows,
  setActionRows,
  emailTemplates,
  integrations,
  sendAsOptions,
  defaultSendAsEmail,
  formError,
  disabled,
  mailboxConnected,
  submitLabel,
  footer,
}: Props) {
  const hasConditions = conditionRows.length > 0;
  const hasActions = actionRows.length > 0;
  const defaultFromAlias = useMemo(() => {
    const preferred = String(defaultSendAsEmail || "").trim().toLowerCase();
    if (preferred) return preferred;
    return sendAsOptions[0]?.email || "";
  }, [defaultSendAsEmail, sendAsOptions]);

  useEffect(() => {
    if (!defaultFromAlias) return;
    setActionRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.type !== "send_templated_email" || r.fromAliasEmail.trim()) return r;
        changed = true;
        return { ...r, fromAliasEmail: defaultFromAlias };
      });
      return changed ? next : prev;
    });
  }, [defaultFromAlias, setActionRows]);

  function updateCondition(id: string, patch: Partial<ConditionRowState>) {
    setConditionRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeCondition(id: string) {
    setConditionRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateAction(id: string, patch: Partial<ActionRowState>) {
    setActionRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeAction(id: string) {
    setActionRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  return (
    <Flex direction="column" gap="4" style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}>
      {formError ? (
        <Text size="2" color="red">
          {formError}
        </Text>
      ) : null}

      <Box style={{ width: "100%" }}>
        <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
          Name
        </Text>
        <Flex gap="4" align="center" wrap="wrap" style={{ width: "100%" }}>
          <Box style={{ flex: "1 1 220px", minWidth: 0 }}>
            <TextField.Root
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Follow up when intent is pricing"
              disabled={disabled}
              required
            />
          </Box>
          <Text
            as="label"
            size="2"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              cursor: disabled ? "default" : "pointer",
              userSelect: "none",
            }}
          >
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v === true)}
              disabled={disabled}
            />
            Active
          </Text>
        </Flex>
      </Box>

      <Separator size="4" />

      <Flex direction="column" gap="3" style={{ width: "100%", minWidth: 0, overflowX: "hidden" }}>
        <Text size="3" weight="bold">
          Conditions
        </Text>

        {conditionRows.length > 0
          ? conditionRows.map((row, index) => {
            const simple = isSupportedThreadConditionField(row.field);
            const legacy = row.field.trim() && !simple;
            const intentKnown = new Set(THREAD_INTENT_OPTIONS.map((o) => o.value));
            const intentExtra =
              row.field === "thread.intent" && row.valueStr.trim() && !intentKnown.has(row.valueStr.trim())
                ? [{ value: row.valueStr.trim(), label: `Other: ${row.valueStr.trim()}` }]
                : [];
            const dirKnown = new Set(THREAD_LAST_MESSAGE_DIRECTION_OPTIONS.map((o) => o.value));
            const dirExtra =
              row.field === "thread.lastMessageDirection" &&
              row.valueStr.trim() &&
              !dirKnown.has(row.valueStr.trim())
                ? [{ value: row.valueStr.trim(), label: `Other: ${row.valueStr.trim()}` }]
                : [];

            return (
              <Flex key={row.id} direction="column" gap="2" style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}>
                {index > 0 ? (
                <Flex justify="start" align="center" py="1">
                  <Select.Root
                    value={row.join}
                    onValueChange={(v) => updateCondition(row.id, { join: v === "OR" ? "OR" : "AND" })}
                    disabled={disabled}
                  >
                    <Select.Trigger variant="surface" style={{ minWidth: 100, minHeight: 32 }} />
                      <Select.Content position="popper">
                        <Select.Item value="AND">AND</Select.Item>
                        <Select.Item value="OR">OR</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Flex>
                ) : null}

                <Flex
                  gap="2"
                  align="start"
                  wrap="wrap"
                  style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
                >
                  <Box style={{ flex: "1 1 200px", minWidth: 0, maxWidth: "100%" }}>
                    <Select.Root
                      value={row.field || EMPTY_VALUE}
                      onValueChange={(v) => {
                        const newField = v === EMPTY_VALUE ? "" : v;
                        const patch: Partial<ConditionRowState> = {
                          field: newField,
                          operator: "equals",
                        };
                        if (newField === "thread.lastMessageDirection") {
                          patch.valueStr = "INBOUND";
                        } else if (newField === "thread.intent") {
                          patch.valueStr = "question";
                        } else if (newField === "person.senderAttr") {
                          patch.valueStr = "entity_type=lead";
                        } else if (BOOLEAN_FIELDS.has(newField)) {
                          patch.valueStr = "true";
                        } else if (!newField) {
                          patch.valueStr = "";
                        }
                        updateCondition(row.id, patch);
                      }}
                      disabled={disabled}
                    >
                      <Select.Trigger variant="surface" placeholder="Field" style={{ width: "100%", minHeight: 36, maxWidth: "100%" }} />
                      <Select.Content position="popper">
                        <Select.Item value={EMPTY_VALUE}>Field…</Select.Item>
                        {conditionFieldSelectItems(row).map((f) => (
                          <Select.Item key={f.value} value={f.value}>
                            {f.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Box>

                  {legacy ? (
                    <Box style={{ flex: "0 1 140px", minWidth: 0, maxWidth: "100%" }}>
                      <Select.Root
                        value={row.operator || "equals"}
                        onValueChange={(v) => updateCondition(row.id, { operator: v })}
                        disabled={disabled}
                      >
                        <Select.Trigger variant="surface" style={{ width: "100%", minHeight: 36, maxWidth: "100%" }} />
                        <Select.Content position="popper">
                          {CONDITION_OPERATORS.map((op) => (
                            <Select.Item key={op.value} value={op.value}>
                              {op.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </Box>
                  ) : null}

                  <Box style={{ flex: "2 1 200px", minWidth: 0, maxWidth: "100%" }}>
                    {row.field === "thread.lastMessageDirection" ? (
                      <Select.Root
                        value={
                          row.valueStr.trim() && (dirKnown.has(row.valueStr.trim()) || dirExtra.length)
                            ? row.valueStr.trim()
                            : THREAD_LAST_MESSAGE_DIRECTION_OPTIONS[0].value
                        }
                        onValueChange={(v) => updateCondition(row.id, { valueStr: v })}
                        disabled={disabled}
                      >
                        <Select.Trigger variant="surface" style={{ width: "100%", minHeight: 36, maxWidth: "100%" }} />
                        <Select.Content position="popper">
                          {THREAD_LAST_MESSAGE_DIRECTION_OPTIONS.map((o) => (
                            <Select.Item key={o.value} value={o.value}>
                              {o.label}
                            </Select.Item>
                          ))}
                          {dirExtra.map((o) => (
                            <Select.Item key={o.value} value={o.value}>
                              {o.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    ) : row.field === "thread.intent" ? (
                      <Select.Root
                        value={
                          row.valueStr.trim() && (intentKnown.has(row.valueStr.trim()) || intentExtra.length)
                            ? row.valueStr.trim()
                            : THREAD_INTENT_OPTIONS[0].value
                        }
                        onValueChange={(v) => updateCondition(row.id, { valueStr: v })}
                        disabled={disabled}
                      >
                        <Select.Trigger variant="surface" style={{ width: "100%", minHeight: 36, maxWidth: "100%" }} />
                        <Select.Content position="popper">
                          {THREAD_INTENT_OPTIONS.map((o) => (
                            <Select.Item key={o.value} value={o.value}>
                              {o.label}
                            </Select.Item>
                          ))}
                          {intentExtra.map((o) => (
                            <Select.Item key={o.value} value={o.value}>
                              {o.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    ) : BOOLEAN_FIELDS.has(row.field) ? (
                      <Select.Root
                        value={row.valueStr || "true"}
                        onValueChange={(v) => updateCondition(row.id, { valueStr: v })}
                        disabled={disabled}
                      >
                        <Select.Trigger variant="surface" style={{ width: "100%", minHeight: 36, maxWidth: "100%" }} />
                        <Select.Content position="popper">
                          <Select.Item value="true">true</Select.Item>
                          <Select.Item value="false">false</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    ) : (
                      <TextField.Root
                        value={row.valueStr}
                        onChange={(e) => updateCondition(row.id, { valueStr: e.target.value })}
                        placeholder={
                          row.field === "person.senderAttr"
                            ? "e.g. entity_type=expert"
                            : row.operator === "contains_any"
                            ? 'e.g. pricing, interested or ["a","b"]'
                            : "Value"
                        }
                        disabled={disabled}
                        style={{ minHeight: 36, width: "100%", maxWidth: "100%" }}
                      />
                    )}
                  </Box>

                  <Box style={{ flexShrink: 0, paddingTop: 2 }}>
                    <IconButton
                      type="button"
                      variant="ghost"
                      color="gray"
                      disabled={disabled}
                      aria-label="Remove condition"
                      onClick={() => removeCondition(row.id)}
                    >
                      <X size={18} />
                    </IconButton>
                  </Box>
                </Flex>
              </Flex>
            );
          })
          : null}

        <div>
          <Button
            type="button"
            variant="soft"
            color="gray"
            size="2"
            disabled={disabled}
            onClick={() => setConditionRows((prev) => [...prev, emptyConditionRow()])}
          >
            + Add condition
          </Button>
        </div>

        {conditionRows.length > 0 ? (
          <ConditionMatchesPreview
            mailboxConnected={mailboxConnected}
            disabled={disabled}
            conditionRows={conditionRows}
          />
        ) : null}
      </Flex>

      <Separator size="4" />

      {hasConditions && hasActions ? (
        <Flex direction="column" gap="3">
          <Text size="3" weight="bold">
            Actions
          </Text>
          <Text color="gray" size="2">
            Multiple actions all run when the rule matches (logical AND).
          </Text>

          <Flex direction="column" gap="5">
          {actionRows.map((row) => (
            <Flex
              key={row.id}
              gap="2"
              align={
                row.type === "send_templated_email" ||
                row.type === "run_integration" ||
                row.type === "draft_review_request" ||
                row.type === "create_draft" ||
                row.type === "notify"
                  ? "start"
                  : "center"
              }
              wrap="wrap"
            >
              <Box style={{ flex: "0 1 160px", minWidth: 120 }}>
                <Select.Root
                  value={row.type || EMPTY_VALUE}
                  onValueChange={(v) => {
                    const type = v === EMPTY_VALUE ? "" : (v as ActionRowState["type"]);
                    const patch: Partial<ActionRowState> = { type };
                    if (type === "send_templated_email" && !row.emailTemplateKey.trim() && emailTemplates[0]) {
                      patch.emailTemplateKey = emailTemplates[0].templateKey;
                      if (!row.fromAliasEmail.trim() && defaultFromAlias) {
                        patch.fromAliasEmail = defaultFromAlias;
                      }
                    }
                    if (type === "run_integration" && !row.integrationId.trim() && integrations[0]) {
                      patch.integrationId = integrations[0].id;
                    }
                    updateAction(row.id, patch);
                  }}
                  disabled={disabled}
                >
                  <Select.Trigger variant="surface" style={{ width: "100%", minHeight: 36 }} />
                  <Select.Content position="popper">
                    <Select.Item value={EMPTY_VALUE}>Type…</Select.Item>
                    <Select.Item value="send_templated_email">Send email</Select.Item>
                    <Select.Item value="draft_review_request">Compose draft</Select.Item>
                    <Select.Item value="run_integration">Run integration</Select.Item>
                    {row.type === "create_draft" ? (
                      <Select.Item value="create_draft">Legacy: create_draft</Select.Item>
                    ) : null}
                    {row.type === "notify" ? (
                      <Select.Item value="notify">Legacy: notify</Select.Item>
                    ) : null}
                  </Select.Content>
                </Select.Root>
              </Box>

              {row.type === "create_draft" || row.type === "notify" ? (
                <Text size="2" color="gray" style={{ flex: "1 1 240px", minWidth: 0 }}>
                  This action type is no longer supported in the UI. Choose &quot;Send email&quot;, &quot;Compose
                  draft&quot; or &quot;Run integration&quot; and save, or leave as-is to keep the stored JSON unchanged.
                </Text>
              ) : null}

              {row.type === "send_templated_email" ? (
                <SendEmailActionFields
                  row={row}
                  emailTemplates={emailTemplates}
                  sendAsOptions={sendAsOptions}
                defaultFromAlias={defaultFromAlias}
                  disabled={disabled}
                  updateAction={updateAction}
                />
              ) : null}

              {row.type === "run_integration" ? (
                <RunIntegrationActionFields
                  row={row}
                  integrations={integrations}
                  disabled={disabled}
                  updateAction={updateAction}
                />
              ) : null}

              {row.type === "draft_review_request" ? <ComposeDraftActionFields /> : null}

              <IconButton
                type="button"
                variant="ghost"
                color="gray"
                disabled={disabled || actionRows.length <= 1}
                aria-label="Remove action"
                onClick={() => removeAction(row.id)}
              >
                <X size={18} />
              </IconButton>
            </Flex>
          ))}
          </Flex>

          <div>
            <Button
              type="button"
              variant="soft"
              color="gray"
              size="2"
              disabled={disabled}
              onClick={() => setActionRows((prev) => [...prev, emptyActionRow()])}
            >
              + Add action
            </Button>
          </div>
        </Flex>
      ) : null}

      <Flex gap="3" align="center" justify="end" wrap="wrap">
        <Button type="submit" disabled={disabled || !hasConditions || !hasActions}>
          {submitLabel}
        </Button>
        {footer
          ? React.isValidElement(footer)
            ? React.cloneElement(footer, {
                disabled:
                  disabled ||
                  !hasConditions ||
                  !hasActions ||
                  Boolean((footer.props as { disabled?: boolean }).disabled),
              } as Record<string, unknown>)
            : footer
          : null}
      </Flex>
    </Flex>
  );
}
