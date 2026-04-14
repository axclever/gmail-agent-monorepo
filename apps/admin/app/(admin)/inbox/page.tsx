import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { getThreadDetail, getThreadsList } from "../threads-data";
import { ThreadDetailCard } from "../thread-detail-card";
import { formatThreadLastActivity } from "../thread-inbox-utils";
import { InboxSearchForm } from "./inbox-search-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pick(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
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
                const isSelected = selectedId === t.id;
                return (
                  <Link
                    key={t.id}
                    href={`/inbox?threadId=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Card
                      size="2"
                      style={
                        {
                          position: "relative",
                          borderRadius: "var(--radius-3)",
                          border: `2px solid var(${isSelected ? "--gray-9" : "--gray-6"})`,
                          // Surface Card also draws a 1px edge via ::after box-shadow; without this it stacks with `border`.
                          "--base-card-surface-box-shadow": "none",
                          paddingTop: "0.625rem",
                          paddingLeft: "0.75rem",
                          paddingRight: "0.75rem",
                          paddingBottom: "0.625rem",
                          background: !processed ? "var(--gray-3)" : undefined,
                        } as CSSProperties
                      }
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

