import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'

import { getEventMetricsController } from '../controllers/get-event-metrics-controller.js'

export async function metricsRoutes(
  app: FastifyInstance
) {
  app.addHook('preHandler', verifyJWT)

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
