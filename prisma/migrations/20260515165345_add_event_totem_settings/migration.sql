-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "totemAutoResetSeconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "totemBackgroundColor" TEXT,
ADD COLUMN     "totemFullscreenRecommended" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totemRequireCustomerName" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totemShowLogo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totemShowLowStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totemShowPrices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totemTextColor" TEXT,
ADD COLUMN     "totemWelcomeMessage" TEXT;
