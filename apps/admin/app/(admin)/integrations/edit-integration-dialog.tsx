"use client";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  getIntegrationForEdit,
  updateIntegration,
  type IntegrationEditPayload,
} from "./actions";

export function EditIntegrationDialog({ integrationId }: { integrationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<IntegrationEditPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setLoadError(null);
      setSubmitError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setPayload(null);
      try {
        const p = await getIntegrationForEdit(integrationId);
        if (cancelled) return;
        if (!p) setLoadError("Integration not found.");
        else setPayload(p);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, integrationId]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payload) return;
    setSubmitError(null);
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("integrationId", integrationId);
    try {
      await updateIntegration(fd);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button variant="soft" size="1">
          Edit
        </Button>
      </Dialog.Trigger>
      <Dialog.Content size="3" style={{ maxWidth: "min(520px, 94vw)", maxHeight: "min(90vh, 800px)" }}>
        <Dialog.Title>Edit integration</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Type cannot be changed. For HTTP auth: leave the field empty to keep stored secrets; use{" "}
          <Text as="span" weight="medium">
            {"{}"}
          </Text>{" "}
          to clear them. For SMTP, leave password empty to keep the current password.
        </Dialog.Description>

        {!open ? null : loadError ? (
          <Text size="2" color="red">
            {loadError}
          </Text>
        ) : !payload ? (
          <Text size="2" color="gray">
            Loading…
          </Text>
        ) : (
          <form key={payload.id} onSubmit={onSubmit}>
            <Flex direction="column" gap="3">
              <Box>
                <Text size="2" weight="medium" mb="1" as="div">
                  Type
                </Text>
                <Text size="2" color="gray">
                  {payload.type}
                </Text>
              </Box>

              <Box>
                <Text size="2" weight="medium" mb="1" as="div">
                  Name
                </Text>
                <TextField.Root name="name" placeholder="Logs gateway" defaultValue={payload.name} required />
              </Box>

              <Text as="label" size="2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Checkbox name="isActive" defaultChecked={payload.isActive} />
                Active
              </Text>

              {payload.type === "HTTP" ? (
                <>
                  <Text size="2" color="gray" style={{ lineHeight: 1.45 }}>
                    Public <Text weight="medium">headers</Text> in config. <Text weight="medium">Auth</Text> is
                    encrypted JSON header map.
                  </Text>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Base URL
                    </Text>
                    <TextField.Root
                      name="config_baseUrl"
                      placeholder="https://your-server.example.com/notify"
                      defaultValue={payload.baseUrl}
                      required
                    />
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Method
                    </Text>
                    <select
                      name="config_method"
                      defaultValue={payload.method || "POST"}
                      required
                      style={{
                        width: "100%",
                        borderRadius: "var(--radius-2)",
                        border: "1px solid var(--gray-6)",
                        padding: "8px 10px",
                        fontSize: 14,
                        background: "var(--color-surface)",
                      }}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Headers (JSON, not encrypted)
                    </Text>
                    <TextArea
                      name="config_headers"
                      rows={3}
                      placeholder='{"Content-Type": "application/json"}'
                      defaultValue={payload.headersText}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </Box>
                  <Box>
                    <Text size="3" weight="bold" mb="1" as="div">
                      Auth (encrypted)
                    </Text>
                    <Text size="2" color="gray" mb="2" style={{ lineHeight: 1.45 }}>
                      Empty = keep current secrets. <Text weight="medium">{"{}"}</Text> = remove all secret headers.
                    </Text>
                    <TextArea
                      name="secret_authHeadersJson"
                      rows={5}
                      placeholder={`{\n  "x-api-token": "your-token"\n}`}
                      defaultValue={payload.authHeadersText}
                      style={{ fontFamily: "var(--font-mono)" }}
                      spellCheck={false}
                    />
                  </Box>
                </>
              ) : null}

              {payload.type === "SMTP" ? (
                <>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Host
                    </Text>
                    <TextField.Root name="config_host" placeholder="smtp.gmail.com" defaultValue={payload.host} />
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Port
                    </Text>
                    <TextField.Root
                      name="config_port"
                      type="number"
                      placeholder="587"
                      defaultValue={payload.port}
                    />
                  </Box>
                  <Text as="label" size="2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Checkbox name="config_secure" defaultChecked={payload.secure} />
                    TLS (secure)
                  </Text>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      From email
                    </Text>
                    <TextField.Root
                      name="config_fromEmail"
                      placeholder="you@company.com"
                      defaultValue={payload.fromEmail}
                    />
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Username (secret)
                    </Text>
                    <TextField.Root name="secret_username" autoComplete="off" defaultValue={payload.username} />
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="1" as="div">
                      Password (secret)
                    </Text>
                    <TextField.Root name="secret_password" type="password" autoComplete="off" placeholder="••••••••" />
                    <Text size="1" color="gray" mt="1" as="div">
                      Leave blank to keep the saved password.
                    </Text>
                  </Box>
                </>
              ) : null}

              {submitError ? (
                <Text size="2" color="red">
                  {submitError}
                </Text>
              ) : null}

              <Flex gap="3" justify="end" mt="2">
                <Dialog.Close>
                  <Button type="button" variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </Flex>
            </Flex>
          </form>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
