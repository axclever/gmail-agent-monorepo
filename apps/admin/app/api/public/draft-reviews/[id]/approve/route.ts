import { prisma } from "@gmail-agent/db";
import { NextResponse } from "next/server";
import {
  authenticatePublicApi,
  jsonError,
  loadDraftReviewForUser,
} from "../../_lib";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const userId = await authenticatePublicApi(request);
  if (!userId) return jsonError("Unauthorized.", 401);

  const { id } = await params;
  const reviewId = id.trim();
  if (!reviewId) return jsonError("review id is required.");

  const draft = await loadDraftReviewForUser(reviewId, userId);
  if (!draft) return jsonError("Draft review not found.", 404);

  await prisma.draftReview.update({
    where: { id: reviewId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  // TODO: replace placeholder with real Gmail send using selected alias.
  console.info("[draft-review][approve] placeholder send", {
    reviewId: draft.id,
    fromAliasEmail: draft.fromAliasEmail,
    subject: draft.subject,
  });

  return NextResponse.json({
    ok: true,
    message: "[Check] Message sent successfully (placeholder).",
  });
}
