import { prisma } from "@gmail-agent/db";
import { Card, Heading, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  await requireAdmin();

  const people = await prisma.person.findMany({
    orderBy: { createdAt: "desc" },
  });

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
                <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {people.map((p) => (
                <Table.Row key={p.id}>
                  <Table.RowHeaderCell>{p.email}</Table.RowHeaderCell>
                  <Table.Cell>{p.id}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </main>
  );
}

