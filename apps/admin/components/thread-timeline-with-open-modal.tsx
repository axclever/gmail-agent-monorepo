"use client";

import { Badge, Box, Button, Card, Flex, Separator, Text } from "@radix-ui/themes";
import { useCallback, useState } from "react";
import { FullMessageModal, type FullMessageContent } from "@/components/full-message-modal";

export type ThreadTimelineMessagePayload = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  fromEmail: string;
  toLine: string;
  ccLine: string;
  dateLabel: string;
  textBody?: string | null;
  htmlBody?: string | null;
  snippet?: string | null;
};

type Props = {
  variant: "inbox" | "detail";
  threadId: string;
  threadSubject?: string | null;
  messages: ThreadTimelineMessagePayload[];
  timelineMaxHeight?: string | number;
};

function toModalContent(
  threadSubject: string | null | undefined,
  msg: ThreadTimelineMessagePayload,
): FullMessageContent {
  return {
    id: msg.id,
    subject: threadSubject,
    from: msg.fromEmail,
    to: msg.toLine,
    cc: msg.ccLine,
    direction: msg.direction,
    dateLabel: msg.dateLabel,
    textBody: msg.textBody,
    htmlBody: msg.htmlBody,
  };
}

export function ThreadTimelineWithOpenModal({
  variant,
  threadId,
  threadSubject,
  messages,
  timelineMaxHeight,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FullMessageContent | null>(null);

  const openMessage = useCallback(
    (msg: ThreadTimelineMessagePayload) => {
      setActive(toModalContent(threadSubject, msg));
      setOpen(true);
    },
    [threadSubject],
  );

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setActive(null);
  }, []);

  const previewText = (msg: ThreadTimelineMessagePayload) =>
    msg.snippet?.trim() || msg.textBody?.trim() || msg.htmlBody?.trim() || "—";

  const threadHref = `/threads/${threadId}`;

  const list =
    variant === "inbox" ? (
      <Flex direction="column" gap="2">
        {messages.map((msg) => (
          <Card key={msg.id} size="2">
            <Flex justify="between" align="center" gap="2" wrap="nowrap">
              <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
                <Badge
                  color={msg.direction === "INBOUND" ? "blue" : "green"}
                  style={{ flexShrink: 0 }}
                >
                  {msg.direction.toLowerCase()}
                </Badge>
                <Text size="2" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  from: {msg.fromEmail}
                </Text>
              </Flex>
              <Text
                size="1"
                color="gray"
                style={{
                  flexShrink: 0,
                  lineHeight: 1.35,
                  whiteSpace: "nowrap",
                  textAlign: "right",
                }}
              >
                {msg.dateLabel}
              </Text>
            </Flex>
            <Text size="1" color="gray" style={{ display: "block", marginTop: 6, lineHeight: 1.45 }}>
              To: {msg.toLine}
            </Text>
            <Text size="2" color="gray" style={{ marginTop: 8, display: "block", lineHeight: 1.45 }}>
              {previewText(msg)}
            </Text>
            <Flex justify="end" style={{ marginTop: 6 }}>
              <Button type="button" variant="ghost" size="1" highContrast onClick={() => openMessage(msg)}>
                open
              </Button>
            </Flex>
          </Card>
        ))}
      </Flex>
    ) : (
      <>
        {messages.map((msg) => (
          <Box key={msg.id}>
            <Flex align="center" gap="2" justify="between">
              <Flex align="center" gap="2">
                <Badge color={msg.direction === "INBOUND" ? "blue" : "green"}>
                  {msg.direction.toLowerCase()}
                </Badge>
                <Text size="2" color="gray">
                  {msg.dateLabel}
                </Text>
              </Flex>
              <Button type="button" variant="ghost" size="1" highContrast onClick={() => openMessage(msg)}>
                open
              </Button>
            </Flex>
            <Text size="2" style={{ marginTop: 6 }}>
              From: {msg.fromEmail}
            </Text>
            <Text size="1" color="gray">
              To: {msg.toLine}
            </Text>
            <Text size="1" color="gray">
              Cc: {msg.ccLine}
            </Text>
            <Text size="2" color="gray" style={{ marginTop: 6 }}>
              {previewText(msg)}
            </Text>
            <Separator size="4" style={{ marginTop: 10 }} />
          </Box>
        ))}
      </>
    );

  return (
    <>
      {variant === "inbox" ? (
        <Box
          className="smart-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {list}
        </Box>
      ) : (
        <Box
          style={
            timelineMaxHeight
              ? {
                  maxHeight: timelineMaxHeight,
                  overflowY: "auto",
                  paddingRight: 2,
                }
              : undefined
          }
          className={timelineMaxHeight ? "smart-scroll" : undefined}
        >
          {list}
        </Box>
      )}
      <FullMessageModal open={open} onOpenChange={onOpenChange} message={active} threadPageHref={threadHref} />
    </>
  );
}
