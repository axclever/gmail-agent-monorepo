import Link from "next/link";
import { Card, Heading, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { getPeopleList } from "../people-data";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function PeoplePage() {
  await requireAdmin();
  const people = await getPeopleList();

  return (
    <main>
      <Heading size="7" style={{ marginBottom: "0.25rem" }}>
        People
      </Heading>
      <Text size="2" color="gray" style={{ marginBottom: "1.25rem" }}>
        All people in database
      </Text>

      <Card size="4">
        <Text size="2" color="gray" style={{ marginBottom: "0.75rem" }}>
          People ({people.length})
        </Text>

        {people.length === 0 ? (
          <Text color="gray">No people found.</Text>
        ) : (
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>First seen</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Last seen</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Total messages</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Total threads</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {people.map((p) => (
                <Table.Row key={p.id}>
                  <Table.RowHeaderCell>
                    <Link href={`/people/${p.id}`}>{p.email}</Link>
                  </Table.RowHeaderCell>
                  <Table.Cell>{p.name || "-"}</Table.Cell>
                  <Table.Cell>{fmtDate(p.firstSeenAt)}</Table.Cell>
                  <Table.Cell>{fmtDate(p.lastSeenAt)}</Table.Cell>
                  <Table.Cell>{p.totalMessages}</Table.Cell>
                  <Table.Cell>{p.totalThreads}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </main>
  );
}

