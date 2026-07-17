import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PaymentContextType,
  PaymentEnvironment,
  PaymentProvider
} from '@prisma/client'

import { prisma } from '../../lib/prisma.js'
import { PaymentSettingsResolver } from './payment-settings-resolver.js'

const organizationId = 'org-1'

function installPrismaMocks({
  organizationSettings,
  contextSettings = null,
  providerSettings = [],
  providerCredentials = []
}: {
  organizationSettings: any
  contextSettings?: any
  providerSettings?: any[]
  providerCredentials?: any[]
}) {
  const originals = {
    organizationPaymentSettingsFindUnique:
      prisma.organizationPaymentSettings.findUnique,
    contextPaymentSettingsFindFirst:
      prisma.contextPaymentSettings.findFirst,
    paymentProviderSettingsFindMany:
      prisma.paymentProviderSettings.findMany,
    paymentProviderCredentialFindMany:
      prisma.paymentProviderCredential.findMany
  }

  ;(prisma.organizationPaymentSettings.findUnique as any) =
    async () => organizationSettings
  ;(prisma.contextPaymentSettings.findFirst as any) =
    async () => contextSettings
  ;(prisma.paymentProviderSettings.findMany as any) =
    async () => providerSettings
  ;(prisma.paymentProviderCredential.findMany as any) =
    async () => providerCredentials

  return () => {
    ;(prisma.organizationPaymentSettings.findUnique as any) =
      originals.organizationPaymentSettingsFindUnique
    ;(prisma.contextPaymentSettings.findFirst as any) =
      originals.contextPaymentSettingsFindFirst
    ;(prisma.paymentProviderSettings.findMany as any) =
      originals.paymentProviderSettingsFindMany
    ;(prisma.paymentProviderCredential.findMany as any) =
      originals.paymentProviderCredentialFindMany
  }
}

function baseOrganizationSettings(overrides: Record<string, unknown> = {}) {
  return {
    organizationId,
    pixEnabled: true,
    creditEnabled: true,
    debitEnabled: true,
    cashEnabled: true,
    nfcBalanceEnabled: true,
    defaultProvider: PaymentProvider.MERCADO_PAGO,
    pixExpirationMinutes: 10,
    maxInstallments: 3,
    environment: PaymentEnvironment.PRODUCTION,
    ...overrides
  }
}

test('resolves organization settings inherited by event context', async () => {
  const restore = installPrismaMocks({
    organizationSettings: baseOrganizationSettings(),
    providerCredentials: [{
      provider: PaymentProvider.MERCADO_PAGO,
      active: true,
      encryptedCredentials: 'encrypted',
      environment: PaymentEnvironment.PRODUCTION
    }]
  })

  try {
    const result = await new PaymentSettingsResolver().resolve({
      organizationId,
      contextType: PaymentContextType.EVENT,
      eventId: 'event-1'
    })

    assert.equal(result.methods.pix, true)
    assert.equal(result.methods.credit, true)
    assert.equal(result.maxInstallments, 3)
    assert.deepEqual(result.providers, [{
      provider: PaymentProvider.MERCADO_PAGO,
      active: true,
      configured: true,
      environment: PaymentEnvironment.PRODUCTION
    }])
  } finally {
    restore()
  }
})

test('context override can disable an organization-enabled method', async () => {
  const restore = installPrismaMocks({
    organizationSettings: baseOrganizationSettings(),
    contextSettings: {
      pixEnabledOverride: false,
      creditEnabledOverride: null,
      debitEnabledOverride: null,
      cashEnabledOverride: null,
      nfcBalanceEnabledOverride: null,
      maxInstallmentsOverride: null,
      inheritOrganizationSettings: true
    }
  })

  try {
    const result = await new PaymentSettingsResolver().resolve({
      organizationId,
      contextType: PaymentContextType.EVENT,
      eventId: 'event-1'
    })

    assert.equal(result.methods.pix, false)
    assert.equal(result.methods.credit, true)
  } finally {
    restore()
  }
})

test('context cannot enable a method disabled by organization', async () => {
  const restore = installPrismaMocks({
    organizationSettings: baseOrganizationSettings({
      pixEnabled: false
    })
  })

  try {
    await assert.rejects(
      () => new PaymentSettingsResolver().assertContextCanEnableMethods({
        organizationId,
        pixEnabledOverride: true
      }),
      /disabled at organization level/
    )
  } finally {
    restore()
  }
})

test('resolver only returns provider configured flags, never credentials', async () => {
  const restore = installPrismaMocks({
    organizationSettings: baseOrganizationSettings(),
    providerCredentials: [{
      provider: PaymentProvider.MERCADO_PAGO,
      active: true,
      encryptedCredentials: 'secret-payload',
      environment: PaymentEnvironment.PRODUCTION
    }]
  })

  try {
    const result = await new PaymentSettingsResolver().resolve({
      organizationId
    })

    assert.equal('encryptedCredentials' in result.providers[0], false)
    assert.equal(result.providers[0].configured, true)
  } finally {
    restore()
  }
})
