CREATE TYPE "CustomerSource" AS ENUM ('ONLINE', 'EVENT', 'ADMIN', 'IMPORT', 'API', 'TOTEM', 'POS', 'WHATSAPP');

ALTER TABLE "Customer"
  ADD COLUMN "firstSource" "CustomerSource" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "lastSource" "CustomerSource" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH online_stats AS (
  SELECT
    "customerId",
    MIN("createdAt") AS "firstSeenAt",
    MAX("createdAt") AS "lastSeenAt"
  FROM "OnlineOrder"
  WHERE "customerId" IS NOT NULL
  GROUP BY "customerId"
),
event_stats AS (
  SELECT
    "customerId",
    MIN("createdAt") AS "firstSeenAt",
    MAX("createdAt") AS "lastSeenAt"
  FROM "Order"
  WHERE "customerId" IS NOT NULL
  GROUP BY "customerId"
),
combined AS (
  SELECT
    c."id" AS "customerId",
    LEAST(
      COALESCE(os."firstSeenAt", c."createdAt"),
      COALESCE(es."firstSeenAt", c."createdAt")
    ) AS "firstSeenAt",
    GREATEST(
      COALESCE(os."lastSeenAt", c."createdAt"),
      COALESCE(es."lastSeenAt", c."createdAt")
    ) AS "lastSeenAt",
    CASE
      WHEN os."firstSeenAt" IS NOT NULL
        AND (es."firstSeenAt" IS NULL OR os."firstSeenAt" <= es."firstSeenAt")
        THEN 'ONLINE'::"CustomerSource"
      WHEN es."firstSeenAt" IS NOT NULL
        THEN 'EVENT'::"CustomerSource"
      ELSE 'IMPORT'::"CustomerSource"
    END AS "firstSource",
    CASE
      WHEN os."lastSeenAt" IS NOT NULL
        AND (es."lastSeenAt" IS NULL OR os."lastSeenAt" >= es."lastSeenAt")
        THEN 'ONLINE'::"CustomerSource"
      WHEN es."lastSeenAt" IS NOT NULL
        THEN 'EVENT'::"CustomerSource"
      ELSE 'IMPORT'::"CustomerSource"
    END AS "lastSource"
  FROM "Customer" c
  LEFT JOIN online_stats os ON os."customerId" = c."id"
  LEFT JOIN event_stats es ON es."customerId" = c."id"
)
UPDATE "Customer" c
SET
  "firstSource" = combined."firstSource",
  "lastSource" = combined."lastSource",
  "firstSeenAt" = combined."firstSeenAt",
  "lastSeenAt" = combined."lastSeenAt"
FROM combined
WHERE c."id" = combined."customerId";

CREATE INDEX "Customer_organizationId_firstSource_idx" ON "Customer"("organizationId", "firstSource");
CREATE INDEX "Customer_organizationId_lastSource_idx" ON "Customer"("organizationId", "lastSource");
CREATE INDEX "Customer_organizationId_lastSeenAt_idx" ON "Customer"("organizationId", "lastSeenAt");
