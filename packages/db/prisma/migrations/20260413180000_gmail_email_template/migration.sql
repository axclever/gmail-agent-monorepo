-- CreateTable
CREATE TABLE "GmailEmailTemplate" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailEmailTemplate_mailboxId_templateKey_key" ON "GmailEmailTemplate"("mailboxId", "templateKey");

-- CreateIndex
CREATE INDEX "GmailEmailTemplate_mailboxId_idx" ON "GmailEmailTemplate"("mailboxId");

-- CreateIndex
CREATE INDEX "GmailEmailTemplate_enabled_idx" ON "GmailEmailTemplate"("enabled");

-- AddForeignKey
ALTER TABLE "GmailEmailTemplate" ADD CONSTRAINT "GmailEmailTemplate_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "GmailMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
