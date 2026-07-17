import assert from 'node:assert/strict'
import test from 'node:test'

import { isOriginAllowed, validateCorsOrigin } from './cors.js'

function validateOrigin(origin: string | undefined) {
  return new Promise<{ error: Error | null, allow?: boolean }>((resolve) => {
    validateCorsOrigin(origin, (error, allow) => {
      resolve({ error, allow })
    })
  })
}

test('allows official Lovable published frontend', async () => {
  const origin = 'https://sweet-sync-wave.lovable.app'

  assert.equal(isOriginAllowed(origin), true)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, true)
})

test('allows valid Lovable preview subdomain', async () => {
  const origin = 'https://b9138c73-8bee-4df6-95ef-f0add2f6bd70.lovable.app'

  assert.equal(isOriginAllowed(origin), true)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, true)
})

test('allows Lovable root hostname over HTTPS', async () => {
  const origin = 'https://lovable.app'

  assert.equal(isOriginAllowed(origin), true)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, true)
})

test('blocks fake Lovable lookalike domain without returning an error', async () => {
  const origin = 'https://lovable.app.evil.com'

  assert.equal(isOriginAllowed(origin), false)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, false)
})

test('blocks non-HTTPS Lovable origin without returning an error', async () => {
  const origin = 'http://sweet-sync-wave.lovable.app'

  assert.equal(isOriginAllowed(origin), false)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, false)
})

test('allows configured localhost origin', async () => {
  const origin = 'http://localhost:5173'

  assert.equal(isOriginAllowed(origin), true)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, true)
})

test('blocks unauthorized origin without returning an error', async () => {
  const origin = 'https://example.com'

  assert.equal(isOriginAllowed(origin), false)

  const result = await validateOrigin(origin)

  assert.equal(result.error, null)
  assert.equal(result.allow, false)
})

test('allows requests without Origin header', async () => {
  assert.equal(isOriginAllowed(undefined), true)

  const result = await validateOrigin(undefined)

  assert.equal(result.error, null)
  assert.equal(result.allow, true)
})
