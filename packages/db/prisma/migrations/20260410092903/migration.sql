-- AlterTable
ALTER TABLE "GmailThread" ADD COLUMN     "lastDecisionAt" TIMESTAMP(3),
ADD COLUMN     "lastEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "needsEvaluation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyRequired" BOOLEAN;

-- CreateIndex
CREATE INDEX "GmailThread_replyRequired_idx" ON "GmailThread"("replyRequired");

-- CreateIndex
CREATE INDEX "GmailThread_needsEvaluation_idx" ON "GmailThread"("needsEvaluation");
