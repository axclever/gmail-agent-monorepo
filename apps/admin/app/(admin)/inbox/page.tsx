import Link from "next/link";
import { Badge, Box, Button, Card, Flex, Heading, Select, Text, TextField } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { getThreadDetail, getThreadsList } from "../threads-data";
import { ThreadDetailCard } from "../thread-detail-card";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pick(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function fmtDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = pick(params.q);
  const priority = pick(params.priority);
  const replyNeeded = pick(params.replyNeeded);
  const selectedThreadId = pick(params.threadId);

  const threads = await getThreadsList({ q, priority, replyNeeded });

  const selectedId = selectedThreadId || threads[0]?.id;
  const detail = selectedId ? await getThreadDetail(selectedId) : null;
  const totalThreads = threads.length;
  const selectedThreadMessages =
    threads.find((t) => t.id === selectedId)?._count.messages ?? detail?.thread.messages?.length ?? 0;
  const panelStyle = {
    height: "70vh",
    overflowY: "auto" as const,
    paddingBlock: "0.25rem",
  };

  return (
    <main>
      <Heading size="7" style={{ marginBottom: "0.75rem" }}>
        Inbox
      </Heading>

      <Card size="3" style={{ marginBottom: 12 }}>
        <form>
          <Flex gap="3" align="end" wrap="wrap">
            <Box style={{ minWidth: 260 }}>
              <Text size="1" color="gray" style={{ display: "block", marginBottom: 6 }}>
                Search
              </Text>
              <TextField.Root
                name="q"
                defaultValue={q || ""}
                placeholder="subject / snippet..."
                size="2"
              />
            </Box>
            <Box style={{ minWidth: 170 }}>
              <Text size="1" color="gray" style={{ display: "block", marginBottom: 6 }}>
                Priority
              </Text>
              <Select.Root name="priority" defaultValue={priority || "ANY"}>
                <Select.Trigger variant="surface" style={{ minHeight: 32 }} />
                <Select.Content>
                  <Select.Item value="ANY">Any</Select.Item>
                  <Select.Item value="HIGH">HIGH</Select.Item>
                  <Select.Item value="MEDIUM">MEDIUM</Select.Item>
                  <Select.Item value="LOW">LOW</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>
            <Box style={{ minWidth: 170 }}>
              <Text size="1" color="gray" style={{ display: "block", marginBottom: 6 }}>
                Reply needed
              </Text>
              <Select.Root name="replyNeeded" defaultValue={replyNeeded || "ANY"}>
                <Select.Trigger variant="surface" style={{ minHeight: 32 }} />
                <Select.Content>
                  <Select.Item value="ANY">Any</Select.Item>
                  <Select.Item value="YES">YES</Select.Item>
                  <Select.Item value="NO">NO</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>
            <input type="hidden" name="threadId" value={selectedId || ""} />
            <Button type="submit" size="2">
              Apply
            </Button>
            <Button asChild variant="soft" color="gray" size="2">
              <Link href="/inbox">Reset</Link>
            </Button>
          </Flex>
        </form>
      </Card>

      <Flex gap="3" align="start">
        <Box style={{ width: "42%" }}>
          <Flex align="center" gap="2" style={{ marginBottom: "0.5rem" }}>
            <Heading size="3">Threads</Heading>
            <Badge variant="soft" color="gray">
              {totalThreads}
            </Badge>
          </Flex>
          <Box className="smart-scroll" style={panelStyle}>
            <Flex direction="column" gap="2">
              {threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/inbox?threadId=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}${priority ? `&priority=${priority}` : ""}${replyNeeded ? `&replyNeeded=${replyNeeded}` : ""}`}
                  style={{ textDecoration: "none" }}
                >
                  <Card
                    size="2"
                    style={{
                      border: selectedId === t.id ? "1px solid var(--indigo-8)" : undefined,
                    }}
                  >
                    <Text size="3" weight="medium">
                      {t.subject || "(no subject)"}
                    </Text>
                    <Text size="1" color="gray" style={{ display: "block", marginTop: 4 }}>
                      from: {t.messages[0]?.fromPerson?.email || "-"}
                    </Text>
                    <Text size="1" color="gray" style={{ display: "block" }}>
                      last: {fmtDate(t.lastMessageAt)}
                    </Text>
                    <Text size="1" color="gray" style={{ display: "block" }}>
                      count: {t._count.messages}
                    </Text>
                    <Flex align="center" gap="2" style={{ marginTop: 6 }}>
                      <Badge variant="soft" color="gray">
                        {t.summary.category || "uncategorized"}
                      </Badge>
                      <Badge variant="soft" color="gray">
                        {t.summary.intent || "no-intent"}
                      </Badge>
                    </Flex>
                    <Text size="1" color="gray" style={{ display: "block", marginTop: 6 }}>
                      reply: {t.summary.replyNeeded || "-"} | priority: {t.summary.priority || "-"}
                    </Text>
                    <Text size="1" color="gray" style={{ display: "block" }}>
                      processed: {t.summary.raw?.length ? "YES" : "NO"}
                    </Text>
                  </Card>
                </Link>
              ))}
              {threads.length === 0 && <Text color="gray">No threads found.</Text>}
            </Flex>
          </Box>
        </Box>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Flex align="center" gap="2" style={{ marginBottom: "0.5rem" }}>
            <Heading size="3">Messages</Heading>
            <Badge variant="soft" color="gray">
              {selectedThreadMessages}
            </Badge>
          </Flex>
          <Box className="smart-scroll" style={panelStyle}>
            <ThreadDetailCard detail={detail} showRawDebug={false} timelineMaxHeight="52vh" />
          </Box>
        </Box>
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
    </main>
  );
}

