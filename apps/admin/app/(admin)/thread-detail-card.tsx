import NextLink from "next/link";
import { Badge, Box, Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { ThreadTimelineWithOpenModal } from "@/components/thread-timeline-with-open-modal";
import {
  formatRecipientEmailList,
  formatRulesSummaryLine,
  formatThreadLastActivity,
  getThreadAnalysisProseSummary,
  isRulesStyleThreadSummary,
  sortMessagesNewestFirst,
} from "./thread-inbox-utils";

type Detail = Awaited<ReturnType<typeof import("./threads-data").getThreadDetail>>;

function fmtDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function ThreadDetailCard({
  detail,
  showRawDebug = true,
  timelineMaxHeight,
  inboxLayout = false,
}: {
  detail: Detail;
  showRawDebug?: boolean;
  timelineMaxHeight?: string | number;
  inboxLayout?: boolean;
}) {
  if (!detail) {
    return (
      <Card size="3">
        <Text color="gray">Select a thread to view details.</Text>
      </Card>
    );
  }

  const { thread, summary } = detail;
  const timelineMessages = sortMessagesNewestFirst(thread.messages);
  const participants = new Set<string>();
  for (const msg of thread.messages) {
    if (msg.fromPerson?.email) participants.add(msg.fromPerson.email);
    for (const r of msg.recipients) participants.add(r.person.email);
  }

  if (inboxLayout) {
    const participantByEmail = new Map<string, { id: string; email: string }>();
    for (const msg of thread.messages) {
      const fp = msg.fromPerson;
      if (fp?.id && fp.email) {
        const key = fp.email.toLowerCase();
        if (!participantByEmail.has(key)) participantByEmail.set(key, { id: fp.id, email: fp.email });
      }
      for (const r of msg.recipients) {
        const p = r.person;
        if (p?.id && p.email) {
          const key = p.email.toLowerCase();
          if (!participantByEmail.has(key)) participantByEmail.set(key, { id: p.id, email: p.email });
        }
      }
    }
    const participantList = [...participantByEmail.values()].sort((a, b) =>
      a.email.localeCompare(b.email, undefined, { sensitivity: "base" }),
    );

    const rulesLine =
      formatRulesSummaryLine(summary) ||
      (isRulesStyleThreadSummary(thread.summary) ? thread.summary!.trim() : null) ||
      "—";

    const proseSummary = getThreadAnalysisProseSummary(thread.threadAnalysisJson);
    const rawThreadSummary = thread.summary?.trim();
    const threadSummaryText =
      proseSummary ||
      (rawThreadSummary && !isRulesStyleThreadSummary(rawThreadSummary) ? rawThreadSummary : "") ||
      thread.snippet?.trim() ||
      "—";

    return (
      <Flex direction="column" gap="3" style={{ height: "100%", minHeight: 0 }}>
        <Card size="2" style={{ flexShrink: 0 }}>
          <Flex justify="between" align="start" gap="2" style={{ marginBottom: 6 }}>
            <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
              <Badge
                variant="soft"
                color="gray"
                size="1"
                radius="small"
                style={{
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: "1.65rem",
                  justifyContent: "center",
                }}
              >
                {thread.messages.length}
              </Badge>
              <Text
                size="3"
                weight="medium"
                style={{
                  flex: 1,
                  minWidth: 0,
                  lineHeight: 1.35,
                }}
              >
                {thread.subject || "(no subject)"}
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
              {formatThreadLastActivity(thread.lastMessageAt)}
            </Text>
          </Flex>
          <Text size="1" color="gray" style={{ display: "block", marginTop: 2, lineHeight: 1.45 }}>
            Participants:{" "}
            {participantList.length === 0 ? (
              "—"
            ) : (
              participantList.map((p, i) => (
                <span key={p.id}>
                  {i > 0 ? ", " : null}
                  <NextLink
                    href={`/people/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent-11)", textDecoration: "underline" }}
                  >
                    {p.email}
                  </NextLink>
                </span>
              ))
            )}
          </Text>
          <Text
            size="1"
            color="gray"
            style={{
              display: "block",
              marginTop: 6,
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {rulesLine}
          </Text>
          <Separator size="4" style={{ marginTop: 10 }} />
          <Text
            size="3"
            color="gray"
            style={{
              display: "block",
              marginTop: 10,
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {threadSummaryText}
          </Text>
        </Card>

        <Flex direction="column" gap="2" style={{ flex: 1, minHeight: 0 }}>
          <Heading size="3">Timeline</Heading>
          <ThreadTimelineWithOpenModal
            variant="inbox"
            threadId={thread.id}
            threadSubject={thread.subject}
            messages={timelineMessages.map((msg) => ({
              id: msg.id,
              direction: msg.direction,
              fromEmail: msg.fromPerson?.email ?? "—",
              toLine: formatRecipientEmailList(msg.recipients, "TO"),
              ccLine: formatRecipientEmailList(msg.recipients, "CC"),
              dateLabel: formatThreadLastActivity(msg.gmailInternalDate),
              textBody: msg.textBody,
              htmlBody: msg.htmlBody,
              snippet: msg.snippet,
            }))}
          />
        </Flex>
      </Flex>
    );
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
          <Text size="2">
            Reply needed:{" "}
            {thread.replyNeeded === true
              ? "true"
              : thread.replyNeeded === false
                ? "false"
                : summary.replyNeeded || "-"}
          </Text>
          <Text size="2">
            Action required:{" "}
            {thread.actionRequired === true
              ? "true"
              : thread.actionRequired === false
                ? "false"
                : "-"}
          </Text>
          <Text size="2">Template key: {summary.templateKey?.trim() ? summary.templateKey : "-"}</Text>
          <Text
            as="div"
            size="2"
            color="gray"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "visible" }}
          >
            Summary:{" "}
            {getThreadAnalysisProseSummary(thread.threadAnalysisJson) ||
              (thread.summary?.trim() && !isRulesStyleThreadSummary(thread.summary)
                ? thread.summary!.trim()
                : "") ||
              thread.snippet?.trim() ||
              "—"}
          </Text>
        </Flex>
      </Card>

      <Card size="3">
        <Flex direction="column" gap="3">
          <Heading size="3">Timeline</Heading>
          <ThreadTimelineWithOpenModal
            variant="detail"
            threadId={thread.id}
            threadSubject={thread.subject}
            timelineMaxHeight={timelineMaxHeight}
            messages={timelineMessages.map((msg) => ({
              id: msg.id,
              direction: msg.direction,
              fromEmail: msg.fromPerson?.email ?? "—",
              toLine: formatRecipientEmailList(msg.recipients, "TO"),
              ccLine: formatRecipientEmailList(msg.recipients, "CC"),
              dateLabel: fmtDate(msg.gmailInternalDate),
              textBody: msg.textBody,
              htmlBody: msg.htmlBody,
              snippet: msg.snippet,
            }))}
          />
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
