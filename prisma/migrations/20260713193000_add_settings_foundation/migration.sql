-- CreateEnum
CREATE TYPE "SettingsContextType" AS ENUM ('ORGANIZATION', 'ONLINE_STORE');

-- CreateEnum
CREATE TYPE "SettingsChannel" AS ENUM ('ALL', 'DELIVERY', 'PICKUP', 'DIGITAL_MENU', 'TOTEM', 'COUNTER');

-- CreateEnum
CREATE TYPE "BrandingTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SETTINGS_GENERAL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SETTINGS_BRANDING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_HOURS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_HOUR_EXCEPTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_HOUR_EXCEPTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_HOUR_EXCEPTION_DELETED';

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT,
    "document" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBranding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "lightLogoUrl" TEXT,
    "darkLogoUrl" TEXT,
    "faviconUrl" TEXT,
    "bannerDesktopUrl" TEXT,
    "bannerMobileUrl" TEXT,
    "socialImageUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "backgroundColor" TEXT,
    "theme" "BrandingTheme" NOT NULL DEFAULT 'SYSTEM',
    "defaultProductImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHour" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contextType" "SettingsContextType" NOT NULL,
    "storeId" TEXT,
    "channel" "SettingsChannel" NOT NULL DEFAULT 'ALL',
    "dayOfWeek" INTEGER NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "opensAt" TEXT NOT NULL,
    "closesAt" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "is24Hours" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHourException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT,
    "channel" "SettingsChannel" NOT NULL DEFAULT 'ALL',
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "is24Hours" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHourException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBranding_organizationId_key" ON "OrganizationBranding"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHour_organizationId_contextType_storeId_channel_dayOfWeek_periodIndex_key" ON "BusinessHour"("organizationId", "contextType", "storeId", "channel", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE INDEX "BusinessHour_organizationId_idx" ON "BusinessHour"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessHour_storeId_idx" ON "BusinessHour"("storeId");

-- CreateIndex
CREATE INDEX "BusinessHour_channel_idx" ON "BusinessHour"("channel");

-- CreateIndex
CREATE INDEX "BusinessHour_dayOfWeek_idx" ON "BusinessHour"("dayOfWeek");

-- CreateIndex
CREATE INDEX "BusinessHourException_organizationId_idx" ON "BusinessHourException"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessHourException_storeId_idx" ON "BusinessHourException"("storeId");

-- CreateIndex
CREATE INDEX "BusinessHourException_channel_idx" ON "BusinessHourException"("channel");

-- CreateIndex
CREATE INDEX "BusinessHourException_date_idx" ON "BusinessHourException"("date");

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationBranding" ADD CONSTRAINT "OrganizationBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHourException" ADD CONSTRAINT "BusinessHourException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHourException" ADD CONSTRAINT "BusinessHourException_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
