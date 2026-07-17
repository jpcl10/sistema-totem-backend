-- Extend the existing print queue so online/manual store orders can reuse it.
ALTER TABLE "OnlineStore"
ADD COLUMN "printingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoPrintEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "printMode" "PrintMode" NOT NULL DEFAULT 'FULL_ORDER',
ADD COLUMN "printerPaperSize" TEXT NOT NULL DEFAULT '80mm';

ALTER TABLE "OnlineOrder"
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paidAt" TIMESTAMP(3);

ALTER TABLE "OrderItem"
ADD COLUMN "notes" TEXT;

ALTER TABLE "Device"
ADD COLUMN "storeId" TEXT;

ALTER TABLE "EventPrintJob"
ADD COLUMN "storeId" TEXT,
ADD COLUMN "onlineOrderId" TEXT,
ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "EventPrintJob" ALTER COLUMN "eventId" DROP NOT NULL;
ALTER TABLE "EventPrintJob" ALTER COLUMN "orderId" DROP NOT NULL;

CREATE UNIQUE INDEX "EventPrintJob_idempotencyKey_key" ON "EventPrintJob"("idempotencyKey");
CREATE INDEX "Device_storeId_idx" ON "Device"("storeId");
CREATE INDEX "EventPrintJob_eventId_idx" ON "EventPrintJob"("eventId");
CREATE INDEX "EventPrintJob_orderId_idx" ON "EventPrintJob"("orderId");
CREATE INDEX "EventPrintJob_storeId_idx" ON "EventPrintJob"("storeId");
CREATE INDEX "EventPrintJob_onlineOrderId_idx" ON "EventPrintJob"("onlineOrderId");

ALTER TABLE "Device"
ADD CONSTRAINT "Device_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventPrintJob"
ADD CONSTRAINT "EventPrintJob_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventPrintJob"
ADD CONSTRAINT "EventPrintJob_onlineOrderId_fkey"
FOREIGN KEY ("onlineOrderId") REFERENCES "OnlineOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
