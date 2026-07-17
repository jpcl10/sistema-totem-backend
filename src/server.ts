import 'dotenv/config'
import { app } from './app.js'
import { setupSocket } from './lib/socket.js'
import { startExpirePendingPixJob } from './jobs/expire-pending-pix-job.js'

const parsePort = () => {
  const port = Number(process.env.PORT ?? 3333)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`)
  }

  return port
}

const start = async () => {
  try {
    const port = parsePort()

    setupSocket(app.server)
    startExpirePendingPixJob()

    await app.listen({
      port,
      host: '0.0.0.0'
    })

    app.log.info('HTTP + Socket Server Running 🚀')
    app.log.info('PIX Expiration Job Running ⏰')
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()
