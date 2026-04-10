"use client";

import NextLink from "next/link";
import {
  Box,
  Button,
  Dialog,
  Flex,
  ScrollArea,
  Separator,
  Strong,
  Text,
} from "@radix-ui/themes";
import { useMemo } from "react";

export type FullMessageContent = {
  id: string;
  subject?: string | null;
  from: string;
  to: string;
  cc: string;
  direction: "INBOUND" | "OUTBOUND";
  dateLabel: string;
  textBody?: string | null;
  htmlBody?: string | null;
};

function plainBody(m: FullMessageContent): string {
  const t = m.textBody?.trim();
  if (t) return t;
  const h = m.htmlBody?.trim();
  if (!h) return "—";
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = h;
    const out = el.textContent?.trim();
    if (out) return out;
  }
  return h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "—";
}

export type FullMessageModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: FullMessageContent | null;
  /** Optional link shown in the footer (e.g. full thread admin page). */
  threadPageHref?: string;
};

export function FullMessageModal({
  open,
  onOpenChange,
  message,
  threadPageHref,
}: FullMessageModalProps) {
  const body = useMemo(() => (message ? plainBody(message) : ""), [message]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="3" style={{ maxWidth: "min(720px, 94vw)", maxHeight: "min(90vh, 900px)" }}>
        {message ? (
          <>
            <Dialog.Title style={{ marginBottom: "var(--space-2)" }}>
              {message.subject?.trim() || "(no subject)"}
            </Dialog.Title>
            <Dialog.Description size="2" color="gray" mb="3">
              {message.direction === "INBOUND" ? "Inbound" : "Outbound"} · {message.dateLabel}
            </Dialog.Description>
            <Flex direction="column" gap="2" mb="3">
              <Text size="2">
                <Strong>From:</Strong> {message.from}
              </Text>
              <Text size="2">
                <Strong>To:</Strong> {message.to}
              </Text>
              {message.cc && message.cc !== "-" ? (
                <Text size="2">
                  <Strong>Cc:</Strong> {message.cc}
                </Text>
              ) : null}
            </Flex>
            <Separator size="4" mb="3" />
            <ScrollArea type="hover" scrollbars="vertical" style={{ maxHeight: "min(52vh, 520px)" }}>
              <Box pr="2">
                <Text as="div" size="2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {body}
                </Text>
              </Box>
            </ScrollArea>
            <Flex justify="between" align="center" gap="3" mt="4" wrap="wrap">
              {threadPageHref ? (
                <Button asChild variant="soft" color="gray" size="2">
                  <NextLink href={threadPageHref} target="_blank" rel="noopener noreferrer">
                    Open thread page
                  </NextLink>
                </Button>
              ) : (
                <span />
              )}
              <Dialog.Close>
                <Button variant="solid" size="2">
                  Close
                </Button>
              </Dialog.Close>
            </Flex>
          </>
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
