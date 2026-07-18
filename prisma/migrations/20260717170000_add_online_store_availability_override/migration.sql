CREATE TYPE "StoreManualOverrideMode" AS ENUM ('AUTO', 'FORCE_OPEN', 'FORCE_CLOSED');

ALTER TABLE "OnlineStore"
ADD COLUMN "manualOverrideMode" "StoreManualOverrideMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "manualOverrideUntil" TIMESTAMP(3),
ADD COLUMN "manualOverrideReason" TEXT,
ADD COLUMN "manualOverrideUpdatedAt" TIMESTAMP(3),
ADD COLUMN "manualOverrideUpdatedByUserId" TEXT;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ONLINE_STORE_AVAILABILITY_UPDATED';
