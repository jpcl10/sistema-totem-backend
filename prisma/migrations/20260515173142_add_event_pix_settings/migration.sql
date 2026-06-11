-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "pixCity" TEXT,
ADD COLUMN     "pixEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pixInstructions" TEXT,
ADD COLUMN     "pixKey" TEXT,
ADD COLUMN     "pixReceiverName" TEXT;
