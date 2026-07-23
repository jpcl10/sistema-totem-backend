import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PaymentEnvironment,
  PaymentProvider
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { encryptPaymentCredentials } from '../payment-credentials-crypto.js'
import { GetMercadoPagoStatusService } from './get-mercado-pago-status-service.js'

function installPrismaMocks(overrides: {
  organizationPaymentSettingsFindUnique?: (args: any) => Promise<any>
  paymentProviderCredentialFindFirst?: (args: any) => Promise<any>
  paymentProviderSettingsFindUnique?: (args: any) => Promise<any>
}) {
  const originals = {
    organizationPaymentSettingsFindUnique:
      prisma.organizationPaymentSettings.findUnique,
    paymentProviderCredentialFindFirst:
      prisma.paymentProviderCredential.findFirst,
    paymentProviderSettingsFindUnique:
      prisma.paymentProviderSettings.findUnique
  }

  ;(prisma.organizationPaymentSettings.findUnique as any) =
    overrides.organizationPaymentSettingsFindUnique ?? (async () => null)
  ;(prisma.paymentProviderCredential.findFirst as any) =
    overrides.paymentProviderCredentialFindFirst ?? (async () => null)
  ;(prisma.paymentProviderSettings.findUnique as any) =
    overrides.paymentProviderSettingsFindUnique ?? (async () => null)

  return () => {
    ;(prisma.organizationPaymentSettings.findUnique as any) =
      originals.organizationPaymentSettingsFindUnique
    ;(prisma.paymentProviderCredential.findFirst as any) =
      originals.paymentProviderCredentialFindFirst
    ;(prisma.paymentProviderSettings.findUnique as any) =
      originals.paymentProviderSettingsFindUnique
  }
}

test('Mercado Pago status is safe and never exposes access token', async () => {
  const previousSecret = process.env.PAYMENT_CREDENTIALS_SECRET
  process.env.PAYMENT_CREDENTIALS_SECRET = 'test-secret'

  const encrypted = encryptPaymentCredentials({
    accessToken: 'APP_USR-secret-token-123456',
    webhookSecret: 'webhook-secret',
    accountReference: 'mercado-pago-account-987654'
  })

  const restore = installPrismaMocks({
    organizationPaymentSettingsFindUnique: async () => ({
      pixEnabled: true,
      environment: PaymentEnvironment.PRODUCTION,
      updatedAt: new Date('2026-07-23T12:00:00.000Z')
    }),
    paymentProviderCredentialFindFirst: async (args) => {
      assert.equal(args.where.organizationId, 'org-1')
      assert.equal(args.where.provider, PaymentProvider.MERCADO_PAGO)
      return {
        encryptedCredentials: encrypted.encryptedPayload,
        publicMetadata: { accountId: 'public-account-1111' },
        active: true,
        updatedAt: new Date('2026-07-23T13:00:00.000Z')
      }
    }
  })

  try {
    const result = await new GetMercadoPagoStatusService().execute({
      organizationId: 'org-1'
    })
    const serialized = JSON.stringify(result)

    assert.equal(result.configured, true)
    assert.equal(result.pixEnabled, true)
    assert.equal(result.webhookReady, true)
    assert.equal(result.accountReference, '***7654')
    assert.equal(serialized.includes('APP_USR-secret-token-123456'), false)
    assert.equal(serialized.includes('webhook-secret'), false)
  } finally {
    restore()
    if (previousSecret === undefined) {
      delete process.env.PAYMENT_CREDENTIALS_SECRET
    } else {
      process.env.PAYMENT_CREDENTIALS_SECRET = previousSecret
    }
  }
})
