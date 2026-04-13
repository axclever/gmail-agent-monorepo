"use client";

import { Box, Button, Card, Flex, Heading, Text, TextArea, TextField } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmailTemplate, deleteEmailTemplate, updateEmailTemplate } from "./actions";

export type EmailTemplateRow = {
  id: string;
  templateKey: string;
  name: string;
  subject: string;
  body: string;
};

type PanelMode = "new" | { edit: string };

function sortTemplatesAlphabetically(list: EmailTemplateRow[]): EmailTemplateRow[] {
  return [...list].sort((a, b) => a.templateKey.localeCompare(b.templateKey, undefined, { sensitivity: "base" }));
}

function TemplateListItem({
  template,
  orderPosition,
  selected,
  mailboxConnected,
  onSelect,
}: {
  template: EmailTemplateRow;
  orderPosition: number;
  selected: boolean;
  mailboxConnected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        width: "100%",
        minHeight: 52,
        boxSizing: "border-box",
        borderRadius: "max(var(--radius-3), var(--radius-full))",
        border: "1px solid",
        borderColor: selected ? "rgba(255, 255, 255, 0.92)" : "var(--gray-6)",
        background: "var(--gray-a3)",
        overflow: "hidden",
      }}
    >
      <Button
        variant="ghost"
        color="gray"
        size="2"
        type="button"
        onClick={onSelect}
        disabled={!mailboxConnected}
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          padding: 0,
          paddingInline: "12px 16px",
          paddingBlock: 10,
          boxSizing: "border-box",
          borderRadius: 0,
          background: "transparent",
          boxShadow: "none",
          cursor: "default",
        }}
      >
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
          <Flex direction="column" gap="0" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <Text
              size="2"
              weight="medium"
              style={{
                lineHeight: "22px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {template.name}
            </Text>
            <Text
              size="1"
              style={{
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--gray-11)",
              }}
            >
              {template.templateKey}
            </Text>
          </Flex>
        </Flex>
      </Button>
    </Box>
  );
}

