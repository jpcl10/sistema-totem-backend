-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX_MANUAL', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'COURTESY', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "amountPaidInCents" INTEGER,
ADD COLUMN     "changeForInCents" INTEGER,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentNotes" TEXT,
ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';
