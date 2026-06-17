import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { listEventAuditLogsController } from '../controllers/list-event-audit-logs-controller.js'

export async function auditLogsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', verifyJWT)

  app.get(
    '/events/:eventId/audit-logs',
    {
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listEventAuditLogsController
  )
}
