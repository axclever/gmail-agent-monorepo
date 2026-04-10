"use client";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createIntegration } from "./actions";

type IntegrationTypeOption = "HTTP" | "SMTP";

export function AddIntegrationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IntegrationTypeOption>("HTTP");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("type", type);
    try {
      await createIntegration(fd);
      setOpen(false);
      form.reset();
      setType("HTTP");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create integration.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button>Add integration</Button>
      </Dialog.Trigger>
      <Dialog.Content size="3" style={{ maxWidth: "min(520px, 94vw)", maxHeight: "min(90vh, 800px)" }}>
        <Dialog.Title>Add integration</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Non-secret settings go to config; tokens and passwords are encrypted with MASTER_ENCRYPTION_KEY before
          storage.
        </Dialog.Description>

        <form onSubmit={onSubmit}>
          <Flex direction="column" gap="3">
            <Box>
              <Text size="2" weight="medium" mb="1" as="div">
                Type
              </Text>
              <Select.Root value={type} onValueChange={(v) => setType(v as IntegrationTypeOption)}>
                <Select.Trigger placeholder="Type" style={{ width: "100%" }} />
                <Select.Content position="popper">
                  <Select.Item value="HTTP">HTTP / API gateway</Select.Item>
                  <Select.Item value="SMTP">SMTP</Select.Item>
                </Select.Content>
              </Select.Root>
              <input type="hidden" name="type" value={type} readOnly />
            </Box>

            <Box>
              <Text size="2" weight="medium" mb="1" as="div">
                Name
              </Text>
              <TextField.Root name="name" placeholder="Logs gateway" required />
            </Box>

            <Text as="label" size="2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Checkbox name="isActive" defaultChecked />
              Active
            </Text>

            {type === "HTTP" ? (
              <>
                <Text size="2" color="gray" style={{ lineHeight: 1.45 }}>
                  Public <Text weight="medium">headers</Text> live in config. <Text weight="medium">Auth</Text> is a
                  JSON map of header names to values — stored encrypted and merged into the request when you call the
                  gateway.
                </Text>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Base URL
                  </Text>
                  <TextField.Root
                    name="config_baseUrl"
                    placeholder="https://your-server.example.com/notify"
                    required
                  />
                </Box>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Method
                  </Text>
                  <select
                    name="config_method"
                    defaultValue="POST"
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
                    style={{ fontFamily: "var(--font-mono)" }}
                  />
                </Box>
                <Box>
                  <Text size="3" weight="bold" mb="1" as="div">
                    Auth (encrypted)
                  </Text>
                  <Text size="2" color="gray" mb="2" style={{ lineHeight: 1.45 }}>
                    Header names and values as JSON. Encrypted with MASTER_ENCRYPTION_KEY before save. Omit if no secret
                    headers.
                  </Text>
                  <TextArea
                    name="secret_authHeadersJson"
                    rows={5}
                    placeholder={`{\n  "x-api-token": "your-token",\n  "Authorization": "Bearer …"\n}`}
                    style={{ fontFamily: "var(--font-mono)" }}
                    spellCheck={false}
                  />
                </Box>
              </>
            ) : null}

            {type === "SMTP" ? (
              <>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Host
                  </Text>
                  <TextField.Root name="config_host" placeholder="smtp.gmail.com" />
                </Box>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Port
                  </Text>
                  <TextField.Root name="config_port" type="number" placeholder="587" />
                </Box>
                <Text as="label" size="2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox name="config_secure" />
                  TLS (secure)
                </Text>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    From email
                  </Text>
                  <TextField.Root name="config_fromEmail" placeholder="you@company.com" />
                </Box>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Username (secret)
                  </Text>
                  <TextField.Root name="secret_username" autoComplete="off" />
                </Box>
                <Box>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Password (secret)
                  </Text>
                  <TextField.Root name="secret_password" type="password" autoComplete="off" />
                </Box>
              </>
            ) : null}

            {error ? (
              <Text size="2" color="red">
                {error}
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
      </Dialog.Content>
    </Dialog.Root>
  );
}
