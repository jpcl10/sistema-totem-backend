-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ORDER_PAYMENT_STATUS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_MANUAL_MARKED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_PROVIDER_SETTINGS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_CLOSED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_PRODUCT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_PRODUCT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_PRODUCT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_LOGGED_IN';
ALTER TYPE "AuditAction" ADD VALUE 'USER_CREATED';
