import { prisma } from "@gmail-agent/db";
import { NextResponse } from "next/server";
import {
  OPENAI_STRONG_MODEL,
  type DraftReviewPayload,
  authenticatePublicApi,
  jsonError,
  loadDraftReviewForUser,
  sanitizeFeedback,
} from "../../_lib";

type RouteParams = { params: Promise<{ id: string }> };

type RewriteResult = {
  subject: string;
  draftBody: string;
};

async function rewriteDraftWithLlm(input: {
  subject: string;
  draftBody: string;
  feedback: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const prompt = [
    "Rewrite the email draft based on user feedback.",
    "Keep the same language as the feedback unless the draft clearly uses another language.",
    "Return strict JSON only with keys: subject, draftBody.",
    "",
    `Current subject: ${input.subject || "(no subject)"}`,
    "Current draft body:",
    input.draftBody,
    "",
    "Feedback from Telegram:",
    input.feedback,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_STRONG_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an email editing assistant. Return valid JSON with `subject` and `draftBody` only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) throw new Error(data?.error?.message || `OpenAI failed with ${res.status}`);

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI response is empty.");

  let parsed: Partial<RewriteResult> = {};
  try {
    parsed = JSON.parse(content) as Partial<RewriteResult>;
  } catch {
    throw new Error("OpenAI returned non-JSON content.");
  }

  const subject = String(parsed.subject || input.subject || "").trim();
  const draftBody = String(parsed.draftBody || "").trim();
  if (!draftBody) throw new Error("OpenAI returned empty draftBody.");

  return { subject, draftBody };
}

export async function POST(request: Request, { params }: RouteParams) {
  const userId = await authenticatePublicApi(request);
  if (!userId) return jsonError("Unauthorized.", 401);

  const { id } = await params;
  const reviewId = id.trim();
  if (!reviewId) return jsonError("review id is required.");

  let body: DraftReviewPayload = {};
  try {
    body = (await request.json()) as DraftReviewPayload;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  if (body.reviewId && String(body.reviewId).trim() !== reviewId) {
    return jsonError("reviewId in body must match URL id.");
  }

  const feedback = sanitizeFeedback(body.feedback);
  if (!feedback) return jsonError("feedback is required.");

  const draft = await loadDraftReviewForUser(reviewId, userId);
  if (!draft) return jsonError("Draft review not found.", 404);

  try {
    const rewritten = await rewriteDraftWithLlm({
      subject: draft.subject || "",
      draftBody: draft.draftBody,
      feedback,
    });

    const telegramUserId =
      body.telegramUserId == null ? null : String(body.telegramUserId).trim() || null;

    const updated = await prisma.draftReview.update({
      where: { id: reviewId },
      data: {
        status: "PENDING",
        subject: rewritten.subject || null,
        draftBody: rewritten.draftBody,
        telegramUserId,
        lastFeedback: feedback,
      },
      select: {
        id: true,
        status: true,
        subject: true,
        draftBody: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Draft updated. Emit draft_review_request to Telegram bot from your sender flow.",
      review: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to edit draft.";
    return jsonError(message, 500);
  }
}
