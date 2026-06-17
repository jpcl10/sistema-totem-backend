import { Server } from 'socket.io'

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
    console.log('Socket connected:', socket.id)

    socket.on('join-event-room', (eventId: string) => {
      socket.join(`event:${eventId}`)
      console.log(`Socket ${socket.id} joined event:${eventId}`)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id)
    })
  })
}