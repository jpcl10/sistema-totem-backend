import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { tryVerifyDeviceJWT } from '../../devices/middlewares/try-verify-device-jwt.js'
import { getPublicOrderController } from '../controllers/get-public-order-controller.js'

import { listPublicCallScreenOrdersController } from '../controllers/list-public-call-screen-orders-controller.js'
import { markOrderPaymentController } from '../controllers/mark-order-payment-controller.js'
import { createOrderController } from '../controllers/create-order-controller.js'
import { getEventFinancialSummaryController } from '../controllers/get-event-financial-summary-controller.js'
import { listOrdersController } from '../controllers/list-orders-controller.js'
import { updateOrderPaymentStatusController } from '../controllers/update-order-payment-status-controller.js'
import { updateOrderStatusController } from '../controllers/update-order-status-controller.js'

export async function ordersRoutes(
  app: FastifyInstance
) {
  app.post(
    '/public/events/:slug/orders',
    {
      preHandler: [tryVerifyDeviceJWT],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    createOrderController
  )

  app.get(
    '/events/:eventId/orders',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listOrdersController
  )

  app.get(
    '/events/:eventId/financial-summary',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    getEventFinancialSummaryController
  )

  app.patch(
    '/orders/:id/status',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    updateOrderStatusController
  )

  app.patch(
    '/orders/:orderId/payment-status',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    updateOrderPaymentStatusController
  )

  app.patch(
    '/orders/:orderId/payment',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    markOrderPaymentController
  )

  app.get(
    '/public/events/:slug/orders',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    listPublicCallScreenOrdersController
  )

  app.get(
    '/public/events/:slug/call-screen-orders',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    listPublicCallScreenOrdersController
  )

  app.get(
    '/public/orders/:orderId',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    getPublicOrderController
  )
}