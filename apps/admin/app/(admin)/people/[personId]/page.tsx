import Link from "next/link";
import { Card, Flex, Heading, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../../(protected)/require-admin";
import { getPersonDetail } from "../../people-data";
import { formatThreadLastActivity } from "../../thread-inbox-utils";
import { AddPersonAttributeModal } from "./add-person-attribute-modal";

export const dynamic = "force-dynamic";

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

  const { person, threads } = detail;
  const personAttributes =
    person.customFieldsJson && typeof person.customFieldsJson === "object"
      ? Object.entries(person.customFieldsJson as Record<string, unknown>).filter(
          ([key]) => key.trim().length > 0,
        )
      : [];

  return (
    <main>
      <Flex gap="5" align="start" style={{ width: "100%" }}>
        <section style={{ flex: 1, minWidth: 0 }}>
          <Heading size="5" style={{ marginBottom: "0.75rem" }}>
            Related threads ({threads.length})
          </Heading>
          {threads.length === 0 ? (
            <Text color="gray">No related threads.</Text>
          ) : (
            <Table.Root>
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
                    <Table.Cell>{formatThreadLastActivity(t.lastMessageAt)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </section>

        <aside style={{ width: 320, maxWidth: "34%" }}>
          <Card size="3">
            <Heading size="4" style={{ marginBottom: "0.9rem" }}>
              Person details
            </Heading>

            <Text size="2" weight="medium" color="gray">
              Name
            </Text>
            <Text size="3" style={{ marginBottom: "0.85rem", display: "block" }}>
              {person.name || "-"}
            </Text>

            <Text size="2" weight="medium" color="gray">
              Email
            </Text>
            <Text size="3" style={{ marginBottom: "1rem", display: "block" }}>
              {person.email}
            </Text>

            <Text size="2" weight="medium" color="gray">
              First seen
            </Text>
            <Text size="3" style={{ marginBottom: "0.75rem", display: "block" }}>
              {formatThreadLastActivity(person.firstSeenAt)}
            </Text>

            <Text size="2" weight="medium" color="gray">
              Last activity
            </Text>
            <Text size="3" style={{ marginBottom: "1rem", display: "block" }}>
              {formatThreadLastActivity(person.lastSeenAt)}
            </Text>

            <Text size="2" weight="medium" color="gray">
              Attributes
            </Text>
            <Flex direction="column" gap="2" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
              {personAttributes.length === 0 ? (
                <Text size="2" color="gray">
                  No attributes yet.
                </Text>
              ) : (
                personAttributes.map(([key, value]) => (
                  <Flex key={key} justify="between" gap="3">
                    <Text size="2" color="gray">
                      {key}
                    </Text>
                    <Text size="2">{String(value ?? "-")}</Text>
                  </Flex>
                ))
              )}
            </Flex>

            <AddPersonAttributeModal personId={person.id} />
          </Card>
        </aside>
      </Flex>
    </main>
  );
}

