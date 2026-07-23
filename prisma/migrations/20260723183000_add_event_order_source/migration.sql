ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'EVENT';
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'TOTEM';

ALTER TABLE "Order"
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'EVENT';

UPDATE "Order" AS o
SET "source" = 'TOTEM'
FROM "Device" AS d
WHERE o."deviceId" = d."id"
  AND d."type" = 'TOTEM';
