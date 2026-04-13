"use server";

import { prisma } from "@gmail-agent/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../(protected)/require-admin";

export async function setDefaultSendAsEmail(mailboxId: string, email: string) {
  const session = await requireAdmin();
  const userId = session.user.id;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) throw new Error("Email is required.");

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: mailboxId, userId, provider: "GMAIL" },
    select: { id: true, email: true, sendAsEmails: true },
  });
  if (!mailbox) throw new Error("Mailbox not found.");

  const allowed = new Set(
    [mailbox.email, ...(mailbox.sendAsEmails || [])]
      .map((x) => String(x || "").trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowed.has(normalized)) {
    throw new Error("Alias is not available for this mailbox.");
  }

  await prisma.gmailMailbox.update({
    where: { id: mailbox.id },
    data: { defaultSendAsEmail: normalized },
  });

  revalidatePath("/mailbox");
}

export async function clearDefaultSendAsEmail(mailboxId: string) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: mailboxId, userId, provider: "GMAIL" },
    select: { id: true },
  });
  if (!mailbox) throw new Error("Mailbox not found.");

  await prisma.gmailMailbox.update({
    where: { id: mailbox.id },
    data: { defaultSendAsEmail: null },
  });

  revalidatePath("/mailbox");
}
