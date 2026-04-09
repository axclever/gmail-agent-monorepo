import { Heading, Text } from "@radix-ui/themes";
import { requireAdmin } from "../../(protected)/require-admin";
import { getThreadDetail } from "../../threads-data";
import { ThreadDetailCard } from "../../thread-detail-card";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  await requireAdmin();
  const { threadId } = await params;
  const detail = await getThreadDetail(threadId);

  return (
    <main>
      <Heading size="7" style={{ marginBottom: "0.25rem" }}>
        Thread detail
      </Heading>
      <Text size="2" color="gray" style={{ marginBottom: "1rem", display: "block" }}>
        Full view for selected thread
      </Text>
      <ThreadDetailCard detail={detail} />
    </main>
  );
}

