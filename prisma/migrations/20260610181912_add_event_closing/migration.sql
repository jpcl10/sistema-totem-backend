-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventClosing" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "totalOrders" INTEGER NOT NULL,
    "paidOrders" INTEGER NOT NULL,
    "pendingOrders" INTEGER NOT NULL,
    "cancelledOrders" INTEGER NOT NULL,
    "receivedInCents" INTEGER NOT NULL,
    "pendingInCents" INTEGER NOT NULL,
    "cancelledInCents" INTEGER NOT NULL,
    "averageTicketInCents" INTEGER NOT NULL,
    "pixManualInCents" INTEGER NOT NULL DEFAULT 0,
    "pixAutomaticInCents" INTEGER NOT NULL DEFAULT 0,
    "cashInCents" INTEGER NOT NULL DEFAULT 0,
    "creditCardInCents" INTEGER NOT NULL DEFAULT 0,
    "debitCardInCents" INTEGER NOT NULL DEFAULT 0,
    "courtesyInCents" INTEGER NOT NULL DEFAULT 0,
    "otherInCents" INTEGER NOT NULL DEFAULT 0,
    "printPendingCount" INTEGER NOT NULL DEFAULT 0,
    "printPrintedCount" INTEGER NOT NULL DEFAULT 0,
    "printErrorCount" INTEGER NOT NULL DEFAULT 0,
    "printCancelledCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventClosing_organizationId_idx" ON "EventClosing"("organizationId");

-- CreateIndex
CREATE INDEX "EventClosing_closedByUserId_idx" ON "EventClosing"("closedByUserId");

-- CreateIndex
CREATE INDEX "EventClosing_closedAt_idx" ON "EventClosing"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventClosing_eventId_key" ON "EventClosing"("eventId");

-- AddForeignKey
ALTER TABLE "EventClosing" ADD CONSTRAINT "EventClosing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventClosing" ADD CONSTRAINT "EventClosing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventClosing" ADD CONSTRAINT "EventClosing_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
