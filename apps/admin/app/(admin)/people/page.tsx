import Link from "next/link";
import { Box, Flex, Heading, Table, Text } from "@radix-ui/themes";
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
    <Flex direction="column" gap="4">
      <Box>
        <Heading size="7">People</Heading>
        <Text size="2" color="gray">
          Contacts discovered from synced Gmail messages.
        </Text>
      </Box>
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
              <Table.ColumnHeaderCell justify="end">Total messages</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell justify="end">Total threads</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {people.map((p) => (
              <Table.Row key={p.id}>
                <Table.RowHeaderCell style={{ maxWidth: 320 }}>
                  <Link
                    href={`/people/${p.id}`}
                    style={{
                      display: "inline-block",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      verticalAlign: "bottom",
                    }}
                  >
                    {p.email}
                  </Link>
                </Table.RowHeaderCell>
                <Table.Cell>{p.name || "-"}</Table.Cell>
                <Table.Cell>{fmtDate(p.firstSeenAt)}</Table.Cell>
                <Table.Cell>{fmtDate(p.lastSeenAt)}</Table.Cell>
                <Table.Cell align="right">{p.totalMessages}</Table.Cell>
                <Table.Cell align="right">{p.totalThreads}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Flex>
  );
}

