import 'dotenv/config'
import { app } from './app.js'
import { setupSocket } from './lib/socket.js'
import { startExpirePendingPixJob } from './jobs/expire-pending-pix-job.js'

const start = async () => {
  try {
    setupSocket(app.server)
    startExpirePendingPixJob()

    await app.listen({
      port: 3333,
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
