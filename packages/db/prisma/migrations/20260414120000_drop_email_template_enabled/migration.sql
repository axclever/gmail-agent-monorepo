-- DropIndex
DROP INDEX IF EXISTS "GmailEmailTemplate_enabled_idx";

-- AlterTable
ALTER TABLE "GmailEmailTemplate" DROP COLUMN IF EXISTS "enabled";
