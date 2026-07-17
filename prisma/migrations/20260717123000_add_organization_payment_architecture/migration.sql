-- Payment architecture by organization, keeping event-level PIX fields as legacy fallback.

CREATE TYPE "PaymentEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "PaymentContextType" AS ENUM ('EVENT', 'ONLINE_STORE', 'POS');
CREATE TYPE "PaymentTerminalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
CREATE TYPE "PaymentRefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_SETTINGS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_METHOD_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_METHOD_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_TERMINAL_LINKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUND_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUND_COMPLETED';

ALTER TABLE "PaymentTransaction"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "onlineOrderId" TEXT,
  ADD COLUMN "terminalId" TEXT,
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "contextType" "PaymentContextType" NOT NULL DEFAULT 'EVENT',
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "storeId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "providerTransactionId" TEXT,
  ADD COLUMN "authorizationCode" TEXT,
  ADD COLUMN "nsu" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "installments" INTEGER;

UPDATE "PaymentTransaction" pt
SET
  "organizationId" = e."organizationId",
  "eventId" = o."eventId",
  "contextType" = 'EVENT'
FROM "Order" o
JOIN "Event" e ON e."id" = o."eventId"
WHERE pt."orderId" = o."id"
  AND pt."organizationId" IS NULL;

ALTER TABLE "PaymentTransaction"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "orderId" DROP NOT NULL;

CREATE TABLE "OrganizationPaymentSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "pixEnabled" BOOLEAN NOT NULL DEFAULT false,
  "creditEnabled" BOOLEAN NOT NULL DEFAULT false,
  "debitEnabled" BOOLEAN NOT NULL DEFAULT false,
  "cashEnabled" BOOLEAN NOT NULL DEFAULT true,
  "nfcBalanceEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultProvider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
  "pixExpirationMinutes" INTEGER NOT NULL DEFAULT 5,
  "maxInstallments" INTEGER NOT NULL DEFAULT 1,
  "environment" "PaymentEnvironment" NOT NULL DEFAULT 'PRODUCTION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderCredential" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "environment" "PaymentEnvironment" NOT NULL DEFAULT 'PRODUCTION',
  "encryptedCredentials" TEXT,
  "publicMetadata" JSONB,
  "keyVersion" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContextPaymentSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contextType" "PaymentContextType" NOT NULL,
  "eventId" TEXT,
  "onlineStoreId" TEXT,
  "inheritOrganizationSettings" BOOLEAN NOT NULL DEFAULT true,
  "pixEnabledOverride" BOOLEAN,
  "creditEnabledOverride" BOOLEAN,
  "debitEnabledOverride" BOOLEAN,
  "cashEnabledOverride" BOOLEAN,
  "nfcBalanceEnabledOverride" BOOLEAN,
  "maxInstallmentsOverride" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContextPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTerminal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "deviceId" TEXT,
  "eventId" TEXT,
  "onlineStoreId" TEXT,
  "provider" "PaymentProvider" NOT NULL,
  "externalTerminalId" TEXT NOT NULL,
  "status" "PaymentTerminalStatus" NOT NULL DEFAULT 'ACTIVE',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTerminal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "paymentTransactionId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "amountInCents" INTEGER NOT NULL,
  "reason" TEXT,
  "externalRefundId" TEXT,
  "idempotencyKey" TEXT,
  "gatewayStatus" TEXT,
  "gatewayMessage" TEXT,
  "metadata" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "provider" "PaymentProvider" NOT NULL,
  "externalEventId" TEXT,
  "externalPaymentId" TEXT,
  "idempotencyKey" TEXT,
  "eventType" TEXT,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "ignored" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "payload" JSONB,
  "headers" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentSettingsMigrationConflict" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conflictType" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentSettingsMigrationConflict_pkey" PRIMARY KEY ("id")
);

INSERT INTO "OrganizationPaymentSettings" (
  "id",
  "organizationId",
  "pixEnabled",
  "creditEnabled",
  "debitEnabled",
  "cashEnabled",
  "nfcBalanceEnabled",
  "defaultProvider",
  "pixExpirationMinutes",
  "maxInstallments",
  "environment",
  "createdAt",
  "updatedAt"
)
SELECT
  'opay_' || md5(o."id" || CURRENT_TIMESTAMP::text),
  o."id",
  COALESCE(bool_or(e."pixEnabled"), false) OR COALESCE(bool_or(pps."pixEnabled" AND pps."enabled"), false),
  COALESCE(bool_or(pps."cardEnabled" AND pps."enabled"), false),
  COALESCE(bool_or(pps."cardEnabled" AND pps."enabled"), false),
  true,
  false,
  CASE
    WHEN COALESCE(bool_or(pps."enabled" AND pps."provider" = 'MERCADO_PAGO'), false) THEN 'MERCADO_PAGO'::"PaymentProvider"
    ELSE 'MANUAL'::"PaymentProvider"
  END,
  LEAST(GREATEST(COALESCE(min(e."pixPaymentExpirationMinutes"), 5), 2), 60),
  1,
  'PRODUCTION',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
