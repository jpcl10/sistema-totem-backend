import assert from 'node:assert/strict'
import test from 'node:test'
import { z, ZodError } from 'zod'

import { app } from './app.js'

test('returns 400 for Zod validation errors', async () => {
  app.get('/test-zod-error', async () => {
    throw new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['status'],
        message: 'Required'
      } as any
    ] as any)
  })

  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/test-zod-error'
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().code, 'INVALID_REQUEST_BODY')
})
