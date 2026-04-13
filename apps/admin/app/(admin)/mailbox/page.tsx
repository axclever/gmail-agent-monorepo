import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Box, Button, Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { prisma } from "@gmail-agent/db";
import { requireAdmin } from "../(protected)/require-admin";
import { DefaultSendAsButtons } from "./default-send-as-buttons";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  });
}

export default async function MailboxPage() {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) {
    return null;
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      email: true,
      status: true,
      provider: true,
      googleAccountId: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      lastHistoryId: true,
      sendAsEmails: true,
      defaultSendAsEmail: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <main style={{ maxWidth: 720, width: "100%" }}>
      <Flex align="center" justify="between" gap="3" wrap="wrap" style={{ marginBottom: "1.25rem" }}>
        <Heading size="7" style={{ marginBottom: 0 }}>
          Gmail mailbox
        </Heading>
        <Button asChild variant="soft" color="gray" size="2">
          <Link href="/inbox">Back to inbox</Link>
        </Button>
      </Flex>

      {!mailbox ? (
        <Card size="3">
          <Text color="gray" mb="3">
            No Gmail account is connected for this user.
          </Text>
          <Button asChild size="2">
            <a href="/api/gmail/connect">Connect Gmail</a>
          </Button>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          <Card size="3">
            <Heading size="4" mb="3">
              Connection
            </Heading>
            <Flex direction="column" gap="2">
              <Row label="Address" value={mailbox.email} mono />
              <Row label="Status">
                <Badge color={mailbox.status === "ACTIVE" ? "green" : "gray"}>{mailbox.status}</Badge>
              </Row>
              <Row label="Provider" value={mailbox.provider} />
              <Row label="Google account id" value={mailbox.googleAccountId || "—"} mono />
              <Row label="Mailbox row id" value={mailbox.id} mono />
              <Row label="Token refresh by" value={fmtDate(mailbox.tokenExpiresAt)} />
              <Row
                label="Token status"
                value={
                  mailbox.tokenExpiresAt && new Date(mailbox.tokenExpiresAt).getTime() <= Date.now()
                    ? "Expired — use Refresh in the sidebar"
                    : "OK"
                }
              />
              <Row label="Last agent sync" value={fmtDate(mailbox.lastSyncedAt)} />
              <Row label="Gmail history id" value={mailbox.lastHistoryId || "—"} mono />
              <Row
                label="Default send alias"
                value={mailbox.defaultSendAsEmail || "Primary mailbox address"}
                mono
              />
              <Row label="Created" value={fmtDate(mailbox.createdAt)} />
              <Row label="Updated" value={fmtDate(mailbox.updatedAt)} />
            </Flex>
            <Separator size="4" my="4" />
            <Flex gap="2" wrap="wrap">
              <Button asChild size="2" variant="soft" color="gray">
                <a href="/api/gmail/connect">Re-authorize / refresh tokens</a>
              </Button>
            </Flex>
          </Card>

          <Card size="3">
            <Heading size="4" mb="2">
              Send as / aliases
            </Heading>
            <Text size="2" color="gray" mb="3" style={{ lineHeight: 1.5 }}>
              Addresses from Gmail “Send mail as” (accepted only). Used with the primary address to detect
              outbound messages. Updated when you connect and on each agent sync.
            </Text>
            {mailbox.sendAsEmails.length === 0 ? (
              <Text size="2" color="gray">
                No aliases stored yet. After connecting with the{" "}
                <Text as="span" weight="medium">
                  gmail.settings.basic
                </Text>{" "}
                scope, run sync or use “Re-authorize” above.
              </Text>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                {[mailbox.email, ...mailbox.sendAsEmails]
                  .map((email) => email.trim().toLowerCase())
                  .filter(Boolean)
                  .filter((email, idx, arr) => arr.indexOf(email) === idx)
                  .map((email) => (
                  <li key={email}>
                    <DefaultSendAsButtons
                      mailboxId={mailbox.id}
                      email={email}
                      isDefault={mailbox.defaultSendAsEmail?.trim().toLowerCase() === email}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Flex>
      )}
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <Flex align="start" gap="3" wrap="wrap" style={{ lineHeight: 1.45 }}>
      <Text size="2" color="gray" style={{ minWidth: 140, flexShrink: 0 }}>
        {label}
      </Text>
      {children ?? (
        <Text
          size="2"
          weight="medium"
          style={mono ? { fontFamily: "var(--font-mono, ui-monospace, monospace)", wordBreak: "break-all" } : undefined}
        >
          {value}
        </Text>
      )}
    </Flex>
  );
}
