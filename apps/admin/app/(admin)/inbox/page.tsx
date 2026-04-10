import Link from "next/link";
import { Badge, Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { getThreadDetail, getThreadsList } from "../threads-data";
import { ThreadDetailCard } from "../thread-detail-card";
import { InboxSearchForm } from "./inbox-search-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pick(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function formatThreadLastActivity(value: Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function isReplyRequired(replyNeeded: string | undefined): boolean {
  if (!replyNeeded?.trim()) return false;
  const v = replyNeeded.trim().toLowerCase();
  if (["no", "n", "false", "0", "none", "not needed", "not_needed", "not-needed"].includes(v)) {
    return false;
  }
  return ["yes", "y", "true", "1", "required", "needed", "reply_needed", "reply needed"].includes(v);
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = pick(params.q);
  const selectedThreadId = pick(params.threadId);

  const threads = await getThreadsList({ q });

  const qTrimmed = (q ?? "").trim();
  const hasSearch = qTrimmed.length > 0;
  const threadIds = new Set(threads.map((t) => t.id));
  const threadFromUrl =
    selectedThreadId && threadIds.has(selectedThreadId) ? selectedThreadId : undefined;
  const selectedId = threadFromUrl ?? (!hasSearch ? threads[0]?.id : undefined);
  const detail = selectedId ? await getThreadDetail(selectedId) : null;
  const scrollPanelStyle = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto" as const,
    paddingBlock: "0.25rem",
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        width: "100%",
      }}
    >
      <Flex align="center" gap="3" wrap="wrap" style={{ flexShrink: 0, marginBottom: "1rem" }}>
        <Flex align="center" gap="3" wrap="nowrap">
          <Heading size="7" style={{ marginBottom: 0, lineHeight: 1.1 }}>
            Inbox
          </Heading>
          <Badge
            variant="soft"
            color="gray"
            size="2"
            radius="medium"
            highContrast
            style={{
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              minWidth: "2.25rem",
              justifyContent: "center",
            }}
          >
            {threads.length}
          </Badge>
        </Flex>
        <InboxSearchForm defaultQuery={q ?? ""} />
      </Flex>

      <Flex gap="3" align="stretch" style={{ flex: 1, minHeight: 0 }}>
        <Box style={{ width: "36%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Box className="smart-scroll" style={scrollPanelStyle}>
            <Flex direction="column" gap="2">
              {threads.map((t) => {
                const processed = Boolean(t.summary.raw?.length);
                const replyRequired = isReplyRequired(t.summary.replyNeeded);
                const isSelected = selectedId === t.id;
                return (
                  <Link
                    key={t.id}
                    href={`/inbox?threadId=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Card
                      size="2"
                      style={{
                        position: "relative",
                        ...(isSelected
                          ? {
                              border: "1px solid var(--gray-6)",
                              borderRadius: "var(--radius-3)",
                              background: "var(--gray-3)",
                              paddingTop: "0.625rem",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              paddingBottom: replyRequired ? "2rem" : "0.625rem",
                            }
                          : {
                              ...(!processed ? { background: "var(--gray-3)" } : undefined),
                              ...(replyRequired ? { paddingBottom: "2rem" } : undefined),
                            }),
                      }}
                    >
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
                            {t._count.messages}
                          </Badge>
                          <Text
                            size="3"
                            weight="medium"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              lineHeight: 1.35,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {t.subject || "(no subject)"}
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
                          {formatThreadLastActivity(t.lastMessageAt)}
                        </Text>
                      </Flex>
                      <Text size="1" color="gray" style={{ display: "block", marginTop: 2 }}>
                        from: {t.messages[0]?.fromPerson?.email || "-"}
                      </Text>
                      <Flex align="center" gap="2" style={{ marginTop: 6 }}>
                        <Badge variant="soft" color="gray">
                          {t.summary.category || "uncategorized"}
                        </Badge>
                        <Badge variant="soft" color="gray">
                          {t.summary.intent || "no-intent"}
                        </Badge>
                      </Flex>
                      <Text
                        size="1"
                        color="gray"
                        style={{
                          display: "-webkit-box",
                          marginTop: 6,
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          lineHeight: 1.45,
                        }}
                      >
                        Short summary: {t.snippet?.trim() || "—"}
                      </Text>
                      {replyRequired ? (
                        <Box
                          style={{
                            position: "absolute",
                            bottom: "var(--space-2)",
                            right: "var(--space-2)",
                            backgroundColor: "var(--red-9)",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                            lineHeight: 1.25,
                            padding: "5px 10px",
                            borderRadius: "var(--radius-2)",
                          }}
                        >
                          action required
                        </Box>
                      ) : null}
                    </Card>
                  </Link>
                );
              })}
              {threads.length === 0 && <Text color="gray">No threads found.</Text>}
            </Flex>
          </Box>
        </Box>

        <Box
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <ThreadDetailCard detail={detail} showRawDebug={false} inboxLayout />
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

