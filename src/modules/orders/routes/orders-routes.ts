import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../auth/middlewares/request-context.js'
import { tryVerifyDeviceJWT } from '../../devices/middlewares/try-verify-device-jwt.js'
import { getPublicOrderController } from '../controllers/get-public-order-controller.js'

import { listPublicCallScreenOrdersController } from '../controllers/list-public-call-screen-orders-controller.js'
import { markOrderPaymentController } from '../controllers/mark-order-payment-controller.js'
import { markUnifiedOrderPaymentController } from '../controllers/mark-unified-order-payment-controller.js'
import {
  getPublicEventCallScreenController,
  getPublicStoreCallScreenController,
  listPublicEventCallScreenOrdersController,
  listPublicStoreCallScreenOrdersController
} from '../controllers/public-call-screen-controller.js'
import { createOrderController } from '../controllers/create-order-controller.js'
import { getFinancialSummaryController } from '../controllers/get-financial-summary-controller.js'
import { getEventFinancialSummaryController } from '../controllers/get-event-financial-summary-controller.js'
import { listOrdersController } from '../controllers/list-orders-controller.js'
import { listUnifiedOrdersController } from '../controllers/list-unified-orders-controller.js'
import { updateOrderPaymentStatusController } from '../controllers/update-order-payment-status-controller.js'
import { updateOrderStatusController } from '../controllers/update-order-status-controller.js'
import { createManualSaleController } from '../controllers/create-manual-sale-controller.js'

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
      preHandler: [verifyJWT, requireTenantContext],
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
    '/orders/unified',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listUnifiedOrdersController
  )

  app.patch(
    '/orders/unified/:orderType/:orderId/payment',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    markUnifiedOrderPaymentController
  )

  app.get(
    '/financial-summary',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    getFinancialSummaryController
  )

  app.get(
    '/events/:eventId/financial-summary',
    {
      preHandler: [verifyJWT, requireTenantContext],
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
      preHandler: [verifyJWT, requireTenantContext],
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
      preHandler: [verifyJWT, requireTenantContext],
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
      preHandler: [verifyJWT, requireTenantContext],
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
    '/public/call-screens/store/:slug',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    getPublicStoreCallScreenController
  )

  app.get(
    '/public/call-screens/store/:slug/orders',
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute'
        }
      }
    },
    listPublicStoreCallScreenOrdersController
  )

  app.get(
    '/public/call-screens/event/:slug',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    getPublicEventCallScreenController
  )

  app.get(
    '/public/call-screens/event/:slug/orders',
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute'
        }
      }
    },
    listPublicEventCallScreenOrdersController
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

  app.post(
    '/events/:eventId/orders/manual-sale',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute'
        }
      }
    },
    createManualSaleController
  )
}
