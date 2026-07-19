import 'dotenv/config'
import { app } from './app.js'
import { setupSocket } from './lib/socket.js'
import { startExpirePendingPixJob } from './jobs/expire-pending-pix-job.js'
import {
  startPrintProcessingCoordinator,
  stopPrintProcessingCoordinator
} from './infra/print-processing/print-processing-coordinator.js'
import { prisma } from './lib/prisma.js'

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

    await setupSocket(app.server)
    startExpirePendingPixJob()
    await startPrintProcessingCoordinator()

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

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down server')
  await stopPrintProcessingCoordinator()
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

start()
