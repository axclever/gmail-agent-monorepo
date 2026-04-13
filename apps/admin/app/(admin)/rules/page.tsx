import { prisma } from "@gmail-agent/db";
import { requireAdmin } from "../(protected)/require-admin";
import { RulesPanel } from "./rules-panel";

export default async function RulesPage() {
  const session = await requireAdmin();
  const userId = session.user.id;

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, email: true, sendAsEmails: true, defaultSendAsEmail: true },
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

  const integrations = await prisma.integration.findMany({
    where: { userId, isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const sendAsOptions = mailbox
    ? [mailbox.email, ...mailbox.sendAsEmails]
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .filter((email, index, arr) => arr.indexOf(email) === index)
        .map((email) => ({ email }))
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
      <RulesPanel
        rules={rules}
        mailboxConnected={!!mailbox}
        emailTemplates={emailTemplates}
        integrations={integrations}
        sendAsOptions={sendAsOptions}
        defaultSendAsEmail={mailbox?.defaultSendAsEmail || null}
      />
    </main>
  );
}
