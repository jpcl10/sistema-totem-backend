import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../auth/middlewares/request-context.js'

import { getEventMetricsController } from '../controllers/get-event-metrics-controller.js'

export async function metricsRoutes(
  app: FastifyInstance
) {
  app.addHook('preHandler', verifyJWT)
  app.addHook('preHandler', requireTenantContext)

  app.get(
    '/events/:eventId/metrics',
    {
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    getEventMetricsController
  )
}
