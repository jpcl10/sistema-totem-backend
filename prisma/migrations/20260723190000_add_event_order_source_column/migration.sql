ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "source" "OrderSource";

UPDATE "Order"
SET "source" = 'EVENT'
WHERE "source" IS NULL;

UPDATE "Order" AS o
SET "source" = 'TOTEM'
FROM "Device" AS d
WHERE o."deviceId" = d."id"
  AND d."type" = 'TOTEM';

ALTER TABLE "Order"
  ALTER COLUMN "source" SET DEFAULT 'EVENT';

ALTER TABLE "Order"
  ALTER COLUMN "source" SET NOT NULL;
