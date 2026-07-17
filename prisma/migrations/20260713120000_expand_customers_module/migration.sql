-- Expand Customer into a reusable tenant-owned identity without changing order snapshots.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_STATUS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_ADDRESS_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_ADDRESS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_ADDRESS_STATUS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEREST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEREST_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEREST_STATUS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_INTEREST_ADDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_INTEREST_REMOVED';

CREATE TYPE "CustomerInterestSource" AS ENUM ('MANUAL', 'ONLINE_ORDER', 'EVENT', 'IMPORT', 'API');

DROP INDEX IF EXISTS "Customer_organizationId_phone_key";

ALTER TABLE "Customer"
  ADD COLUMN "normalizedPhone" TEXT,
  ADD COLUMN "normalizedEmail" TEXT,
  ADD COLUMN "document" TEXT,
  ADD COLUMN "normalizedDocument" TEXT,
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Customer"
  ALTER COLUMN "phone" DROP NOT NULL;

UPDATE "Customer"
SET
  "normalizedPhone" = NULLIF(regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g'), ''),
  "normalizedEmail" = NULLIF(lower(trim(COALESCE("email", ''))), '');

ALTER TABLE "CustomerAddress"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "recipientName" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

UPDATE "CustomerAddress" ca
SET "organizationId" = c."organizationId"
FROM "Customer" c
WHERE ca."customerId" = c."id";

ALTER TABLE "CustomerAddress"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "number" DROP NOT NULL,
  ALTER COLUMN "neighborhood" DROP NOT NULL;

ALTER TABLE "Order"
  ADD COLUMN "customerId" TEXT;

CREATE TABLE "Interest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerInterest" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "interestId" TEXT NOT NULL,
  "source" "CustomerInterestSource",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerInterest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");
CREATE INDEX "Customer_organizationId_normalizedPhone_idx" ON "Customer"("organizationId", "normalizedPhone");
CREATE INDEX "Customer_organizationId_normalizedEmail_idx" ON "Customer"("organizationId", "normalizedEmail");
CREATE INDEX "Customer_organizationId_normalizedDocument_idx" ON "Customer"("organizationId", "normalizedDocument");

CREATE INDEX "CustomerAddress_organizationId_customerId_idx" ON "CustomerAddress"("organizationId", "customerId");

CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

CREATE INDEX "Interest_organizationId_idx" ON "Interest"("organizationId");
CREATE UNIQUE INDEX "Interest_organizationId_key_key" ON "Interest"("organizationId", "key");

CREATE INDEX "CustomerInterest_interestId_idx" ON "CustomerInterest"("interestId");
CREATE UNIQUE INDEX "CustomerInterest_customerId_interestId_key" ON "CustomerInterest"("customerId", "interestId");

ALTER TABLE "CustomerAddress"
  ADD CONSTRAINT "CustomerAddress_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interest"
  ADD CONSTRAINT "Interest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerInterest"
  ADD CONSTRAINT "CustomerInterest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerInterest"
  ADD CONSTRAINT "CustomerInterest_interestId_fkey"
  FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
