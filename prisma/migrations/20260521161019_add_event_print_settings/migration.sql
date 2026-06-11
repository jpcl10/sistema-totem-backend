-- CreateEnum
CREATE TYPE "PrintMode" AS ENUM ('FULL_ORDER', 'BY_SECTOR', 'BOTH');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "autoPrintEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printMode" "PrintMode" NOT NULL DEFAULT 'FULL_ORDER',
ADD COLUMN     "printerPaperSize" TEXT NOT NULL DEFAULT '80mm',
ADD COLUMN     "printingEnabled" BOOLEAN NOT NULL DEFAULT false;
