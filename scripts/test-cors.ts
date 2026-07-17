import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import net from 'node:net'

const allowedOrigin =
  process.env.FRONTEND_URL ??
  process.env.CORS_ALLOWED_ORIGINS?.split(',')[0]?.trim() ??
  'http://localhost:5173'
const requestedHeaders = 'Authorization, Content-Type, x-organization-id, ngrok-skip-browser-warning'

function assertCorsHeaders(response: {
  statusCode?: number
  headers: Headers | Record<string, string | string[] | undefined>
}, options: { expectPreflightHeaders?: boolean } = {}) {
  const getHeader = (name: string) => {
    if (response.headers instanceof Headers) {
      return response.headers.get(name)
    }

    const value = response.headers[name.toLowerCase()]
    return Array.isArray(value) ? value.join(', ') : value
  }

  assert.equal(getHeader('access-control-allow-origin'), allowedOrigin)
  assert.equal(getHeader('access-control-allow-credentials'), 'true')

  if (options.expectPreflightHeaders ?? true) {
    const allowHeaders = getHeader('access-control-allow-headers') ?? ''
    assert.match(allowHeaders, /Authorization/i)
    assert.match(allowHeaders, /Content-Type/i)
    assert.match(allowHeaders, /x-organization-id/i)
    assert.match(allowHeaders, /ngrok-skip-browser-warning/i)
  }
}

async function assertFastifyPreflight(app: any, url: string, method: string) {
  const response = await app.inject({
    method: 'OPTIONS',
    url,
    headers: {
      origin: allowedOrigin,
      'access-control-request-method': method,
      'access-control-request-headers': requestedHeaders
    }
  })

  assert.equal(response.statusCode, 204)
  assertCorsHeaders(response)
}

function assertWebSocketUpgrade(port: number) {
  return new Promise<void>((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64')
    const socket = net.connect(port, '127.0.0.1')
    let response = ''

    socket.setTimeout(5000)

    socket.on('connect', () => {
      socket.write([
        'GET /socket.io/?EIO=4&transport=websocket HTTP/1.1',
        `Host: 127.0.0.1:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        `Origin: ${allowedOrigin}`,
        '',
        ''
      ].join('\r\n'))
    })

    socket.on('data', chunk => {
      response += chunk.toString('utf8')

      if (response.includes('\r\n\r\n')) {
        try {
          assert.match(response, /^HTTP\/1\.1 101 Switching Protocols/)
          socket.destroy()
          resolve()
        } catch (error) {
          socket.destroy()
          reject(error)
        }
      }
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('WebSocket upgrade timed out'))
    })

    socket.on('error', reject)
  })
}

async function main() {
  process.env.NODE_ENV = 'test'
  process.env.CORS_ALLOWED_ORIGINS = allowedOrigin
  process.env.SOCKET_ALLOWED_ORIGINS = allowedOrigin

  const { app } = await import('../src/app.js')
  const { setupSocket } = await import('../src/lib/socket.js')

  try {
    await app.ready()

    await assertFastifyPreflight(app, '/orders/unified', 'GET')
    await assertFastifyPreflight(
      app,
      '/online-stores/test-store/orders/manual-sale',
      'POST'
    )

    setupSocket(app.server)

    await app.listen({
      port: 0,
      host: '127.0.0.1'
    })

    const address = app.server.address()
    assert.ok(address && typeof address === 'object')

    const port = address.port
    const baseUrl = `http://127.0.0.1:${port}`

    const socketPreflight = await fetch(
      `${baseUrl}/socket.io/?EIO=4&transport=polling`,
      {
        method: 'OPTIONS',
        headers: {
          origin: allowedOrigin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': requestedHeaders
        }
      }
    )

    assert.equal(socketPreflight.status, 204)
    assertCorsHeaders({
      statusCode: socketPreflight.status,
      headers: socketPreflight.headers
    })

    const polling = await fetch(
      `${baseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
      {
        headers: {
          origin: allowedOrigin
        }
      }
    )

    assert.equal(polling.status, 200)
    assertCorsHeaders({
      statusCode: polling.status,
      headers: polling.headers
    }, { expectPreflightHeaders: false })

    const pollingBody = await polling.text()
    assert.match(pollingBody, /^0\{/)

    await assertWebSocketUpgrade(port)
  } finally {
    await app.close().catch(() => undefined)
  }

  console.log('CORS preflight and Socket.IO polling/websocket checks passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
