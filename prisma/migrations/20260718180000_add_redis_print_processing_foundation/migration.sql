ALTER TYPE "PrintJobStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PrintJobStatus" ADD VALUE IF NOT EXISTS 'RETRY';
ALTER TYPE "PrintJobStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE "EventPrintJob"
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT,
ADD COLUMN "failedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "EventPrintJob_status_lockedAt_idx" ON "EventPrintJob"("status", "lockedAt");
CREATE INDEX "EventPrintJob_lockedBy_idx" ON "EventPrintJob"("lockedBy");
