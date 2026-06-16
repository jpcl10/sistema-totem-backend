-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "pixPaymentExpirationMinutes" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PaymentTransaction_expiresAt_idx" ON "PaymentTransaction"("expiresAt");
