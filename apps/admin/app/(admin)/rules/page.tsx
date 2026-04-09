import { prisma } from "@gmail-agent/db";
import { Box, Button, Card, Flex, Heading, Separator, Table, Text, TextArea, TextField } from "@radix-ui/themes";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../(protected)/require-admin";

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

export default async function RulesPage() {
  const session = await requireAdmin();
  const userId = session.user.id;

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, email: true },
  });

  async function createRuleAction(formData: FormData) {
    "use server";

    const sessionForAction = await requireAdmin();
    const actionUserId = sessionForAction.user.id;
    const mailboxForAction = await prisma.gmailMailbox.findFirst({
      where: { userId: actionUserId, provider: "GMAIL" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (!mailboxForAction) {
      throw new Error("Connect Gmail first to create rules.");
    }

    const name = String(formData.get("name") || "").trim();
    const actionType = String(formData.get("actionType") || "").trim();
    const priorityRaw = Number(String(formData.get("priority") || "100"));
    const isActive = parseBoolean(formData.get("isActive"));
    const stopProcessing = parseBoolean(formData.get("stopProcessing"));
    const conditionsText = String(formData.get("conditionsJson") || "{}").trim();
    const actionConfigText = String(formData.get("actionConfigJson") || "{}").trim();

    if (!name) throw new Error("Rule name is required.");
    if (!actionType) throw new Error("Action type is required.");

    let conditionsJson = {};
    let actionConfigJson = {};

    try {
      conditionsJson = conditionsText ? JSON.parse(conditionsText) : {};
    } catch {
      throw new Error("conditionsJson must be valid JSON.");
    }

    try {
      actionConfigJson = actionConfigText ? JSON.parse(actionConfigText) : {};
    } catch {
      throw new Error("actionConfigJson must be valid JSON.");
    }

    await prisma.gmailRule.create({
      data: {
        mailboxId: mailboxForAction.id,
        name,
        priority: Number.isFinite(priorityRaw) ? priorityRaw : 100,
        isActive,
        conditionsJson,
        actionType,
        actionConfigJson,
        stopProcessing,
      },
    });

    revalidatePath("/rules");
  }

  const rules = mailbox
    ? await prisma.gmailRule.findMany({
        where: { mailboxId: mailbox.id },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <Flex direction="column" gap="5">
      <Box>
        <Heading size="6">Rules</Heading>
        <Text color="gray" size="2">
          Create rule-based decisions for Gmail threads.
        </Text>
        <Text color="gray" size="2" style={{ display: "block", marginTop: 4 }}>
          {mailbox ? `Connected mailbox: ${mailbox.email}` : "No connected mailbox. Connect Gmail first."}
        </Text>
      </Box>

      <Card size="3">
        <form action={createRuleAction}>
          <Flex direction="column" gap="3">
            <Heading size="4">Add rule</Heading>

            <Text size="2">Name</Text>
            <TextField.Root name="name" placeholder="Pricing follow-up -> draft reply" required />

            <Flex gap="3">
              <Box style={{ flex: 1 }}>
                <Text size="2">Action type</Text>
                <TextField.Root name="actionType" placeholder="draft_reply" required />
              </Box>
              <Box style={{ width: 140 }}>
                <Text size="2">Priority</Text>
                <TextField.Root name="priority" type="number" defaultValue="100" />
              </Box>
            </Flex>

            <Text size="2">Conditions JSON</Text>
            <TextArea
              name="conditionsJson"
              rows={6}
              defaultValue={`{
  "intent": "pricing",
  "replyNeeded": "yes",
  "hasUnrepliedInbound": true
}`}
            />

            <Text size="2">Action config JSON</Text>
            <TextArea
              name="actionConfigJson"
              rows={4}
              defaultValue={`{
  "tone": "professional",
  "maxWords": 140
}`}
            />

            <Flex gap="4" align="center">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="isActive" defaultChecked />
                <Text size="2">Active</Text>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="stopProcessing" />
                <Text size="2">Stop processing after this rule</Text>
              </label>
            </Flex>

            <Button type="submit" disabled={!mailbox}>
              Create rule
            </Button>
          </Flex>
        </form>
      </Card>

      <Card size="3">
        <Flex direction="column" gap="3">
          <Heading size="4">Existing rules</Heading>
          <Separator size="4" />
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Priority</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Active</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Stop</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rules.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5}>
                    <Text color="gray">No rules yet.</Text>
                  </Table.Cell>
                </Table.Row>
              ) : (
                rules.map((rule) => (
                  <Table.Row key={rule.id}>
                    <Table.Cell>{rule.name}</Table.Cell>
                    <Table.Cell>{rule.priority}</Table.Cell>
                    <Table.Cell>{rule.actionType}</Table.Cell>
                    <Table.Cell>{rule.isActive ? "Yes" : "No"}</Table.Cell>
                    <Table.Cell>{rule.stopProcessing ? "Yes" : "No"}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Flex>
      </Card>
    </Flex>
  );
}

