-- CreateEnum
CREATE TYPE "NfcCardTransactionType" AS ENUM ('TOPUP', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'BONUS', 'REVERSAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'NFC_BALANCE_TOPUP';
ALTER TYPE "AuditAction" ADD VALUE 'NFC_BALANCE_DEBIT';
ALTER TYPE "AuditAction" ADD VALUE 'NFC_BALANCE_ADJUST';
ALTER TYPE "AuditAction" ADD VALUE 'NFC_BALANCE_REFUND';

-- CreateTable
CREATE TABLE "NfcCardTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "nfcCardId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NfcCardTransactionType" NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "balanceBeforeInCents" INTEGER NOT NULL,
    "balanceAfterInCents" INTEGER NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfcCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfcCardTransaction_organizationId_idx" ON "NfcCardTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "NfcCardTransaction_eventId_idx" ON "NfcCardTransaction"("eventId");

-- CreateIndex
CREATE INDEX "NfcCardTransaction_nfcCardId_idx" ON "NfcCardTransaction"("nfcCardId");

-- CreateIndex
CREATE INDEX "NfcCardTransaction_type_idx" ON "NfcCardTransaction"("type");

-- CreateIndex
CREATE INDEX "NfcCardTransaction_createdAt_idx" ON "NfcCardTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "NfcCardTransaction" ADD CONSTRAINT "NfcCardTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardTransaction" ADD CONSTRAINT "NfcCardTransaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardTransaction" ADD CONSTRAINT "NfcCardTransaction_nfcCardId_fkey" FOREIGN KEY ("nfcCardId") REFERENCES "NfcCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardTransaction" ADD CONSTRAINT "NfcCardTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
