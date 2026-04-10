-- Remove legacy reply flags replaced by thread-level processing state.
ALTER TABLE "GmailThread"
  DROP COLUMN IF EXISTS "replyNeeded",
  DROP COLUMN IF EXISTS "needsReply";

ALTER TABLE "GmailMessage"
  DROP COLUMN IF EXISTS "replyNeeded";
