"use server";

import { prisma } from "@gmail-agent/db";
import { revalidatePath } from "next/cache";
import {
  buildTokenHint,
  generateRawApiToken,
  hashApiToken,
} from "@/lib/public-api-auth";
import { requireAdmin } from "../(protected)/require-admin";

export async function createPublicApiToken(name: string) {
  const session = await requireAdmin();
  const userId = session.user.id;
  const cleaned = String(name || "").trim();
  if (!cleaned) {
    throw new Error("Token name is required.");
  }

  const rawToken = generateRawApiToken();
  const tokenHash = hashApiToken(rawToken);
  const tokenHint = buildTokenHint(rawToken);

  await prisma.userApiToken.create({
    data: {
      userId,
      name: cleaned,
      tokenHash,
      tokenHint,
    },
  });

  revalidatePath("/settings");
  return { rawToken };
}

export async function deletePublicApiToken(id: string) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const res = await prisma.userApiToken.deleteMany({
    where: { id, userId },
  });
  if (res.count === 0) {
    throw new Error("Token not found.");
  }

  revalidatePath("/settings");
}
