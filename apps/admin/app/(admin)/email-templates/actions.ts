"use server";

import { prisma } from "@gmail-agent/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../(protected)/require-admin";

async function mailboxForUser(userId: string) {
  return prisma.gmailMailbox.findFirst({
    where: { userId, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
}

function slugifyTemplateKey(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!s) return "template";
  if (!/^[a-z]/.test(s)) return `t_${s}`;
  return s;
}

export type EmailTemplateFormInput = {
  templateKey: string;
  name: string;
  subject: string;
  body: string;
};

export async function createEmailTemplate(input: EmailTemplateFormInput) {
  const session = await requireAdmin();
  const mailbox = await mailboxForUser(session.user.id);
  if (!mailbox) throw new Error("Connect Gmail first.");

  const templateKey = slugifyTemplateKey(input.templateKey);
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const subject = input.subject.trim();
  if (!subject) throw new Error("Subject is required.");

  const existing = await prisma.gmailEmailTemplate.findUnique({
    where: { mailboxId_templateKey: { mailboxId: mailbox.id, templateKey } },
    select: { id: true },
  });
  if (existing) throw new Error(`Template key "${templateKey}" already exists.`);

  const row = await prisma.gmailEmailTemplate.create({
    data: {
      mailboxId: mailbox.id,
      templateKey,
      name,
      subject,
      body: input.body,
    },
    select: { id: true },
  });

  revalidatePath("/email-templates");
  return row.id;
}

export async function updateEmailTemplate(id: string, input: EmailTemplateFormInput) {
  const session = await requireAdmin();
  const mailbox = await mailboxForUser(session.user.id);
  if (!mailbox) throw new Error("Connect Gmail first.");

  const row = await prisma.gmailEmailTemplate.findFirst({
    where: { id, mailboxId: mailbox.id },
    select: { id: true, templateKey: true },
  });
  if (!row) throw new Error("Template not found.");

  const templateKey = slugifyTemplateKey(input.templateKey);
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const subject = input.subject.trim();
  if (!subject) throw new Error("Subject is required.");

  if (templateKey !== row.templateKey) {
    const clash = await prisma.gmailEmailTemplate.findUnique({
      where: { mailboxId_templateKey: { mailboxId: mailbox.id, templateKey } },
      select: { id: true },
    });
    if (clash) throw new Error(`Template key "${templateKey}" already exists.`);
  }

  await prisma.gmailEmailTemplate.update({
    where: { id },
    data: {
      templateKey,
      name,
      subject,
      body: input.body,
    },
  });

  revalidatePath("/email-templates");
}

export async function deleteEmailTemplate(id: string) {
  const session = await requireAdmin();
  const mailbox = await mailboxForUser(session.user.id);
  if (!mailbox) throw new Error("Connect Gmail first.");

  const row = await prisma.gmailEmailTemplate.findFirst({
    where: { id, mailboxId: mailbox.id },
    select: { id: true },
  });
  if (!row) throw new Error("Template not found.");

  await prisma.gmailEmailTemplate.delete({ where: { id } });
  revalidatePath("/email-templates");
}
