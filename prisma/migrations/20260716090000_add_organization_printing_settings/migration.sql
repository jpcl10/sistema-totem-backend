-- Create the official organization-level printing settings store.
CREATE TABLE "OrganizationPrintingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "printingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPrintEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowReprint" BOOLEAN NOT NULL DEFAULT true,
    "splitBySector" BOOLEAN NOT NULL DEFAULT false,
    "mergeCopies" BOOLEAN NOT NULL DEFAULT true,
    "defaultPrinterDeviceId" TEXT,
    "kitchenPrinterDeviceId" TEXT,
    "barPrinterDeviceId" TEXT,
    "expeditionPrinterDeviceId" TEXT,
    "paperSize" TEXT NOT NULL DEFAULT '80mm',
    "showLogo" BOOLEAN NOT NULL DEFAULT false,
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "showQrCode" BOOLEAN NOT NULL DEFAULT false,
    "showPayment" BOOLEAN NOT NULL DEFAULT true,
    "showOrderSource" BOOLEAN NOT NULL DEFAULT true,
    "showOrderNotes" BOOLEAN NOT NULL DEFAULT true,
    "showItemNotes" BOOLEAN NOT NULL DEFAULT true,
    "showOptions" BOOLEAN NOT NULL DEFAULT true,
    "sources" JSONB,
    "sectors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPrintingSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationPrintingSettings_organizationId_key"
    ON "OrganizationPrintingSettings"("organizationId");

CREATE INDEX "OrganizationPrintingSettings_organizationId_idx"
    ON "OrganizationPrintingSettings"("organizationId");

ALTER TABLE "OrganizationPrintingSettings"
    ADD CONSTRAINT "OrganizationPrintingSettings_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE 'PRINTING_SETTINGS_UPDATED';
