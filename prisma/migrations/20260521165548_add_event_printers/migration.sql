-- CreateEnum
CREATE TYPE "PrinterSector" AS ENUM ('FULL_ORDER', 'BAR', 'KITCHEN');

-- CreateTable
CREATE TABLE "EventPrinter" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" "PrinterSector" NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "paperSize" TEXT NOT NULL DEFAULT '80mm',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPrinter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EventPrinter" ADD CONSTRAINT "EventPrinter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
