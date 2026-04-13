"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRule, deleteRule, reorderRules, updateRule, type RuleFormInput } from "./actions";
import { RuleFormFields } from "./rule-form-fields";
import {
  actionsFromJson,
  actionsToJson,
  conditionsFromJson,
  conditionsToJson,
  emptyActionRow,
  type ActionRowState,
  type ConditionRowState,
  type RuleEmailTemplateOption,
} from "./rule-form-model";

export type RuleRow = {
  id: string;
  ruleKey: string;
  name: string;
  enabled: boolean;
  priority: number;
  version: number;
  stopProcessing: boolean;
  createdAt: Date | string;
  conditions: unknown;
  actions: unknown;
};

type PanelMode = "new" | { edit: string };

function countRuleConditions(conditions: unknown): number {
  if (!Array.isArray(conditions)) return 0;
  return conditions.filter((c) => {
    const o = c as Record<string, unknown>;
    return String(o.field ?? "").trim().length > 0;
  }).length;
}

function countRuleActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  return actions.filter((a) => {
    const t = String((a as Record<string, unknown>).type ?? "");
    return t === "create_draft" || t === "notify" || t === "send_templated_email";
  }).length;
}

function sortRulesForDisplay(list: RuleRow[]): RuleRow[] {
  return [...list].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });
}

function SortableRuleItem({
  id,
  rule,
  orderPosition,
  selected,
  mailboxConnected,
  reorderBusy,
  onSelect,
}: {
  id: string;
  rule: RuleRow;
  orderPosition: number;
  selected: boolean;
  mailboxConnected: boolean;
  reorderBusy: boolean;
  onSelect: () => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !mailboxConnected || reorderBusy,
  });

  const conditionCount = countRuleConditions(rule.conditions);
  const actionCount = countRuleActions(rule.actions);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    minHeight: 0,
    boxSizing: "border-box",
    borderRadius: "max(var(--radius-3), var(--radius-full))",
    border: "1px solid",
    borderColor: selected ? "rgba(255, 255, 255, 0.92)" : "var(--gray-6)",
    background: "var(--gray-a3)",
    overflow: "hidden",
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 2 : undefined,
    position: "relative",
    cursor:
      mailboxConnected && !reorderBusy ? (isDragging ? "grabbing" : "grab") : "default",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners}>
      <Button
        variant="ghost"
        color="gray"
        size="2"
        type="button"
        onClick={onSelect}
        disabled={reorderBusy}
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "stretch",
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          padding: 0,
          paddingInline: "12px 16px",
          paddingBlock: 10,
          boxSizing: "border-box",
          borderRadius: 0,
          background: "transparent",
          boxShadow: "none",
          cursor: "inherit",
        }}
      >
        <Flex direction="column" gap="1" style={{ width: "100%", minWidth: 0, textAlign: "left" }}>
          <Flex direction="row" align="center" gap="3" style={{ width: "100%", minWidth: 0 }}>
            <Text
              size="2"
              weight="bold"
              style={{
                flexShrink: 0,
                width: 28,
                minWidth: 28,
                textAlign: "center",
                lineHeight: "22px",
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                letterSpacing: "-0.03em",
                color: "var(--gray-11)",
              }}
            >
              {orderPosition}
            </Text>
            <Text
              size="2"
              weight="medium"
              style={{
                flex: 1,
                minWidth: 0,
                lineHeight: "22px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "left",
              }}
            >
              {rule.name}
            </Text>
            <Box
              aria-hidden
              title={rule.enabled ? "Active" : "Inactive"}
              style={{
                flexShrink: 0,
                width: 26,
                minWidth: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 9999,
                  flexShrink: 0,
                  boxSizing: "border-box",
                  background: rule.enabled ? "var(--green-9)" : "var(--gray-8)",
                  boxShadow: rule.enabled
                    ? "0 0 0 1px rgba(255, 255, 255, 0.22) inset"
                    : "0 0 0 1px var(--gray-7) inset",
                }}
              />
            </Box>
          </Flex>
          <Flex direction="row" gap="3" style={{ width: "100%", minWidth: 0 }}>
            <Box style={{ width: 28, minWidth: 28, flexShrink: 0 }} aria-hidden />
            <Text size="1" color="gray" style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
              {conditionCount} {conditionCount === 1 ? "condition" : "conditions"} · {actionCount}{" "}
              {actionCount === 1 ? "action" : "actions"}
            </Text>
            <Box style={{ width: 26, minWidth: 26, flexShrink: 0 }} aria-hidden />
          </Flex>
        </Flex>
      </Button>
    </div>
  );
}

