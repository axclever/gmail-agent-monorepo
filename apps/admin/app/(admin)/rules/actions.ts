"use server";

import {
  buildConditionContextFromThreadRow,
  ruleConditionsMatch,
} from "@gmail-agent/rule-conditions";
import { prisma } from "@gmail-agent/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../(protected)/require-admin";

const CONDITION_PREVIEW_SCAN_LIMIT = 400;
const CONDITION_PREVIEW_LIST_LIMIT = 60;

export type RuleConditionMatchPreviewRow = {
  id: string;
  subject: string | null;
  lastMessageAtIso: string | null;
  lastEmailFrom: string;
  lastDirection: string | null;
  threadIntent: string | null;
  snippet: string | null;
};

function slugifyRuleKeyFromName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!s) return "rule";
  if (!/^[a-z]/.test(s)) return `r_${s}`;
  return s;
}

async function allocateRuleKey(mailboxId: string, name: string): Promise<string> {
  const base = slugifyRuleKeyFromName(name);
  let key = base;
  let n = 2;
  while (
    await prisma.gmailRule.findFirst({
      where: { mailboxId, ruleKey: key },
      select: { id: true },
    })
  ) {
    key = `${base}_${n}`;
    n += 1;
  }
  return key;
}

async function mailboxIdForUser(userId: string) {
  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { userId, provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return mailbox?.id ?? null;
}

export async function previewRuleConditionMatches(conditions: unknown[]) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Unauthorized.");
  }
  const mailboxId = await mailboxIdForUser(userId);
  if (!mailboxId) {
    throw new Error("Connect Gmail to preview matches.");
  }

  const cond = Array.isArray(conditions) ? conditions : [];

  const threads = await prisma.gmailThread.findMany({
    where: { mailboxId },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: CONDITION_PREVIEW_SCAN_LIMIT,
    select: {
      id: true,
      subject: true,
      snippet: true,
      lastMessageAt: true,
      lastMessageDirection: true,
      lastIntent: true,
      replyRequired: true,
      hasUnrepliedInbound: true,
      status: true,
      waitingOnOtherParty: true,
      classifications: { orderBy: { createdAt: "desc" } },
      messages: {
        orderBy: [{ gmailInternalDate: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          subject: true,
          snippet: true,
          textBody: true,
          htmlBody: true,
          direction: true,
          gmailInternalDate: true,
          fromPerson: { select: { email: true } },
        },
      },
    },
  });

  const previewThreads: RuleConditionMatchPreviewRow[] = [];
  let matchedCount = 0;

  for (const t of threads) {
    const latestMessage = t.messages[0] ?? null;
    const ctx = buildConditionContextFromThreadRow(t, latestMessage);
    if (!ruleConditionsMatch(cond, ctx)) continue;

    matchedCount += 1;

    if (previewThreads.length < CONDITION_PREVIEW_LIST_LIMIT) {
      const fromEmail = latestMessage?.fromPerson?.email?.trim() || "—";
      const textPreview = latestMessage?.textBody?.trim() ?? "";
      const lineSnippet =
        latestMessage?.snippet?.trim() ||
        t.snippet?.trim() ||
        (textPreview ? textPreview.slice(0, 140) : null);

      const threadObj = ctx.thread as { intent?: string | null };
      previewThreads.push({
        id: t.id,
        subject: t.subject,
        lastMessageAtIso: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
        lastEmailFrom: fromEmail,
        lastDirection: t.lastMessageDirection,
        threadIntent: threadObj.intent ?? null,
        snippet: lineSnippet,
      });
    }
  }

  return {
    scannedCount: threads.length,
    matchedCount,
    previewThreads,
  };
}

function ensureJsonArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

export type RuleFormInput = {
  name: string;
  enabled: boolean;
  priority: number;
  version: number;
  stopProcessing: boolean;
  conditions: unknown[];
  actions: unknown[];
};

export async function createRule(input: RuleFormInput) {
  const session = await requireAdmin();
  const mailboxId = await mailboxIdForUser(session.user.id);
  if (!mailboxId) {
    throw new Error("Connect Gmail first to create rules.");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Rule name is required.");

  const ruleKey = await allocateRuleKey(mailboxId, name);

  const conditions = ensureJsonArray(input.conditions, "Conditions");
  const actions = ensureJsonArray(input.actions, "Actions");
  if (actions.length === 0) {
    throw new Error("At least one action is required.");
  }

  const maxPriority = await prisma.gmailRule.aggregate({
    where: { mailboxId },
    _max: { priority: true },
  });
  const priority = (maxPriority._max.priority ?? 0) + 10;

  const rule = await prisma.gmailRule.create({
    data: {
      mailboxId,
      ruleKey,
      name,
      enabled: input.enabled,
      priority,
      version: Number.isFinite(input.version) ? Math.trunc(input.version) : 1,
      stopProcessing: input.stopProcessing,
      conditions: conditions as Prisma.InputJsonValue,
      actions: actions as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  revalidatePath("/rules");
  return { id: rule.id };
}

export async function updateRule(ruleId: string, input: RuleFormInput) {
  const session = await requireAdmin();
  const mailboxId = await mailboxIdForUser(session.user.id);
  if (!mailboxId) {
    throw new Error("No mailbox.");
  }

  const existing = await prisma.gmailRule.findFirst({
    where: { id: ruleId, mailboxId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Rule not found.");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Rule name is required.");

  const conditions = ensureJsonArray(input.conditions, "Conditions");
  const actions = ensureJsonArray(input.actions, "Actions");
  if (actions.length === 0) {
    throw new Error("At least one action is required.");
  }

  await prisma.gmailRule.update({
    where: { id: ruleId },
    data: {
      name,
      enabled: input.enabled,
      priority: Number.isFinite(input.priority) ? Math.trunc(input.priority) : 100,
      version: Number.isFinite(input.version) ? Math.trunc(input.version) : 1,
      stopProcessing: input.stopProcessing,
      conditions: conditions as Prisma.InputJsonValue,
      actions: actions as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/rules");
}

export async function deleteRule(ruleId: string) {
  const session = await requireAdmin();
  const mailboxId = await mailboxIdForUser(session.user.id);
  if (!mailboxId) {
    throw new Error("No mailbox.");
  }

  const rule = await prisma.gmailRule.findFirst({
    where: { id: ruleId, mailboxId },
    select: { id: true, name: true },
  });
  if (!rule) {
    throw new Error("Rule not found.");
  }

  await prisma.gmailRule.delete({ where: { id: rule.id } });
  revalidatePath("/rules");
}

export async function reorderRules(orderedRuleIds: string[]) {
  const session = await requireAdmin();
  const mailboxId = await mailboxIdForUser(session.user.id);
  if (!mailboxId) {
    throw new Error("No mailbox.");
  }

  const existing = await prisma.gmailRule.findMany({
    where: { mailboxId },
    select: { id: true },
  });
  if (existing.length === 0) {
    return;
  }
  if (orderedRuleIds.length !== existing.length) {
    throw new Error("Rule list length mismatch.");
  }
  const allowed = new Set(existing.map((e) => e.id));
  for (const id of orderedRuleIds) {
    if (!allowed.has(id)) {
      throw new Error("Unknown rule in order.");
    }
  }

  const step = 10;
  await prisma.$transaction(
    orderedRuleIds.map((id, index) =>
      prisma.gmailRule.update({
        where: { id },
        data: { priority: (index + 1) * step },
      }),
    ),
  );

  revalidatePath("/rules");
}