export function EmailTemplatesPanel({
  templates,
  mailboxConnected,
  mailboxEmail,
}: {
  templates: EmailTemplateRow[];
  mailboxConnected: boolean;
  mailboxEmail: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>("new");
  const [templateKey, setTemplateKey] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const hydratedSelectionRef = useRef<string | null>(null);
  const selectionKey = mode === "new" ? "new" : mode.edit;

  const sortedTemplates = useMemo(() => sortTemplatesAlphabetically(templates), [templates]);
  const templatesById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  const selectedTemplate = mode !== "new" ? templatesById.get(mode.edit) : undefined;

  useEffect(() => {
    if (mode === "new") return;
    const exists = templates.some((t) => t.id === mode.edit);
    if (!exists) {
      hydratedSelectionRef.current = null;
      setMode("new");
      setFormError(null);
      setTemplateKey("");
      setName("");
      setSubject("");
      setBody("");
    }
  }, [mode, templates]);

  function openNewTemplateForm() {
    hydratedSelectionRef.current = null;
    setMode("new");
    setFormError(null);
    setTemplateKey("");
    setName("");
    setSubject("");
    setBody("");
  }

  useEffect(() => {
    if (selectionKey === "new") return;
    if (hydratedSelectionRef.current === selectionKey) return;
    const t = templatesById.get(selectionKey);
    if (!t) return;
    hydratedSelectionRef.current = selectionKey;
    setTemplateKey(t.templateKey);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
  }, [selectionKey, templatesById]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!mailboxConnected) return;
    setPendingSave(true);
    setFormError(null);
    try {
      const id = await createEmailTemplate({
        templateKey,
        name,
        subject,
        body,
      });
      hydratedSelectionRef.current = null;
      setMode({ edit: id });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create template.");
    } finally {
      setPendingSave(false);
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "new" || !selectedTemplate) return;
    setPendingSave(true);
    setFormError(null);
    try {
      await updateEmailTemplate(selectedTemplate.id, {
        templateKey,
        name,
        subject,
        body,
      });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setPendingSave(false);
    }
  }

  async function onDelete() {
    if (mode === "new" || !selectedTemplate) return;
    if (
      !confirm(
        `Delete template “${selectedTemplate.name}” (${selectedTemplate.templateKey})? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPendingDelete(true);
    setFormError(null);
    try {
      await deleteEmailTemplate(selectedTemplate.id);
      openNewTemplateForm();
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setPendingDelete(false);
    }
  }

  const disabled = !mailboxConnected || pendingSave;

  return (
    <Flex direction="column" gap="4" style={{ flex: 1, minHeight: 0, width: "100%" }}>
      <Flex direction="column" gap="1" style={{ flexShrink: 0 }}>
        <Heading size="6">Email templates</Heading>
        {mailboxEmail ? (
          <Text color="gray" size="2">
            Mustache: {"{{variableName}}"} in subject and body · {mailboxEmail}
          </Text>
        ) : (
          <Text color="gray" size="2">
            Mustache placeholders in subject and body.
          </Text>
        )}
      </Flex>

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
          <Box style={{ overflowY: "auto", flex: 1, minHeight: 80 }}>
            {sortedTemplates.length === 0 ? (
              <Text color="gray" size="2">
                No templates yet.
              </Text>
            ) : (
              <Flex direction="column" gap="1">
                {sortedTemplates.map((t, index) => {
                  const selected = mode !== "new" && mode.edit === t.id;
                  return (
                    <TemplateListItem
                      key={t.id}
                      template={t}
                      orderPosition={index + 1}
                      selected={selected}
                      mailboxConnected={mailboxConnected}
                      onSelect={() => {
                        hydratedSelectionRef.current = null;
                        setMode({ edit: t.id });
                        setFormError(null);
                      }}
                    />
                  );
                })}
              </Flex>
            )}
          </Box>
          <Button
            type="button"
            variant="outline"
            color="gray"
            size="2"
            disabled={!mailboxConnected}
            onClick={openNewTemplateForm}
            style={{ flexShrink: 0, width: "100%", justifyContent: "center" }}
          >
            Add new template
          </Button>
        </Flex>

        <Card
          size="3"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {mode === "new" ? (
              <form onSubmit={onCreate}>
                <TemplateFormFields
                  templateKey={templateKey}
                  setTemplateKey={setTemplateKey}
                  name={name}
                  setName={setName}
                  subject={subject}
                  setSubject={setSubject}
                  body={body}
                  setBody={setBody}
                  formError={formError}
                  disabled={disabled}
                  submitLabel={pendingSave ? "Creating…" : "Create template"}
                />
              </form>
            ) : selectedTemplate ? (
              <form onSubmit={onUpdate}>
                <TemplateFormFields
                  templateKey={templateKey}
                  setTemplateKey={setTemplateKey}
                  name={name}
                  setName={setName}
                  subject={subject}
                  setSubject={setSubject}
                  body={body}
                  setBody={setBody}
                  formError={formError}
                  disabled={disabled}
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
                      {pendingDelete ? "Deleting…" : "Delete template"}
                    </Button>
                  }
                />
              </form>
            ) : (
              <Text color="gray" size="2">
                Select a template from the list, or use Add new template.
              </Text>
            )}
          </Box>
        </Card>
      </Flex>

      {!mailboxConnected ? (
        <Text color="gray" size="2" style={{ flexShrink: 0 }}>
          Connect Gmail in the sidebar to manage templates.
        </Text>
      ) : null}
    </Flex>
  );
}

function TemplateFormFields({
  templateKey,
  setTemplateKey,
  name,
  setName,
  subject,
  setSubject,
  body,
  setBody,
  formError,
  disabled,
  submitLabel,
  footer,
}: {
  templateKey: string;
  setTemplateKey: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  formError: string | null;
  disabled: boolean;
  submitLabel: string;
  footer?: ReactNode;
}) {
  return (
    <Flex direction="column" gap="4">
      {formError ? (
        <Text size="2" color="red">
          {formError}
        </Text>
      ) : null}

      <Box>
        <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
          Display name
        </Text>
        <TextField.Root
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lead follow-up"
          disabled={disabled}
          required
          size="2"
          style={{ width: "100%" }}
        />
      </Box>
      <Box>
        <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
          Key <Text color="gray">(stable id for rules, e.g. lead_followup)</Text>
        </Text>
        <TextField.Root
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          placeholder="lead_followup"
          disabled={disabled}
          required
          size="2"
          style={{ width: "100%" }}
        />
      </Box>
      <Box>
        <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
          Subject <Text color="gray">(Mustache: {"{{name}}"})</Text>
        </Text>
        <TextField.Root
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Hello {{name}}"
          disabled={disabled}
          required
          size="2"
          style={{ width: "100%" }}
        />
      </Box>
      <Box>
        <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
          Body
        </Text>
        <TextArea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {{name}}, ..."
          rows={12}
          size="2"
          style={{ width: "100%" }}
          disabled={disabled}
        />
      </Box>

      <Flex gap="3" align="center" wrap="wrap">
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
        {footer}
      </Flex>
    </Flex>
  );
}
