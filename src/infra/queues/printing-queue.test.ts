import assert from 'node:assert/strict'
import test from 'node:test'

import { enqueuePrintJob } from './printing-queue.js'

test('does not enqueue print jobs when Redis is disabled', async () => {
  const result = await enqueuePrintJob('print-1')

  assert.deepEqual(result, {
    enqueued: false,
    reason: 'redis_disabled'
  })
})
