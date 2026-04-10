-- AlterTable
ALTER TABLE "GmailMailbox" ADD COLUMN "sendAsEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
