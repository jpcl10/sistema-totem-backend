-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'PAYMENT_CREATED', 'PAYMENT_APPROVED', 'PAYMENT_EXPIRED', 'PAYMENT_REJECTED', 'PAYMENT_REFUNDED', 'EVENT_CREATED', 'EVENT_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'IMAGE_UPLOADED', 'DEVICE_CREATED', 'DEVICE_ACTIVATED', 'DEVICE_REVOKED', 'PRINT_JOB_CREATED', 'PRINT_JOB_PRINTED', 'PRINT_JOB_ERROR');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "userId" TEXT,
    "deviceId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" "AuditAction" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_eventId_idx" ON "AuditLog"("eventId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_deviceId_idx" ON "AuditLog"("deviceId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
