import { prisma } from "@gmail-agent/db";

type ThreadLite = {
  id: string;
  gmailThreadId: string;
  subject: string | null;
  lastMessageAt: Date | null;
  mailbox: { email: string };
};

type MessageLite = {
  id: string;
  gmailMessageId: string;
  subject: string | null;
  snippet: string | null;
  direction: "INBOUND" | "OUTBOUND";
  gmailInternalDate: Date | null;
  thread: { id: string; subject: string | null };
  mailbox: { email: string };
};

export async function getPeopleList() {
  const people = await prisma.person.findMany({
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      firstSeenAt: true,
      lastSeenAt: true,
      sentMessages: { select: { id: true, threadId: true } },
      receivedMessages: { select: { message: { select: { id: true, threadId: true } } } },
    },
  });

  return people.map((p) => {
    const messageIds = new Set();
    const threadIds = new Set();

    for (const m of p.sentMessages) {
      messageIds.add(m.id);
      threadIds.add(m.threadId);
    }
    for (const r of p.receivedMessages) {
      messageIds.add(r.message.id);
      threadIds.add(r.message.threadId);
    }

    return {
      id: p.id,
      email: p.email,
      name: p.name,
      firstSeenAt: p.firstSeenAt,
      lastSeenAt: p.lastSeenAt,
      totalMessages: messageIds.size,
      totalThreads: threadIds.size,
    };
  });
}

export async function getPersonDetail(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      email: true,
      name: true,
      firstSeenAt: true,
      lastSeenAt: true,
      sentMessages: {
        select: {
          id: true,
          threadId: true,
          gmailMessageId: true,
          subject: true,
          snippet: true,
          direction: true,
          gmailInternalDate: true,
          thread: { select: { id: true, subject: true, gmailThreadId: true, lastMessageAt: true } },
          mailbox: { select: { email: true } },
        },
      },
      receivedMessages: {
        select: {
          message: {
            select: {
              id: true,
              threadId: true,
              gmailMessageId: true,
              subject: true,
              snippet: true,
              direction: true,
              gmailInternalDate: true,
              thread: {
                select: { id: true, subject: true, gmailThreadId: true, lastMessageAt: true },
              },
              mailbox: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  if (!person) return null;

  const threadsMap = new Map<string, ThreadLite>();
  const messagesMap = new Map<string, MessageLite>();

  for (const m of person.sentMessages) {
    threadsMap.set(m.thread.id, {
      id: m.thread.id,
      gmailThreadId: m.thread.gmailThreadId,
      subject: m.thread.subject,
      lastMessageAt: m.thread.lastMessageAt,
      mailbox: m.mailbox,
    });
    messagesMap.set(m.id, {
      id: m.id,
      gmailMessageId: m.gmailMessageId,
      subject: m.subject,
      snippet: m.snippet,
      direction: m.direction,
      gmailInternalDate: m.gmailInternalDate,
      thread: { id: m.thread.id, subject: m.thread.subject },
      mailbox: m.mailbox,
    });
  }

  for (const r of person.receivedMessages) {
    const m = r.message;
    threadsMap.set(m.thread.id, {
      id: m.thread.id,
      gmailThreadId: m.thread.gmailThreadId,
      subject: m.thread.subject,
      lastMessageAt: m.thread.lastMessageAt,
      mailbox: m.mailbox,
    });
    messagesMap.set(m.id, {
      id: m.id,
      gmailMessageId: m.gmailMessageId,
      subject: m.subject,
      snippet: m.snippet,
      direction: m.direction,
      gmailInternalDate: m.gmailInternalDate,
      thread: { id: m.thread.id, subject: m.thread.subject },
      mailbox: m.mailbox,
    });
  }

  const threads = [...threadsMap.values()].sort(
    (a, b) => (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0),
  );
  const messages = [...messagesMap.values()].sort(
    (a, b) => (b.gmailInternalDate?.getTime() || 0) - (a.gmailInternalDate?.getTime() || 0),
  );

  return {
    person: {
      id: person.id,
      email: person.email,
      name: person.name,
      firstSeenAt: person.firstSeenAt,
      lastSeenAt: person.lastSeenAt,
    },
    threads,
    messages,
  };
}

