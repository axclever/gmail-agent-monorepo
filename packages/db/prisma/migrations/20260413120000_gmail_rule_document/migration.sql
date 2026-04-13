-- GmailRule: document-oriented fields (ruleKey, enabled, version, conditions[], actions[])

ALTER TABLE "GmailRule" ADD COLUMN "ruleKey" TEXT;
ALTER TABLE "GmailRule" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GmailRule" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "GmailRule" ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "GmailRule" ADD COLUMN "actions" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "GmailRule" SET "enabled" = COALESCE("isActive", true);

UPDATE "GmailRule"
SET "ruleKey" = 'rule_legacy_' || REPLACE("id", '-', '_')
WHERE "ruleKey" IS NULL;

UPDATE "GmailRule" r
SET "conditions" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'field', elem.key,
        'operator', 'equals',
        'value', elem.value
      )
      ORDER BY elem.key
    )
    FROM jsonb_each(
      CASE
        WHEN r."conditionsJson" IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(r."conditionsJson"::jsonb) = 'object' THEN r."conditionsJson"::jsonb
        ELSE '{}'::jsonb
      END
    ) AS elem(key, value)
  ),
  '[]'::jsonb
);

UPDATE "GmailRule"
SET "actions" = jsonb_build_array(
  jsonb_build_object(
    'type', "actionType",
    'params', CASE
      WHEN "actionConfigJson" IS NULL THEN '{}'::jsonb
      WHEN jsonb_typeof("actionConfigJson"::jsonb) = 'object' THEN "actionConfigJson"::jsonb
      ELSE '{}'::jsonb
    END
  )
);

ALTER TABLE "GmailRule" ALTER COLUMN "ruleKey" SET NOT NULL;

DROP INDEX IF EXISTS "GmailRule_isActive_idx";

ALTER TABLE "GmailRule" DROP COLUMN "isActive";
ALTER TABLE "GmailRule" DROP COLUMN "conditionsJson";
ALTER TABLE "GmailRule" DROP COLUMN "actionType";
ALTER TABLE "GmailRule" DROP COLUMN "actionConfigJson";

CREATE UNIQUE INDEX "GmailRule_mailboxId_ruleKey_key" ON "GmailRule"("mailboxId", "ruleKey");
CREATE INDEX "GmailRule_enabled_idx" ON "GmailRule"("enabled");
