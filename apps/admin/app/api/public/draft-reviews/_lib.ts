import { prisma } from "@gmail-agent/db";
import { NextResponse } from "next/server";
import {
  readApiTokenFromRequest,
  resolveUserIdByApiToken,
} from "@/lib/public-api-auth";

export const OPENAI_STRONG_MODEL = process.env.OPENAI_STRONG_MODEL || "gpt-4o";

export type DraftReviewPayload = {
  reviewId?: string;
  telegramUserId?: number | string;
  feedback?: string;
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function sanitizeFeedback(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

export async function authenticatePublicApi(request: Request) {
  const rawToken = readApiTokenFromRequest(request);
  if (!rawToken) return null;
  return resolveUserIdByApiToken(rawToken);
}

export async function loadDraftReviewForUser(reviewId: string, userId: string) {
  return prisma.draftReview.findFirst({
    where: { id: reviewId, userId },
  });
}