LEFT JOIN "Event" e ON e."organizationId" = o."id"
LEFT JOIN "PaymentProviderSettings" pps ON pps."organizationId" = o."id"
GROUP BY o."id";

INSERT INTO "PaymentProviderCredential" (
  "id",
  "organizationId",
  "provider",
  "environment",
  "encryptedCredentials",
  "publicMetadata",
  "keyVersion",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'pcred_' || md5(pps."organizationId" || pps."provider"::text || CURRENT_TIMESTAMP::text),
  pps."organizationId",
  pps."provider",
  'PRODUCTION',
  NULL,
  jsonb_build_object(
    'legacyProviderSettingsId', pps."id",
    'accessTokenConfigured', pps."accessToken" IS NOT NULL,
    'publicKeyConfigured', pps."publicKey" IS NOT NULL,
    'webhookSecretConfigured', pps."webhookSecret" IS NOT NULL,
    'webhookUrlConfigured', pps."webhookUrl" IS NOT NULL
  ),
  'legacy-reference',
  pps."enabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PaymentProviderSettings" pps
;

INSERT INTO "PaymentSettingsMigrationConflict" (
  "id",
  "organizationId",
  "conflictType",
  "details",
  "resolved",
  "createdAt"
)
SELECT
  'pconf_' || md5(conflicts."organizationId" || conflicts."conflictType" || CURRENT_TIMESTAMP::text),
  conflicts."organizationId",
  conflicts."conflictType",
  conflicts."details",
  false,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    e."organizationId",
    'EVENT_PIX_SETTINGS_DIVERGENCE' AS "conflictType",
    jsonb_agg(jsonb_build_object(
      'eventId', e."id",
      'eventName', e."name",
      'pixEnabled', e."pixEnabled",
      'pixKeyConfigured', e."pixKey" IS NOT NULL,
      'pixReceiverName', e."pixReceiverName",
      'pixCity', e."pixCity",
      'pixExpirationMinutes', e."pixPaymentExpirationMinutes"
    ) ORDER BY e."createdAt") AS "details"
  FROM "Event" e
  WHERE e."pixEnabled" = true
  GROUP BY e."organizationId"
  HAVING count(DISTINCT concat_ws('|',
    COALESCE(e."pixKey", ''),
    COALESCE(e."pixReceiverName", ''),
    COALESCE(e."pixCity", ''),
    e."pixPaymentExpirationMinutes"::text
  )) > 1
) conflicts;

CREATE UNIQUE INDEX "OrganizationPaymentSettings_organizationId_key" ON "OrganizationPaymentSettings"("organizationId");
CREATE UNIQUE INDEX "PaymentProviderCredential_organizationId_provider_environment_key" ON "PaymentProviderCredential"("organizationId", "provider", "environment");
CREATE UNIQUE INDEX "ContextPaymentSettings_organizationId_contextType_eventId_onlineStoreId_key" ON "ContextPaymentSettings"("organizationId", "contextType", "eventId", "onlineStoreId");
CREATE UNIQUE INDEX "PaymentTerminal_organizationId_provider_externalTerminalId_key" ON "PaymentTerminal"("organizationId", "provider", "externalTerminalId");
CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentWebhookEvent_idempotencyKey_key" ON "PaymentWebhookEvent"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");

