-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "Order_deviceId_idx" ON "Order"("deviceId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
