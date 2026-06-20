-- CreateEnum
CREATE TYPE "NfcReadSource" AS ENUM ('ADMIN_PANEL', 'TOTEM', 'SK210', 'ACCESS_CONTROL');

-- CreateTable
CREATE TABLE "NfcCardRead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "nfcCardId" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "uid" TEXT NOT NULL,
    "source" "NfcReadSource" NOT NULL DEFAULT 'ADMIN_PANEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfcCardRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfcCardRead_organizationId_idx" ON "NfcCardRead"("organizationId");

-- CreateIndex
CREATE INDEX "NfcCardRead_eventId_idx" ON "NfcCardRead"("eventId");

-- CreateIndex
CREATE INDEX "NfcCardRead_nfcCardId_idx" ON "NfcCardRead"("nfcCardId");

-- CreateIndex
CREATE INDEX "NfcCardRead_userId_idx" ON "NfcCardRead"("userId");

-- CreateIndex
CREATE INDEX "NfcCardRead_deviceId_idx" ON "NfcCardRead"("deviceId");

-- CreateIndex
CREATE INDEX "NfcCardRead_createdAt_idx" ON "NfcCardRead"("createdAt");

-- AddForeignKey
ALTER TABLE "NfcCardRead" ADD CONSTRAINT "NfcCardRead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardRead" ADD CONSTRAINT "NfcCardRead_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardRead" ADD CONSTRAINT "NfcCardRead_nfcCardId_fkey" FOREIGN KEY ("nfcCardId") REFERENCES "NfcCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardRead" ADD CONSTRAINT "NfcCardRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcCardRead" ADD CONSTRAINT "NfcCardRead_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
