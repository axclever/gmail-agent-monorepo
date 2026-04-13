"use client";

import { Button, Callout, Flex, Text, TextField } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPublicApiToken } from "./actions";

export function CreatePublicApiTokenForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await createPublicApiToken(name);
      setCreatedToken(result.rawToken);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Flex direction="column" gap="3">
      <form onSubmit={onSubmit}>
        <Flex gap="2" align="end" wrap="wrap">
          <Flex direction="column" gap="1" style={{ minWidth: 220, flex: 1 }}>
            <Text size="2" weight="medium">
              Token name
            </Text>
            <TextField.Root
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Telegram bot prod"
              required
              disabled={pending}
            />
          </Flex>
          <Button type="submit" disabled={pending}>
            {pending ? "Generating..." : "Generate token"}
          </Button>
        </Flex>
      </form>

      {error ? <Callout.Root color="red">{error}</Callout.Root> : null}

      {createdToken ? (
        <Callout.Root color="amber">
          <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
            Copy this token now. It will not be shown again.
          </Text>
          <Text
            size="2"
            style={{ display: "block", fontFamily: "var(--code-font-family, ui-monospace, monospace)" }}
          >
            {createdToken}
          </Text>
        </Callout.Root>
      ) : null}
    </Flex>
  );
}
