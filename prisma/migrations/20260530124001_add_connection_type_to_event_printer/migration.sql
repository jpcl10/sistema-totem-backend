-- CreateEnum
CREATE TYPE "PrinterConnectionType" AS ENUM ('TCP_IP', 'SK210_LOCAL');

-- AlterTable
ALTER TABLE "EventPrinter" ADD COLUMN     "connectionType" "PrinterConnectionType" NOT NULL DEFAULT 'TCP_IP';
