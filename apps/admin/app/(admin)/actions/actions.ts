"use server";

import { prisma } from "@gmail-agent/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../(protected)/require-admin";

export async function deleteAction(actionId: string) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const action = await prisma.gmailAction.findFirst({
    where: {
      id: actionId,
      decision: {
        mailbox: {
          userId,
          provider: "GMAIL",
        },
      },
    },
    select: { id: true, decisionId: true },
  });

  if (!action) {
    throw new Error("Action not found.");
  }

  // Deleting decision cascades to all related GmailAction rows.
  await prisma.gmailDecision.deleteMany({
    where: {
      id: action.decisionId,
      mailbox: {
        userId,
        provider: "GMAIL",
      },
    },
  });

  revalidatePath("/actions");
}
