import Link from "next/link";
import { Box, Card, Heading, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../../(protected)/require-admin";
import { getPersonDetail } from "../../people-data";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  await requireAdmin();
  const { personId } = await params;
  const detail = await getPersonDetail(personId);

  if (!detail) {
    return (
      <main>
        <Heading size="7">Person not found</Heading>
      </main>
    );
  }

  const { person, threads, messages } = detail;

  return (
    <main>
      <Heading size="7" style={{ marginBottom: "0.25rem" }}>
        {person.email}
      </Heading>
      <Text size="2" color="gray" style={{ marginBottom: "1rem", display: "block" }}>
        {person.name || "-"} | first seen: {fmtDate(person.firstSeenAt)} | last seen:{" "}
        {fmtDate(person.lastSeenAt)}
      </Text>

      <Card size="3" style={{ marginBottom: "1rem" }}>
        <Heading size="4" style={{ marginBottom: "0.75rem" }}>
          Related threads ({threads.length})
        </Heading>
        {threads.length === 0 ? (
          <Text color="gray">No related threads.</Text>
        ) : (
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Subject</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Last activity</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {threads.map((t) => (
                <Table.Row key={t.id}>
                  <Table.RowHeaderCell>
                    <Link href={`/threads/${t.id}`}>{t.subject || "(no subject)"}</Link>
                  </Table.RowHeaderCell>
                  <Table.Cell>{fmtDate(t.lastMessageAt)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>

      <Card size="3">
        <Heading size="4" style={{ marginBottom: "0.75rem" }}>
          Related messages ({messages.length})
        </Heading>
        {messages.length === 0 ? (
          <Text color="gray">No related messages.</Text>
        ) : (
          <Box style={{ maxHeight: "50vh", overflowY: "auto" }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Direction</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Subject</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Thread</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {messages.map((m) => (
                  <Table.Row key={m.id}>
                    <Table.Cell>{m.direction}</Table.Cell>
                    <Table.RowHeaderCell>{m.subject || "(no subject)"}</Table.RowHeaderCell>
                    <Table.Cell>
                      <Link href={`/threads/${m.thread.id}`}>{m.thread.subject || "(thread)"}</Link>
                    </Table.Cell>
                    <Table.Cell>{fmtDate(m.gmailInternalDate)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Card>
    </main>
  );
}

