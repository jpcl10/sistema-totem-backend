-- CreateEnum
CREATE TYPE "NfcCardType" AS ENUM ('CUSTOMER', 'STAFF', 'VIP', 'COMANDA');

-- CreateEnum
CREATE TYPE "NfcCardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'LOST');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'NFC_CARD_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NFC_CARD_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'NFC_CARD_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'NFC_CARD_READ';

-- CreateTable
CREATE TABLE "NfcCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "code" TEXT,
    "holderName" TEXT,
    "type" "NfcCardType" NOT NULL DEFAULT 'CUSTOMER',
    "status" "NfcCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "balanceInCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfcCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfcCard_uid_key" ON "NfcCard"("uid");

-- CreateIndex
CREATE INDEX "NfcCard_organizationId_idx" ON "NfcCard"("organizationId");

-- CreateIndex
CREATE INDEX "NfcCard_eventId_idx" ON "NfcCard"("eventId");

-- CreateIndex
CREATE INDEX "NfcCard_uid_idx" ON "NfcCard"("uid");

-- CreateIndex
CREATE INDEX "NfcCard_status_idx" ON "NfcCard"("status");

-- CreateIndex
CREATE INDEX "NfcCard_type_idx" ON "NfcCard"("type");

-- AddForeignKey
ALTER TABLE "NfcCard" ADD CONSTRAINT "NfcCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCard" ADD CONSTRAINT "NfcCard_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
