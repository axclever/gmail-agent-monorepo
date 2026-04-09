-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('GMAIL');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "ClassificationKind" AS ENUM ('CATEGORY', 'INTENT', 'PRIORITY', 'REPLY_NEEDED');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "firstSeenAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "GmailMailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL DEFAULT 'GMAIL',
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" TEXT NOT NULL,
    "googleAccountId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastHistoryId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailThread" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailMessage" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailInternalDate" TIMESTAMP(3),
    "direction" "MessageDirection" NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "fromPersonId" TEXT,
    "isRead" BOOLEAN,
    "isStarred" BOOLEAN,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "internetMessageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "headersJson" JSONB,
    "labelIdsJson" JSONB,
    "rawPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailMessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" "RecipientType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailMessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailMessageClassification" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "ClassificationKind" NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailMessageClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailSyncRun" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorText" TEXT,

    CONSTRAINT "GmailSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GmailMailbox_userId_idx" ON "GmailMailbox"("userId");

-- CreateIndex
CREATE INDEX "GmailMailbox_status_idx" ON "GmailMailbox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GmailMailbox_userId_email_key" ON "GmailMailbox"("userId", "email");

-- CreateIndex
CREATE INDEX "GmailThread_mailboxId_idx" ON "GmailThread"("mailboxId");

-- CreateIndex
CREATE INDEX "GmailThread_lastMessageAt_idx" ON "GmailThread"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "GmailThread_mailboxId_gmailThreadId_key" ON "GmailThread"("mailboxId", "gmailThreadId");

-- CreateIndex
CREATE INDEX "GmailMessage_mailboxId_idx" ON "GmailMessage"("mailboxId");

-- CreateIndex
CREATE INDEX "GmailMessage_threadId_idx" ON "GmailMessage"("threadId");

-- CreateIndex
CREATE INDEX "GmailMessage_fromPersonId_idx" ON "GmailMessage"("fromPersonId");

-- CreateIndex
CREATE INDEX "GmailMessage_gmailInternalDate_idx" ON "GmailMessage"("gmailInternalDate");

-- CreateIndex
CREATE INDEX "GmailMessage_direction_idx" ON "GmailMessage"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "GmailMessage_mailboxId_gmailMessageId_key" ON "GmailMessage"("mailboxId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "GmailMessageRecipient_messageId_idx" ON "GmailMessageRecipient"("messageId");

-- CreateIndex
CREATE INDEX "GmailMessageRecipient_personId_idx" ON "GmailMessageRecipient"("personId");

-- CreateIndex
CREATE INDEX "GmailMessageRecipient_type_idx" ON "GmailMessageRecipient"("type");

-- CreateIndex
CREATE UNIQUE INDEX "GmailMessageRecipient_messageId_personId_type_key" ON "GmailMessageRecipient"("messageId", "personId", "type");

-- CreateIndex
CREATE INDEX "GmailMessageClassification_messageId_idx" ON "GmailMessageClassification"("messageId");

-- CreateIndex
CREATE INDEX "GmailMessageClassification_kind_idx" ON "GmailMessageClassification"("kind");

-- CreateIndex
CREATE INDEX "GmailMessageClassification_value_idx" ON "GmailMessageClassification"("value");

-- CreateIndex
CREATE INDEX "GmailSyncRun_mailboxId_idx" ON "GmailSyncRun"("mailboxId");

-- CreateIndex
CREATE INDEX "GmailSyncRun_startedAt_idx" ON "GmailSyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "GmailSyncRun_status_idx" ON "GmailSyncRun"("status");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "GmailMailbox" ADD CONSTRAINT "GmailMailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailThread" ADD CONSTRAINT "GmailThread_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "GmailMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailMessage" ADD CONSTRAINT "GmailMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "GmailMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailMessage" ADD CONSTRAINT "GmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "GmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailMessage" ADD CONSTRAINT "GmailMessage_fromPersonId_fkey" FOREIGN KEY ("fromPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailMessageRecipient" ADD CONSTRAINT "GmailMessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailMessageRecipient" ADD CONSTRAINT "GmailMessageRecipient_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailMessageClassification" ADD CONSTRAINT "GmailMessageClassification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailSyncRun" ADD CONSTRAINT "GmailSyncRun_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "GmailMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
