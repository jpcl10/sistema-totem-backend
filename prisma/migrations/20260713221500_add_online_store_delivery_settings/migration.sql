-- CreateEnum
CREATE TYPE "OnlineOrderFulfillmentType" AS ENUM ('DELIVERY', 'PICKUP', 'COUNTER', 'DINE_IN');

-- CreateEnum
CREATE TYPE "DeliveryFeeRuleType" AS ENUM ('FLAT', 'NEIGHBORHOOD');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ONLINE_STORE_SETTINGS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_SETTINGS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_FEE_RULE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_FEE_RULE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_FEE_RULE_DELETED';

-- AlterTable
ALTER TABLE "OnlineOrder"
  ADD COLUMN "fulfillmentType" "OnlineOrderFulfillmentType" NOT NULL DEFAULT 'DELIVERY',
  ADD COLUMN "deliveryRuleId" TEXT,
  ADD COLUMN "estimatedMinutes" INTEGER;

-- CreateTable
CREATE TABLE "OnlineStoreSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "onlineOrderingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "digitalMenuEnabled" BOOLEAN NOT NULL DEFAULT true,
  "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
  "counterEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dineInEnabled" BOOLEAN NOT NULL DEFAULT false,
  "allowOrdersOutsideHours" BOOLEAN NOT NULL DEFAULT false,
  "autoAcceptOrders" BOOLEAN NOT NULL DEFAULT false,
  "minimumOrderInCents" INTEGER NOT NULL DEFAULT 0,
  "estimatedPreparationMinutes" INTEGER NOT NULL DEFAULT 30,
  "estimatedDeliveryMinutes" INTEGER NOT NULL DEFAULT 45,
  "freeDeliveryAboveInCents" INTEGER,
  "defaultDeliveryFeeInCents" INTEGER NOT NULL DEFAULT 0,
  "closedMessage" TEXT,
  "checkoutNotice" TEXT,
  "orderConfirmationMessage" TEXT,
  "requireCustomerName" BOOLEAN NOT NULL DEFAULT true,
  "requireCustomerPhone" BOOLEAN NOT NULL DEFAULT true,
  "requireDeliveryAddress" BOOLEAN NOT NULL DEFAULT true,
  "allowCustomerNotes" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnlineStoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryFeeRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DeliveryFeeRuleType" NOT NULL,
  "neighborhood" TEXT,
  "feeInCents" INTEGER NOT NULL,
  "estimatedMinutes" INTEGER,
  "minimumOrderInCents" INTEGER,
  "freeDeliveryAboveInCents" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlineStoreSettings_storeId_key" ON "OnlineStoreSettings"("storeId");
CREATE INDEX "OnlineStoreSettings_organizationId_idx" ON "OnlineStoreSettings"("organizationId");
CREATE INDEX "OnlineStoreSettings_storeId_idx" ON "OnlineStoreSettings"("storeId");
CREATE INDEX "DeliveryFeeRule_organizationId_idx" ON "DeliveryFeeRule"("organizationId");
CREATE INDEX "DeliveryFeeRule_storeId_idx" ON "DeliveryFeeRule"("storeId");
CREATE INDEX "DeliveryFeeRule_type_idx" ON "DeliveryFeeRule"("type");
CREATE INDEX "DeliveryFeeRule_active_idx" ON "DeliveryFeeRule"("active");
CREATE INDEX "DeliveryFeeRule_sortOrder_idx" ON "DeliveryFeeRule"("sortOrder");
CREATE INDEX "OnlineOrder_deliveryRuleId_idx" ON "OnlineOrder"("deliveryRuleId");

-- AddForeignKey
ALTER TABLE "OnlineStoreSettings"
  ADD CONSTRAINT "OnlineStoreSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlineStoreSettings"
  ADD CONSTRAINT "OnlineStoreSettings_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryFeeRule"
  ADD CONSTRAINT "DeliveryFeeRule_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryFeeRule"
  ADD CONSTRAINT "DeliveryFeeRule_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlineOrder"
  ADD CONSTRAINT "OnlineOrder_deliveryRuleId_fkey"
  FOREIGN KEY ("deliveryRuleId") REFERENCES "DeliveryFeeRule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
