import { prisma } from "@gmail-agent/db";
import { Box, Card, Flex, Heading, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { CreatePublicApiTokenForm } from "./create-public-api-token-form";
import { PublicApiTokenDeleteButton } from "./public-api-token-delete-button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const userId = session.user.id;

  const tokens = await prisma.userApiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenHint: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return (
    <Flex direction="column" gap="5">
      <Box>
        <Heading size="6">Settings</Heading>
        <Text size="2" color="gray">
          Manage API tokens for public endpoints used by bots and external services.
        </Text>
      </Box>

      <Card size="3">
        <Flex direction="column" gap="4">
          <Box>
            <Heading size="4">Public API tokens</Heading>
            <Text size="2" color="gray">
              Use these tokens for requests to <code>/api/public/*</code>.
            </Text>
          </Box>

          <CreatePublicApiTokenForm />

          {tokens.length === 0 ? (
            <Text size="2" color="gray">
              No tokens yet.
            </Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Token hint</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Last used</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 120 }}>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tokens.map((t) => (
                  <Table.Row key={t.id}>
                    <Table.Cell>
                      <Text weight="medium">{t.name}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {t.tokenHint}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {new Date(t.createdAt).toLocaleString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "—"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <PublicApiTokenDeleteButton id={t.id} name={t.name} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
