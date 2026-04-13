-- CreateTable
CREATE TABLE "UserApiToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenHint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),

  CONSTRAINT "UserApiToken_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DraftReview"
ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserApiToken_tokenHash_key" ON "UserApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserApiToken_userId_createdAt_idx" ON "UserApiToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftReview_userId_idx" ON "DraftReview"("userId");

-- AddForeignKey
ALTER TABLE "UserApiToken"
ADD CONSTRAINT "UserApiToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReview"
ADD CONSTRAINT "DraftReview_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
