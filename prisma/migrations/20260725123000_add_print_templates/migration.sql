-- CreateEnum
CREATE TYPE "PrintTemplateType" AS ENUM ('PRODUCTION', 'CUSTOMER', 'DELIVERY', 'CASHIER', 'TEST');

-- AlterEnum
ALTER TYPE "PrintMode" ADD VALUE IF NOT EXISTS 'ONE_TICKET_PER_ITEM';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRINT_TEMPLATE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRINT_TEMPLATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRINT_TEMPLATE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRINT_TEMPLATE_DEFAULT_SET';

-- CreateTable
CREATE TABLE "PrintTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "eventId" TEXT,
  "printerId" TEXT,
  "name" TEXT NOT NULL,
  "templateType" "PrintTemplateType" NOT NULL,
  "paperWidthMm" INTEGER NOT NULL,
  "logoUrl" TEXT,
  "logoEnabled" BOOLEAN NOT NULL DEFAULT false,
  "logoWidthPx" INTEGER NOT NULL DEFAULT 240,
  "title" TEXT,
  "subtitle" TEXT,
  "showOrderNumber" BOOLEAN NOT NULL DEFAULT true,
  "showDate" BOOLEAN NOT NULL DEFAULT true,
  "showTime" BOOLEAN NOT NULL DEFAULT true,
  "showOrigin" BOOLEAN NOT NULL DEFAULT true,
  "showOperator" BOOLEAN NOT NULL DEFAULT true,
  "showCustomer" BOOLEAN NOT NULL DEFAULT true,
  "showSector" BOOLEAN NOT NULL DEFAULT true,
  "showObservations" BOOLEAN NOT NULL DEFAULT true,
  "itemFontSize" INTEGER NOT NULL DEFAULT 2,
  "titleFontSize" INTEGER NOT NULL DEFAULT 2,
  "quantityBold" BOOLEAN NOT NULL DEFAULT true,
  "footerText" TEXT,
  "copies" INTEGER NOT NULL DEFAULT 1,
  "feedLines" INTEGER NOT NULL DEFAULT 4,
  "autoCut" BOOLEAN NOT NULL DEFAULT true,
  "printMode" "PrintMode" NOT NULL DEFAULT 'FULL_ORDER',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintTemplate_pkey" PRIMARY KEY ("id")
);

-- ForeignKey
ALTER TABLE "PrintTemplate" ADD CONSTRAINT "PrintTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintTemplate" ADD CONSTRAINT "PrintTemplate_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintTemplate" ADD CONSTRAINT "PrintTemplate_printerId_fkey"
  FOREIGN KEY ("printerId") REFERENCES "EventPrinter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "PrintTemplate_organizationId_idx" ON "PrintTemplate"("organizationId");
CREATE INDEX "PrintTemplate_eventId_idx" ON "PrintTemplate"("eventId");
CREATE INDEX "PrintTemplate_printerId_idx" ON "PrintTemplate"("printerId");
CREATE INDEX "PrintTemplate_templateType_idx" ON "PrintTemplate"("templateType");
CREATE INDEX "PrintTemplate_isDefault_idx" ON "PrintTemplate"("isDefault");
CREATE INDEX "PrintTemplate_isActive_idx" ON "PrintTemplate"("isActive");

-- One active default per scope and template type.
CREATE UNIQUE INDEX "PrintTemplate_default_global_type_uq"
  ON "PrintTemplate"("templateType")
  WHERE "isDefault" = true AND "isActive" = true AND "organizationId" IS NULL AND "eventId" IS NULL AND "printerId" IS NULL;

CREATE UNIQUE INDEX "PrintTemplate_default_org_type_uq"
  ON "PrintTemplate"("organizationId", "templateType")
  WHERE "isDefault" = true AND "isActive" = true AND "organizationId" IS NOT NULL AND "eventId" IS NULL AND "printerId" IS NULL;

CREATE UNIQUE INDEX "PrintTemplate_default_event_type_uq"
  ON "PrintTemplate"("eventId", "templateType")
  WHERE "isDefault" = true AND "isActive" = true AND "eventId" IS NOT NULL AND "printerId" IS NULL;

CREATE UNIQUE INDEX "PrintTemplate_default_printer_type_uq"
  ON "PrintTemplate"("printerId", "templateType")
  WHERE "isDefault" = true AND "isActive" = true AND "printerId" IS NOT NULL;
