"use server";

import { prisma } from "@gmail-agent/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../(protected)/require-admin";

export async function toggleThreadNeedsEvaluation(threadId: string, currentValue: boolean) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const res = await prisma.gmailThread.updateMany({
    where: {
      id: threadId,
      mailbox: {
        userId,
        provider: "GMAIL",
      },
    },
    data: {
      needsEvaluation: !currentValue,
    },
  });

  if (res.count === 0) {
    throw new Error("Thread not found.");
  }

  revalidatePath("/inbox");
}
