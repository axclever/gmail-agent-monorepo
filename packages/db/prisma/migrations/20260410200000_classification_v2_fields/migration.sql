-- AlterTable
ALTER TABLE "GmailThread" ADD COLUMN "actionRequired" BOOLEAN;

-- AlterTable
ALTER TABLE "GmailMessage" ADD COLUMN "replyNeeded" BOOLEAN;
ALTER TABLE "GmailMessage" ADD COLUMN "templateKey" TEXT;
