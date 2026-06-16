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
      preHandler: [tryVerifyDeviceJWT]
    },
    createOrderController
  )

  app.get(
    '/events/:eventId/orders',
    {
      preHandler: [verifyJWT]
    },
    listOrdersController
  )

  app.get(
    '/events/:eventId/financial-summary',
    {
      preHandler: [verifyJWT]
    },
    getEventFinancialSummaryController
  )

  app.patch(
    '/orders/:id/status',
    {
      preHandler: [verifyJWT]
    },
    updateOrderStatusController
  )

  app.patch(
    '/orders/:orderId/payment-status',
    {
      preHandler: [verifyJWT]
    },
    updateOrderPaymentStatusController
  )

  app.patch(
    '/orders/:orderId/payment',
    {
      preHandler: [verifyJWT]
    },
    markOrderPaymentController
  )

  app.get(
    '/public/events/:slug/orders',
    listPublicCallScreenOrdersController
  )

  app.get(
    '/public/events/:slug/call-screen-orders',
    listPublicCallScreenOrdersController
  )

  app.get(
    '/public/orders/:orderId',
    getPublicOrderController
  )
}