"use client";

import { Badge, Box, Button, Dialog, Flex, ScrollArea, Separator, Text } from "@radix-ui/themes";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previewRuleConditionMatches } from "./actions";
import { conditionsToJson, type ConditionRowState } from "./rule-form-model";
import { formatThreadLastActivity } from "../thread-inbox-utils";

const DEBOUNCE_MS = 650;

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      scannedCount: number;
      matchedCount: number;
      previewThreads: Awaited<ReturnType<typeof previewRuleConditionMatches>>["previewThreads"];
    };

export function ConditionMatchesPreview({
  mailboxConnected,
  disabled,
  conditionRows,
}: {
  mailboxConnected: boolean;
  disabled: boolean;
  conditionRows: ConditionRowState[];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const serializedKey = useMemo(() => {
    try {
      return JSON.stringify(conditionsToJson(conditionRows));
    } catch {
      return "__invalid__";
    }
  }, [conditionRows]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runFetch = useCallback(async () => {
    if (!mailboxConnected || serializedKey === "__invalid__") {
      setState({ status: "idle" });
      return;
    }
    let conditions: unknown[];
    try {
      conditions = JSON.parse(serializedKey) as unknown[];
      if (!Array.isArray(conditions)) throw new Error("Conditions must be an array.");
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Invalid conditions.",
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const result = await previewRuleConditionMatches(conditions);
      setState({
        status: "ok",
        scannedCount: result.scannedCount,
        matchedCount: result.matchedCount,
        previewThreads: result.previewThreads,
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Preview failed.",
      });
    }
  }, [mailboxConnected, serializedKey]);

  useEffect(() => {
    if (!mailboxConnected) {
      setState({ status: "idle" });
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runFetch();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mailboxConnected, serializedKey, runFetch]);

  const summaryLine =
    state.status === "ok" ? (
      <Text size="2" color="gray">
        <Text weight="medium" style={{ color: "var(--gray-12)" }}>
          {state.matchedCount}
        </Text>{" "}
        {state.matchedCount === 1 ? "thread matches" : "threads match"} these conditions among the{" "}
        <Text weight="medium" style={{ color: "var(--gray-12)" }}>
          {state.scannedCount}
        </Text>{" "}
        most recent (by activity).
      </Text>
    ) : state.status === "loading" ? (
      <Text size="2" color="gray">
        Counting matches…
      </Text>
    ) : state.status === "error" ? (
      <Text size="2" color="red">
        {state.message}
      </Text>
    ) : (
      <Text size="2" color="gray">
        Connect Gmail to preview how many threads match.
      </Text>
    );

  return (
    <Box style={{ marginTop: 10 }}>
      <Separator size="4" />
      <Flex direction="column" gap="2" style={{ marginTop: 12 }}>
        <Text size="2" weight="medium">
          Match preview
        </Text>
        {summaryLine}
        <Flex gap="2" align="center" wrap="wrap">
          <Button
            type="button"
            variant="soft"
            color="gray"
            size="2"
            disabled={disabled || !mailboxConnected || state.status === "loading"}
            onClick={() => void runFetch()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            color="gray"
            size="2"
            disabled={disabled || !mailboxConnected || state.status !== "ok" || state.matchedCount === 0}
            onClick={() => setOpen(true)}
          >
            View thread list
          </Button>
        </Flex>
      </Flex>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content
          size="3"
          style={{ maxWidth: "min(640px, 96vw)", maxHeight: "min(88vh, 720px)" }}
        >
          <Dialog.Title>Matching threads</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            {state.status === "ok" ? (
              <>
                Showing up to {state.previewThreads.length} of {state.matchedCount} matches (scanned{" "}
                {state.scannedCount} threads).
              </>
            ) : (
              "—"
            )}
          </Dialog.Description>

          {state.status === "ok" ? (
            <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: "min(58vh, 520px)" }}>
              <Flex direction="column" gap="3" pr="2">
                {state.previewThreads.map((t) => (
                  <Box
                    key={t.id}
                    p="3"
                    style={{
                      borderRadius: "var(--radius-3)",
                      border: "1px solid var(--gray-6)",
                      background: "var(--gray-a2)",
                    }}
                  >
                    <Text size="3" weight="medium" style={{ lineHeight: 1.35 }}>
                      {t.subject?.trim() || "(no subject)"}
                    </Text>
                    <Text size="2" color="gray" style={{ display: "block", marginTop: 6, lineHeight: 1.45 }}>
                      Last email from:{" "}
                      <Text size="2" style={{ color: "var(--gray-12)" }}>
                        {t.lastEmailFrom}
                      </Text>
                    </Text>
                    <Flex gap="2" wrap="wrap" style={{ marginTop: 8 }}>
                      {t.lastDirection ? (
                        <Badge size="1" variant="soft" color="gray">
                          {String(t.lastDirection).toLowerCase()}
                        </Badge>
                      ) : null}
                      {t.threadIntent ? (
                        <Badge size="1" variant="soft" color="gray">
                          intent: {t.threadIntent}
                        </Badge>
                      ) : null}
                      {t.lastMessageAtIso ? (
                        <Text size="1" color="gray" style={{ alignSelf: "center" }}>
                          {formatThreadLastActivity(new Date(t.lastMessageAtIso))}
                        </Text>
                      ) : null}
                    </Flex>
                    {t.snippet ? (
                      <Text
                        size="1"
                        color="gray"
                        style={{
                          display: "block",
                          marginTop: 8,
                          lineHeight: 1.45,
                          wordBreak: "break-word",
                        }}
                      >
                        {t.snippet}
                      </Text>
                    ) : null}
                    <Box style={{ marginTop: 10 }}>
                      <Link
                        href={`/inbox?threadId=${encodeURIComponent(t.id)}`}
                        style={{ fontSize: 13, color: "var(--accent-11)", textDecoration: "underline" }}
                      >
                        Open in inbox
                      </Link>
                    </Box>
                  </Box>
                ))}
              </Flex>
            </ScrollArea>
          ) : null}

          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray">
                Close
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
