-- Map TELEGRAM integrations to HTTP gateway shape; enum becomes HTTP | SMTP only.

ALTER TABLE "Integration" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "Integration" ALTER COLUMN "type" TYPE TEXT USING ("type"::text);

UPDATE "Integration" SET "type" = 'HTTP' WHERE "type" = 'TELEGRAM';

UPDATE "Integration"
SET "configJson" = jsonb_build_object(
  'baseUrl', "configJson"::jsonb->'botUrl',
  'method', 'POST',
  'headers', jsonb_build_object('Content-Type', 'application/json'),
  'notifyTarget', "configJson"::jsonb->'target'
)
WHERE "configJson" IS NOT NULL
  AND ("configJson"::jsonb ? 'botUrl');

DROP TYPE "IntegrationType";

CREATE TYPE "IntegrationType" AS ENUM ('HTTP', 'SMTP');

ALTER TABLE "Integration"
  ALTER COLUMN "type" TYPE "IntegrationType" USING ("type"::"IntegrationType");
