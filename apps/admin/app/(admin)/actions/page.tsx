import Link from "next/link";
import { prisma } from "@gmail-agent/db";
import { Badge, Box, Button, Card, Flex, Heading, Select, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { DeleteActionButton } from "./delete-action-button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pick(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function fmtDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const status = pick(params.status) || "ANY";
  const type = pick(params.type) || "ANY";

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId: session.user.id, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, email: true },
  });

  if (!mailbox) {
    return (
      <Card size="3">
        <Heading size="5">Actions</Heading>
        <Text color="gray" style={{ display: "block", marginTop: 8 }}>
          Connect Gmail first to see actions.
        </Text>
      </Card>
    );
  }

  const where = {
    decision: { mailboxId: mailbox.id },
    ...(status !== "ANY" ? { status } : {}),
    ...(type !== "ANY" ? { type } : {}),
  };

  const [actions, actionTypes, actionStatuses] = await Promise.all([
    prisma.gmailAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        decision: {
          select: {
            id: true,
            decisionType: true,
            status: true,
            reason: true,
            threadId: true,
          },
        },
      },
    }),
    prisma.gmailAction.findMany({
      where: { decision: { mailboxId: mailbox.id } },
      distinct: ["type"],
      select: { type: true },
      orderBy: { type: "asc" },
    }),
    prisma.gmailAction.findMany({
      where: { decision: { mailboxId: mailbox.id } },
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
    }),
  ]);

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Heading size="6">Actions</Heading>
        <Text color="gray" size="2">
          Logged actions for mailbox: {mailbox.email}
        </Text>
      </Box>

      <Card size="3">
        <form>
          <Flex gap="3" align="end" wrap="wrap">
            <Box style={{ minWidth: 180 }}>
              <Text size="1" color="gray" style={{ display: "block", marginBottom: 6 }}>
                Status
              </Text>
              <Select.Root name="status" defaultValue={status}>
                <Select.Trigger variant="surface" style={{ minHeight: 32 }} />
                <Select.Content>
                  <Select.Item value="ANY">Any</Select.Item>
                  {actionStatuses.map((s) => (
                    <Select.Item key={s.status} value={s.status}>
                      {s.status}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Box style={{ minWidth: 220 }}>
              <Text size="1" color="gray" style={{ display: "block", marginBottom: 6 }}>
                Type
              </Text>
              <Select.Root name="type" defaultValue={type}>
                <Select.Trigger variant="surface" style={{ minHeight: 32 }} />
                <Select.Content>
                  <Select.Item value="ANY">Any</Select.Item>
                  {actionTypes.map((t) => (
                    <Select.Item key={t.type} value={t.type}>
                      {t.type}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Button type="submit" size="2">
              Apply
            </Button>
            <Button asChild variant="soft" color="gray" size="2">
              <Link href="/actions">Reset</Link>
            </Button>
          </Flex>
        </form>
      </Card>

      <Card size="3">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Decision</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Thread</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Error</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="1%">Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {actions.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <Text color="gray">No actions found.</Text>
                </Table.Cell>
              </Table.Row>
            ) : (
              actions.map((action) => (
                <Table.Row key={action.id}>
                  <Table.Cell>{fmtDate(action.createdAt)}</Table.Cell>
                  <Table.Cell>{action.type}</Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft" color={action.status === "ERROR" ? "red" : "gray"}>
                      {action.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="1" color="gray">
                      {action.decision.decisionType}
                    </Text>
                    <Text size="1" style={{ display: "block" }}>
                      {action.decision.id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Link href={`/threads/${action.decision.threadId}`}>{action.decision.threadId.slice(0, 10)}...</Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="1" color={action.errorText ? "red" : "gray"}>
                      {action.errorText || "-"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <DeleteActionButton actionId={action.id} />
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Card>
    </Flex>
  );
}

