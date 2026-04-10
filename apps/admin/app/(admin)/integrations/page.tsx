import { prisma } from "@gmail-agent/db";
import { Box, Card, Flex, Heading, Table, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";
import { AddIntegrationDialog } from "./add-integration-dialog";
import { EditIntegrationDialog } from "./edit-integration-dialog";
import { IntegrationDeleteButton } from "./integration-delete-button";

export const dynamic = "force-dynamic";

function formatConfigPreview(value: unknown): string {
  if (value == null) return "—";
  try {
    return JSON.stringify(value, null, 0);
  } catch {
    return String(value);
  }
}

function hasStoredSecrets(encryptedSecretJson: unknown): boolean {
  if (encryptedSecretJson == null) return false;
  if (typeof encryptedSecretJson === "string") return encryptedSecretJson.length > 0;
  if (typeof encryptedSecretJson === "object") return Object.keys(encryptedSecretJson as object).length > 0;
  return true;
}

export default async function IntegrationsPage() {
  const session = await requireAdmin();
  const userId = session.user.id;

  const integrations = await prisma.integration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      name: true,
      isActive: true,
      configJson: true,
      encryptedSecretJson: true,
      createdAt: true,
    },
  });

  return (
    <Flex direction="column" gap="5">
      <Flex justify="between" align="start" wrap="wrap" gap="3">
        <Box>
          <Heading size="6">Integrations</Heading>
          <Text color="gray" size="2">
            HTTP/API gateways, SMTP, and similar. Secrets are encrypted at rest with{" "}
            <Text as="span" weight="medium">
              MASTER_ENCRYPTION_KEY
            </Text>
            .
          </Text>
        </Box>
        <AddIntegrationDialog />
      </Flex>

      <Card size="3">
        {integrations.length === 0 ? (
          <Text color="gray">No integrations yet. Add one to get started.</Text>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Active</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Config</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Secrets</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ width: 160 }}>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {integrations.map((row) => {
                const hasSecrets = hasStoredSecrets(row.encryptedSecretJson);
                return (
                  <Table.Row key={row.id}>
                    <Table.Cell>
                      <Text weight="medium">{row.name}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{row.type}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{row.isActive ? "yes" : "no"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        size="1"
                        style={{
                          fontFamily: "var(--font-mono)",
                          maxWidth: 280,
                          display: "block",
                          wordBreak: "break-word",
                        }}
                      >
                        {formatConfigPreview(row.configJson)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {hasSecrets ? "encrypted" : "—"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {new Date(row.createdAt).toLocaleString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2" wrap="wrap" align="center">
                        <EditIntegrationDialog integrationId={row.id} />
                        <IntegrationDeleteButton id={row.id} name={row.name} />
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </Flex>
  );
}
