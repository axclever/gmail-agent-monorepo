import { prisma } from "@gmail-agent/db";
import { requireAdmin } from "../(protected)/require-admin";
import { RulesPanel } from "./rules-panel";

export default async function RulesPage() {
  const session = await requireAdmin();
  const userId = session.user.id;

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, email: true },
  });

  const rules = mailbox
    ? await prisma.gmailRule.findMany({
        where: { mailboxId: mailbox.id },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          ruleKey: true,
          name: true,
          enabled: true,
          priority: true,
          version: true,
          stopProcessing: true,
          createdAt: true,
          conditions: true,
          actions: true,
        },
      })
    : [];

  const emailTemplates = mailbox
    ? await prisma.gmailEmailTemplate.findMany({
        where: { mailboxId: mailbox.id },
        select: { templateKey: true, name: true, subject: true, body: true },
        orderBy: { templateKey: "asc" },
      })
    : [];

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        width: "100%",
      }}
    >
      <RulesPanel rules={rules} mailboxConnected={!!mailbox} emailTemplates={emailTemplates} />
    </main>
  );
}