export function RulesPanel({
  rules,
  mailboxConnected,
  emailTemplates = [],
}: {
  rules: RuleRow[];
  mailboxConnected: boolean;
  emailTemplates?: RuleEmailTemplateOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>("new");
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [version, setVersion] = useState(1);
  const [stopProcessing, setStopProcessing] = useState(false);
  const [conditionRows, setConditionRows] = useState<ConditionRowState[]>([]);
  const [actionRows, setActionRows] = useState<ActionRowState[]>([emptyActionRow()]);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listIds, setListIds] = useState<string[]>(() => sortRulesForDisplay(rules).map((r) => r.id));
  const [reorderBusy, setReorderBusy] = useState(false);

  const selectionKey = mode === "new" ? "new" : mode.edit;

  const selectedRule = mode !== "new" ? rules.find((r) => r.id === mode.edit) : undefined;

  const hydratedSelectionRef = useRef<string | null>(null);
  const listIdsRef = useRef<string[]>([]);
  const rulesRef = useRef(rules);

  rulesRef.current = rules;
  listIdsRef.current = listIds;

  const sortedRules = useMemo(() => sortRulesForDisplay(rules), [rules]);
  const orderSyncKey = useMemo(
    () => sortedRules.map((r) => `${r.id}:${r.priority}`).join("|"),
    [sortedRules],
  );

  useEffect(() => {
    setListIds(sortedRules.map((r) => r.id));
  }, [orderSyncKey, sortedRules]);

  const rulesById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);

  const orderedRules = useMemo(() => {
    if (listIds.length === 0) return sortRulesForDisplay(rules);
    const out: RuleRow[] = [];
    const seen = new Set<string>();
    for (const id of listIds) {
      const r = rulesById.get(id);
      if (r) {
        out.push(r);
        seen.add(id);
      }
    }
    for (const r of sortRulesForDisplay(rules)) {
      if (!seen.has(r.id)) out.push(r);
    }
    return out;
  }, [listIds, rulesById, rules]);

  const orderedRuleIds = useMemo(() => orderedRules.map((r) => r.id), [orderedRules]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function openNewRuleForm() {
    hydratedSelectionRef.current = null;
    setMode("new");
    setFormError(null);
    setName("");
    setEnabled(true);
    setPriority(100);
    setVersion(1);
    setStopProcessing(false);
    setConditionRows([]);
    setActionRows([emptyActionRow()]);
  }

  useEffect(() => {
    if (selectionKey === "new") {
      return;
    }

    if (hydratedSelectionRef.current === selectionKey) {
      return;
    }

    const r = rules.find((x) => x.id === selectionKey);
    if (!r) {
      return;
    }

    hydratedSelectionRef.current = selectionKey;
    setName(r.name);
    setEnabled(r.enabled);
    setPriority(r.priority);
    setVersion(r.version);
    setStopProcessing(r.stopProcessing);
    setConditionRows(conditionsFromJson(r.conditions));
    setActionRows(actionsFromJson(r.actions));
  }, [selectionKey, rules]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const persistReorder = useCallback(
    async (next: string[]) => {
      if (!mailboxConnected) return;
      const prev = listIdsRef.current;
      const same = prev.length === next.length && prev.every((id, i) => id === next[i]);
      if (same) return;
      setListIds(next);
      listIdsRef.current = next;
      setReorderBusy(true);
      setFormError(null);
      try {
        await reorderRules(next);
        refresh();
      } catch (e) {
        const reverted = sortRulesForDisplay(rulesRef.current).map((r) => r.id);
        setListIds(reverted);
        listIdsRef.current = reverted;
        setFormError(e instanceof Error ? e.message : "Failed to reorder rules.");
      } finally {
        setReorderBusy(false);
      }
    },
    [mailboxConnected, refresh],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const prev = orderedRuleIds;
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(prev, oldIndex, newIndex);
      void persistReorder(next);
    },
    [orderedRuleIds, persistReorder],
  );

  function buildPayload(): RuleFormInput | null {
    const conditions = conditionsToJson(conditionRows);
    let actions: unknown[];
    try {
      actions = actionsToJson(actionRows);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Invalid actions.");
      return null;
    }
    if (actions.length === 0) {
      setFormError("Add at least one action and select its type.");
      return null;
    }
    setFormError(null);
    return {
      name,
      enabled,
      priority,
      version,
      stopProcessing,
      conditions,
      actions,
    };
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!mailboxConnected) return;
    const payload = buildPayload();
    if (!payload) return;
    setPendingSave(true);
    try {
      const { id } = await createRule(payload);
      setMode({ edit: id });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create rule.");
    } finally {
      setPendingSave(false);
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "new" || !selectedRule) return;
    const payload = buildPayload();
    if (!payload) return;
    setPendingSave(true);
    try {
      await updateRule(selectedRule.id, payload);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update rule.");
    } finally {
      setPendingSave(false);
    }
  }

  async function onDelete() {
    if (mode === "new" || !selectedRule) return;
    if (!confirm(`Delete rule “${selectedRule.name}” (${selectedRule.ruleKey})? This cannot be undone.`)) return;
    setPendingDelete(true);
    setFormError(null);
    try {
      await deleteRule(selectedRule.id);
      openNewRuleForm();
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setPendingDelete(false);
    }
  }

  const disabled = !mailboxConnected || pendingSave;

  const scrollPanelStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    paddingBlock: "0.25rem",
    WebkitOverflowScrolling: "touch",
  };

  return (
    <>
      <Flex direction="column" gap="4" style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <Heading size="6" style={{ flexShrink: 0 }}>
          Rules
        </Heading>

        <Flex
          gap="4"
          style={{
            flex: 1,
            minHeight: 0,
            alignItems: "stretch",
            width: "100%",
          }}
        >
          <Flex
            direction="column"
            gap="2"
            style={{
              width: "min(100%, 300px)",
              flexShrink: 0,
              minHeight: 0,
              maxHeight: "100%",
            }}
          >
            <Box className="smart-scroll" style={{ ...scrollPanelStyle, minHeight: 80 }}>
            {rules.length === 0 ? (
              <Text color="gray" size="2">
                No rules yet.
              </Text>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={orderedRuleIds} strategy={verticalListSortingStrategy}>
                  <Flex direction="column" gap="1">
                    {orderedRules.map((r, index) => {
                      const selected = mode !== "new" && mode.edit === r.id;
                      return (
                        <SortableRuleItem
                          key={r.id}
                          id={r.id}
                          rule={r}
                          orderPosition={index + 1}
                          selected={selected}
                          mailboxConnected={mailboxConnected}
                          reorderBusy={reorderBusy}
                          onSelect={() => {
                            hydratedSelectionRef.current = null;
                            setMode({ edit: r.id });
                            setFormError(null);
                          }}
                        />
                      );
                    })}
                  </Flex>
                </SortableContext>
              </DndContext>
            )}
          </Box>
          <Button
            type="button"
            variant="outline"
            color="gray"
            size="2"
            disabled={!mailboxConnected}
            onClick={openNewRuleForm}
            style={{ flexShrink: 0, width: "100%", justifyContent: "center" }}
          >
            Add new rule
          </Button>
        </Flex>

        <Box
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            className="smart-scroll"
            style={{ ...scrollPanelStyle, paddingLeft: "var(--space-6)" }}
          >
            {mode === "new" ? (
              <form onSubmit={onCreate}>
                <RuleFormFields
                  name={name}
                  setName={setName}
                  enabled={enabled}
                  setEnabled={setEnabled}
                  conditionRows={conditionRows}
                  setConditionRows={setConditionRows}
                  actionRows={actionRows}
                  setActionRows={setActionRows}
                  emailTemplates={emailTemplates}
                  formError={formError}
                  disabled={disabled}
                  mailboxConnected={mailboxConnected}
                  submitLabel={pendingSave ? "Creating…" : "Create rule"}
                />
              </form>
            ) : selectedRule ? (
              <form onSubmit={onUpdate}>
                <RuleFormFields
                  name={name}
                  setName={setName}
                  enabled={enabled}
                  setEnabled={setEnabled}
                  conditionRows={conditionRows}
                  setConditionRows={setConditionRows}
                  actionRows={actionRows}
                  setActionRows={setActionRows}
                  emailTemplates={emailTemplates}
                  formError={formError}
                  disabled={disabled}
                  mailboxConnected={mailboxConnected}
                  submitLabel={pendingSave ? "Saving…" : "Save changes"}
                  footer={
                    <Button
                      type="button"
                      variant="soft"
                      color="red"
                      onClick={onDelete}
                      disabled={pendingDelete}
                      style={{ alignSelf: "flex-start" }}
                    >
                      {pendingDelete ? "Deleting…" : "Delete rule"}
                    </Button>
                  }
                />
              </form>
            ) : (
              <Text color="gray" size="2">
                Select a rule from the list, or use Add new rule.
              </Text>
            )}
          </Box>
        </Box>
      </Flex>

      {!mailboxConnected ? (
        <Text color="gray" size="2" style={{ flexShrink: 0 }}>
          Connect Gmail in the sidebar to manage rules.
        </Text>
      ) : null}
    </Flex>
      <style>{`
        .smart-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--gray-3) transparent;
        }
        .smart-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .smart-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .smart-scroll::-webkit-scrollbar-thumb {
          background: var(--gray-3);
          border-radius: 999px;
        }
        .smart-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--gray-4);
        }
      `}</style>
    </>
  );
}
