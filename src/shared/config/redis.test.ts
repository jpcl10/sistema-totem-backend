import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function runConfigImport(env: Record<string, string | undefined>) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '-e',
      "await import('./src/shared/config/redis.ts')"
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      },
      encoding: 'utf-8'
    }
  )
}

test('allows development without Redis and defaults to legacy polling', () => {
  const result = runConfigImport({
    NODE_ENV: 'development',
    REDIS_ENABLED: 'false',
    REDIS_URL: '',
    PRINT_PROCESSING_MODE: undefined
  })

  assert.equal(result.status, 0)
})

test('rejects production Redis enabled without URL', () => {
  const result = runConfigImport({
    NODE_ENV: 'production',
    REDIS_ENABLED: 'true',
    REDIS_URL: '',
    PRINT_PROCESSING_MODE: undefined
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /REDIS_URL is required/)
})
