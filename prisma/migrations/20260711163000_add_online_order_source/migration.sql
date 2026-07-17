-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('DIGITAL_MENU', 'WHATSAPP', 'ADMIN', 'POS', 'API');

-- AlterTable
ALTER TABLE "OnlineOrder"
ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'DIGITAL_MENU';
