import { prisma } from "@gmail-agent/db";

type ClassificationSummary = {
  category?: string;
  intent?: string;
  priority?: string;
  replyNeeded?: string;
  shortSummary?: string;
  raw?: unknown[];
};

export async function getMailboxesForFilter(userId: string) {
  return prisma.gmailMailbox.findMany({
    where: { userId },
    orderBy: { email: "asc" },
    select: { id: true, email: true, status: true },
  });
}

export async function getThreadsList(params: { mailboxId?: string; q?: string }) {
  const { mailboxId, q } = params;
  const qTrim = q?.trim();

  const threads = await prisma.gmailThread.findMany({
    where: {
      ...(mailboxId ? { mailboxId } : {}),
      ...(qTrim
        ? {
            OR: [
              { subject: { contains: qTrim, mode: "insensitive" } },
              {
                messages: {
                  some: {
                    OR: [
                      { fromPerson: { email: { contains: qTrim, mode: "insensitive" } } },
                      {
                        recipients: {
                          some: {
                            person: { email: { contains: qTrim, mode: "insensitive" } },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      mailbox: { select: { id: true, email: true, status: true } },
      _count: { select: { messages: true } },
      messages: {
        orderBy: { gmailInternalDate: "desc" },
        take: 1,
        select: {
          id: true,
          direction: true,
          gmailInternalDate: true,
          fromPerson: { select: { email: true, name: true } },
        },
      },
    },
  });

  const threadIds = threads.map((t) => t.id);
  const cls = threadIds.length
    ? await prisma.gmailMessageClassification.findMany({
        where: { message: { threadId: { in: threadIds } } },
        orderBy: { createdAt: "desc" },
        include: { message: { select: { threadId: true } } },
      })
    : [];

  const summaryByThread = new Map<string, ClassificationSummary>();
  for (const c of cls) {
    const threadId = c.message.threadId;
    const current = summaryByThread.get(threadId) || {};
    if (c.kind === "CATEGORY" && !current.category) current.category = c.value;
    if (c.kind === "INTENT" && !current.intent) current.intent = c.value;
    if (c.kind === "PRIORITY" && !current.priority) current.priority = c.value;
    if (c.kind === "REPLY_NEEDED" && !current.replyNeeded) current.replyNeeded = c.value;
    if (!current.raw) current.raw = [];
    current.raw.push({ id: c.id, kind: c.kind, value: c.value, rawJson: c.rawJson });
    summaryByThread.set(threadId, current);
  }

  return threads.map((t) => ({
    ...t,
    summary: summaryByThread.get(t.id) || {},
  }));
}

export async function getThreadDetail(threadId: string) {
  const thread = await prisma.gmailThread.findUnique({
    where: { id: threadId },
    include: {
      mailbox: { select: { id: true, email: true, status: true } },
      messages: {
        orderBy: { gmailInternalDate: "asc" },
        include: {
          fromPerson: { select: { email: true, name: true } },
          recipients: {
            include: { person: { select: { email: true, name: true } } },
          },
          classifications: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      },
    },
  });

  if (!thread) return null;

  const summary: ClassificationSummary = {};
  const raw = [];
  for (const msg of thread.messages) {
    for (const c of msg.classifications) {
      if (c.kind === "CATEGORY" && !summary.category) summary.category = c.value;
      if (c.kind === "INTENT" && !summary.intent) summary.intent = c.value;
      if (c.kind === "PRIORITY" && !summary.priority) summary.priority = c.value;
      if (c.kind === "REPLY_NEEDED" && !summary.replyNeeded) summary.replyNeeded = c.value;
      raw.push({ messageId: msg.id, kind: c.kind, value: c.value, rawJson: c.rawJson });
    }
  }
  summary.raw = raw;

  return { thread, summary };
}

