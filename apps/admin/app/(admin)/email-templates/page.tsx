import { Card, Heading, Text } from "@radix-ui/themes";
import { prisma } from "@gmail-agent/db";
import { requireAdmin } from "../(protected)/require-admin";
import { EmailTemplatesPanel } from "./email-templates-panel";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const session = await requireAdmin();
  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId: session.user.id, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, email: true },
  });

  if (!mailbox) {
    return (
      <Card size="3">
        <Heading size="5">Email templates</Heading>
        <Text color="gray" style={{ display: "block", marginTop: 8 }}>
          Connect Gmail first to manage templates.
        </Text>
      </Card>
    );
  }

  const rows = await prisma.gmailEmailTemplate.findMany({
    where: { mailboxId: mailbox.id },
    orderBy: { templateKey: "asc" },
    select: {
      id: true,
      templateKey: true,
      name: true,
      subject: true,
      body: true,
    },
  });

  const templates = rows.map((t) => ({
    id: t.id,
    templateKey: t.templateKey,
    name: t.name,
    subject: t.subject,
    body: t.body,
  }));

  return (
    <EmailTemplatesPanel
      templates={templates}
      mailboxConnected
      mailboxEmail={mailbox.email}
    />
  );
}
