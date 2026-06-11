-- CreateTable
CREATE TABLE "PaymentProviderSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pixEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "terminalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "publicKey" TEXT,
    "webhookSecret" TEXT,
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProviderSettings_organizationId_idx" ON "PaymentProviderSettings"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentProviderSettings_provider_idx" ON "PaymentProviderSettings"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderSettings_organizationId_provider_key" ON "PaymentProviderSettings"("organizationId", "provider");

-- AddForeignKey
ALTER TABLE "PaymentProviderSettings" ADD CONSTRAINT "PaymentProviderSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
