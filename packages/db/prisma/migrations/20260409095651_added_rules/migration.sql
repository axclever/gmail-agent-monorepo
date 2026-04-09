-- AlterEnum
ALTER TYPE "ClassificationKind" ADD VALUE 'MESSAGE_TYPE';

-- AlterTable
ALTER TABLE "GmailMessage" ADD COLUMN     "classificationStatus" TEXT,
ADD COLUMN     "classifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GmailThread" ADD COLUMN     "hasUnrepliedInbound" BOOLEAN DEFAULT false,
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "lastIntent" TEXT,
ADD COLUMN     "lastMessageDirection" "MessageDirection",
ADD COLUMN     "lastOutboundAt" TIMESTAMP(3),
ADD COLUMN     "needsReply" BOOLEAN,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "replyNeeded" BOOLEAN,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "waitingOnOtherParty" BOOLEAN;

-- CreateTable
CREATE TABLE "GmailThreadClassification" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" "ClassificationKind" NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailThreadClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailRule" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditionsJson" JSONB,
    "actionType" TEXT NOT NULL,
    "actionConfigJson" JSONB,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailDecision" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "ruleId" TEXT,
    "decisionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailAction" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" JSONB,
    "resultJson" JSONB,
    "errorText" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GmailThreadClassification_threadId_idx" ON "GmailThreadClassification"("threadId");

-- CreateIndex
CREATE INDEX "GmailThreadClassification_kind_idx" ON "GmailThreadClassification"("kind");

-- CreateIndex
CREATE INDEX "GmailThreadClassification_value_idx" ON "GmailThreadClassification"("value");

-- CreateIndex
CREATE INDEX "GmailRule_mailboxId_idx" ON "GmailRule"("mailboxId");

-- CreateIndex
CREATE INDEX "GmailRule_isActive_idx" ON "GmailRule"("isActive");

-- CreateIndex
CREATE INDEX "GmailRule_priority_idx" ON "GmailRule"("priority");

-- CreateIndex
CREATE INDEX "GmailDecision_mailboxId_idx" ON "GmailDecision"("mailboxId");

-- CreateIndex
CREATE INDEX "GmailDecision_threadId_idx" ON "GmailDecision"("threadId");

-- CreateIndex
CREATE INDEX "GmailDecision_messageId_idx" ON "GmailDecision"("messageId");

-- CreateIndex
CREATE INDEX "GmailDecision_ruleId_idx" ON "GmailDecision"("ruleId");

-- CreateIndex
CREATE INDEX "GmailDecision_status_idx" ON "GmailDecision"("status");

-- CreateIndex
CREATE INDEX "GmailAction_decisionId_idx" ON "GmailAction"("decisionId");

-- CreateIndex
CREATE INDEX "GmailAction_status_idx" ON "GmailAction"("status");

-- CreateIndex
CREATE INDEX "GmailAction_type_idx" ON "GmailAction"("type");

-- CreateIndex
CREATE INDEX "GmailThread_status_idx" ON "GmailThread"("status");

-- CreateIndex
CREATE INDEX "GmailThread_needsReply_idx" ON "GmailThread"("needsReply");

-- CreateIndex
CREATE INDEX "GmailThread_hasUnrepliedInbound_idx" ON "GmailThread"("hasUnrepliedInbound");

-- AddForeignKey
ALTER TABLE "GmailThreadClassification" ADD CONSTRAINT "GmailThreadClassification_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "GmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailRule" ADD CONSTRAINT "GmailRule_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "GmailMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailDecision" ADD CONSTRAINT "GmailDecision_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "GmailMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailDecision" ADD CONSTRAINT "GmailDecision_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "GmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailDecision" ADD CONSTRAINT "GmailDecision_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailDecision" ADD CONSTRAINT "GmailDecision_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "GmailRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailAction" ADD CONSTRAINT "GmailAction_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "GmailDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
