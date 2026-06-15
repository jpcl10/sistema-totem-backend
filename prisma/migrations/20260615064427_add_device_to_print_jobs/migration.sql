-- AlterTable
ALTER TABLE "EventPrintJob" ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "EventPrintJob_deviceId_idx" ON "EventPrintJob"("deviceId");

-- AddForeignKey
ALTER TABLE "EventPrintJob" ADD CONSTRAINT "EventPrintJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
