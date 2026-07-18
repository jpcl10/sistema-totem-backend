import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeAuditMetadata } from './create-audit-log-service.js'

test('audit metadata sanitizer redacts sensitive credential values recursively', () => {
  const metadata = sanitizeAuditMetadata({
    provider: 'MERCADO_PAGO',
    accessToken: 'secret-token',
    nested: {
      webhookSecret: 'secret-webhook',
      publicKeyConfigured: true,
      beforeData: null
    },
    credentials: [
      {
        privateKey: 'secret-private-key',
        field: 'accessToken'
      }
    ]
  }) as Record<string, unknown>

  assert.equal(metadata.accessToken, '[REDACTED]')
  assert.deepEqual(metadata.nested, {
    webhookSecret: '[REDACTED]',
    publicKeyConfigured: true,
    beforeData: null
  })
  assert.deepEqual(metadata.credentials, [
    {
      privateKey: '[REDACTED]',
      field: 'accessToken'
    }
  ])
})
