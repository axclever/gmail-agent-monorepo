import { prisma } from "@gmail-agent/db";
import { Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { requireAdmin } from "../(protected)/require-admin";

export const dynamic = "force-dynamic";

export default async function MainPage() {
  await requireAdmin();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalPeople, newPeopleLast7Days] = await Promise.all([
    prisma.person.count(),
    prisma.person.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    }),
  ]);

  return (
    <main>
      <Heading size="7" style={{ marginBottom: "0.25rem" }}>
        Overview
      </Heading>

      <Card size="4" style={{ maxWidth: 420, marginTop: "1.25rem" }}>
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between">
            <Text size="2" color="gray">
              People
            </Text>
            <Text size="2" color="gray">
              Total
            </Text>
          </Flex>

          <Text size="9" weight="bold" style={{ letterSpacing: "-0.03em", lineHeight: 1 }}>
            {totalPeople}
          </Text>

          <Separator size="4" />

          <Flex align="center" justify="between">
            <Text size="2" color="gray">
              New (last 7 days)
            </Text>
            <Text size="3" weight="medium">
              {newPeopleLast7Days}
            </Text>
          </Flex>
        </Flex>
      </Card>
    </main>
  );
}

