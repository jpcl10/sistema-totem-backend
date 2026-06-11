import 'dotenv/config'
import { app } from './app.js'
import { setupSocket } from './lib/socket.js'

const start = async () => {
  try {
    setupSocket(app.server)

    await app.listen({
      port: 3333,
      host: '0.0.0.0'
    })

    console.log('HTTP + Socket Server Running 🚀')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()