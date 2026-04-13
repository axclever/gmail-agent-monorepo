-- CreateTable
CREATE TABLE "DraftReview" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "subject" TEXT,
  "draftBody" TEXT NOT NULL,
  "fromAliasEmail" TEXT,
  "telegramUserId" TEXT,
  "lastFeedback" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DraftReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftReview_status_idx" ON "DraftReview"("status");

-- CreateIndex
CREATE INDEX "DraftReview_createdAt_idx" ON "DraftReview"("createdAt");