CREATE INDEX "PaymentTransaction_organizationId_idx" ON "PaymentTransaction"("organizationId");
CREATE INDEX "PaymentTransaction_onlineOrderId_idx" ON "PaymentTransaction"("onlineOrderId");
CREATE INDEX "PaymentTransaction_terminalId_idx" ON "PaymentTransaction"("terminalId");
CREATE INDEX "PaymentTransaction_deviceId_idx" ON "PaymentTransaction"("deviceId");
CREATE INDEX "PaymentTransaction_contextType_idx" ON "PaymentTransaction"("contextType");
CREATE INDEX "PaymentTransaction_eventId_idx" ON "PaymentTransaction"("eventId");
CREATE INDEX "PaymentTransaction_storeId_idx" ON "PaymentTransaction"("storeId");
CREATE INDEX "PaymentProviderCredential_organizationId_idx" ON "PaymentProviderCredential"("organizationId");
CREATE INDEX "PaymentProviderCredential_provider_idx" ON "PaymentProviderCredential"("provider");
CREATE INDEX "PaymentProviderCredential_environment_idx" ON "PaymentProviderCredential"("environment");
CREATE INDEX "PaymentProviderCredential_active_idx" ON "PaymentProviderCredential"("active");
CREATE INDEX "ContextPaymentSettings_organizationId_idx" ON "ContextPaymentSettings"("organizationId");
CREATE INDEX "ContextPaymentSettings_eventId_idx" ON "ContextPaymentSettings"("eventId");
CREATE INDEX "ContextPaymentSettings_onlineStoreId_idx" ON "ContextPaymentSettings"("onlineStoreId");
CREATE INDEX "ContextPaymentSettings_contextType_idx" ON "ContextPaymentSettings"("contextType");
CREATE INDEX "PaymentTerminal_organizationId_idx" ON "PaymentTerminal"("organizationId");
CREATE INDEX "PaymentTerminal_deviceId_idx" ON "PaymentTerminal"("deviceId");
CREATE INDEX "PaymentTerminal_eventId_idx" ON "PaymentTerminal"("eventId");
CREATE INDEX "PaymentTerminal_onlineStoreId_idx" ON "PaymentTerminal"("onlineStoreId");
CREATE INDEX "PaymentTerminal_provider_idx" ON "PaymentTerminal"("provider");
CREATE INDEX "PaymentTerminal_active_idx" ON "PaymentTerminal"("active");
CREATE INDEX "PaymentRefund_organizationId_idx" ON "PaymentRefund"("organizationId");
CREATE INDEX "PaymentRefund_paymentTransactionId_idx" ON "PaymentRefund"("paymentTransactionId");
CREATE INDEX "PaymentRefund_provider_idx" ON "PaymentRefund"("provider");
CREATE INDEX "PaymentRefund_status_idx" ON "PaymentRefund"("status");
CREATE INDEX "PaymentWebhookEvent_organizationId_idx" ON "PaymentWebhookEvent"("organizationId");
CREATE INDEX "PaymentWebhookEvent_provider_idx" ON "PaymentWebhookEvent"("provider");
CREATE INDEX "PaymentWebhookEvent_externalPaymentId_idx" ON "PaymentWebhookEvent"("externalPaymentId");
CREATE INDEX "PaymentWebhookEvent_processed_idx" ON "PaymentWebhookEvent"("processed");
CREATE INDEX "PaymentWebhookEvent_createdAt_idx" ON "PaymentWebhookEvent"("createdAt");
CREATE INDEX "PaymentSettingsMigrationConflict_organizationId_idx" ON "PaymentSettingsMigrationConflict"("organizationId");
CREATE INDEX "PaymentSettingsMigrationConflict_conflictType_idx" ON "PaymentSettingsMigrationConflict"("conflictType");
CREATE INDEX "PaymentSettingsMigrationConflict_resolved_idx" ON "PaymentSettingsMigrationConflict"("resolved");

ALTER TABLE "OrganizationPaymentSettings" ADD CONSTRAINT "OrganizationPaymentSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProviderCredential" ADD CONSTRAINT "PaymentProviderCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContextPaymentSettings" ADD CONSTRAINT "ContextPaymentSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContextPaymentSettings" ADD CONSTRAINT "ContextPaymentSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContextPaymentSettings" ADD CONSTRAINT "ContextPaymentSettings_onlineStoreId_fkey" FOREIGN KEY ("onlineStoreId") REFERENCES "OnlineStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTerminal" ADD CONSTRAINT "PaymentTerminal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTerminal" ADD CONSTRAINT "PaymentTerminal_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTerminal" ADD CONSTRAINT "PaymentTerminal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTerminal" ADD CONSTRAINT "PaymentTerminal_onlineStoreId_fkey" FOREIGN KEY ("onlineStoreId") REFERENCES "OnlineStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentSettingsMigrationConflict" ADD CONSTRAINT "PaymentSettingsMigrationConflict_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_onlineOrderId_fkey" FOREIGN KEY ("onlineOrderId") REFERENCES "OnlineOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "PaymentTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
