import { Server } from 'socket.io'
import { logger } from './logger.js'

export let io: Server

export function setupSocket(server: any, allowedOrigins: string[]) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true)
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true)
        }

        return callback(new Error('Not allowed by CORS'), false)
      }
    }
  })

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Socket connected')

    socket.on('join-event-room', (eventId: string) => {
      socket.join(`event:${eventId}`)
      logger.info({ socketId: socket.id, eventId }, 'Socket joined event room')
    })

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket disconnected')
    })
  })
}