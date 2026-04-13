"use client";

import { Badge, Button, Flex, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearDefaultSendAsEmail, setDefaultSendAsEmail } from "./actions";

export function DefaultSendAsButtons({
  mailboxId,
  email,
  isDefault,
}: {
  mailboxId: string;
  email: string;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setDefault() {
    setPending(true);
    try {
      await setDefaultSendAsEmail(mailboxId, email);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to set default alias.");
    } finally {
      setPending(false);
    }
  }

  async function clearDefault() {
    setPending(true);
    try {
      await clearDefaultSendAsEmail(mailboxId);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to clear default alias.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Flex align="center" gap="2" wrap="wrap">
      {isDefault ? <Badge color="green">default</Badge> : null}
      <Text size="2" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
        {email}
      </Text>
      {isDefault ? (
        <Button size="1" variant="soft" color="gray" disabled={pending} onClick={clearDefault}>
          {pending ? "..." : "Clear default"}
        </Button>
      ) : (
        <Button size="1" variant="soft" color="gray" disabled={pending} onClick={setDefault}>
          {pending ? "..." : "Set as default"}
        </Button>
      )}
    </Flex>
  );
}
