-- AlterTable
ALTER TABLE "GmailThread" ADD COLUMN "threadAnalysisJson" JSONB;
ALTER TABLE "GmailThread" ADD COLUMN "threadAnalysisAt" TIMESTAMP(3);
