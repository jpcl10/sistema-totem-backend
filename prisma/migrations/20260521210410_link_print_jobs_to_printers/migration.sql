-- AlterTable
ALTER TABLE "EventPrintJob" ADD COLUMN     "printerId" TEXT;

-- AddForeignKey
ALTER TABLE "EventPrintJob" ADD CONSTRAINT "EventPrintJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "EventPrinter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
