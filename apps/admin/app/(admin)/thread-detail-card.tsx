import { Badge, Box, Card, Flex, Heading, Link, Separator, Text } from "@radix-ui/themes";

type Detail = Awaited<ReturnType<typeof import("./threads-data").getThreadDetail>>;

function fmtDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function listEmails(
  recipients: Array<{
    type: "TO" | "CC" | "BCC";
    person: { email: string; name: string | null };
  }>,
  type: "TO" | "CC" | "BCC",
) {
  const rows = recipients.filter((r) => r.type === type).map((r) => r.person.email);
  return rows.length ? rows.join(", ") : "-";
}

export function ThreadDetailCard({
  detail,
  showRawDebug = true,
  timelineMaxHeight,
}: {
  detail: Detail;
  showRawDebug?: boolean;
  timelineMaxHeight?: string | number;
}) {
  if (!detail) {
    return (
      <Card size="3">
        <Text color="gray">Select a thread to view details.</Text>
      </Card>
    );
  }

  const { thread, summary } = detail;
  const participants = new Set<string>();
  for (const msg of thread.messages) {
    if (msg.fromPerson?.email) participants.add(msg.fromPerson.email);
    for (const r of msg.recipients) participants.add(r.person.email);
  }

  return (
    <Flex direction="column" gap="3">
      <Card size="3">
        <Flex direction="column" gap="2">
          <Heading size="4">{thread.subject || "(no subject)"}</Heading>
          <Text size="2" color="gray">
            Participants: {[...participants].join(", ") || "-"}
          </Text>
          <Text size="2" color="gray">
            Thread ID: {thread.gmailThreadId}
          </Text>
          <Text size="2" color="gray">
            Last activity: {fmtDate(thread.lastMessageAt)}
          </Text>
          <Text size="2" color="gray">
            Message count: {thread.messages.length}
          </Text>
        </Flex>
      </Card>

      <Card size="3">
        <Flex direction="column" gap="2">
          <Heading size="3">AI summary</Heading>
          <Text size="2">Category: {summary.category || "-"}</Text>
          <Text size="2">Intent: {summary.intent || "-"}</Text>
          <Text size="2">Priority: {summary.priority || "-"}</Text>
          <Text size="2">Reply needed: {summary.replyNeeded || "-"}</Text>
          <Text size="2" color="gray">
            Short summary: {thread.snippet || "-"}
          </Text>
        </Flex>
      </Card>

      <Card size="3">
        <Flex direction="column" gap="3">
          <Heading size="3">Timeline</Heading>
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
            {thread.messages.map((msg) => (
              <Box key={msg.id}>
                <Flex align="center" gap="2" justify="between">
                  <Flex align="center" gap="2">
                    <Badge color={msg.direction === "INBOUND" ? "blue" : "green"}>
                      {msg.direction.toLowerCase()}
                    </Badge>
                    <Text size="2" color="gray">
                      {fmtDate(msg.gmailInternalDate)}
                    </Text>
                  </Flex>
                  <Link href={`/threads/${thread.id}`}>open</Link>
                </Flex>
                <Text size="2" style={{ marginTop: 6 }}>
                  From: {msg.fromPerson?.email || "-"}
                </Text>
                <Text size="1" color="gray">
                  To: {listEmails(msg.recipients, "TO")}
                </Text>
                <Text size="1" color="gray">
                  Cc: {listEmails(msg.recipients, "CC")}
                </Text>
                <Text size="2" color="gray" style={{ marginTop: 6 }}>
                  {msg.snippet || msg.textBody || msg.htmlBody || "-"}
                </Text>
                <Separator size="4" style={{ marginTop: 10 }} />
              </Box>
            ))}
          </Box>
        </Flex>
      </Card>
      {showRawDebug ? (
        <Card size="3">
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Raw / debug</summary>
            <Box style={{ marginTop: 10 }}>
              {thread.messages.map((msg) => (
                <Box key={msg.id} style={{ marginBottom: 14 }}>
                  <Text size="1" color="gray">
                    Gmail message id: {msg.gmailMessageId}
                  </Text>
                  <Text size="1" color="gray" style={{ display: "block" }}>
                    Labels: {JSON.stringify(msg.labelIdsJson || [])}
                  </Text>
                  <Text size="1" color="gray" style={{ display: "block" }}>
                    Raw payload: {JSON.stringify(msg.rawPayloadJson || {})}
                  </Text>
                </Box>
              ))}
              <Text size="1" color="gray">
                Classification raw json: {JSON.stringify(summary.raw || [])}
              </Text>
            </Box>
          </details>
        </Card>
      ) : null}
    </Flex>
  );
}

