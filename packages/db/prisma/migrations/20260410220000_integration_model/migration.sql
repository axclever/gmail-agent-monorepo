-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('TELEGRAM', 'HTTP', 'SMTP');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "encryptedSecretJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GmailAction" ADD COLUMN "integrationId" TEXT;

-- CreateIndex
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");

CREATE INDEX "GmailAction_integrationId_idx" ON "GmailAction"("integrationId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmailAction" ADD CONSTRAINT "GmailAction_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
