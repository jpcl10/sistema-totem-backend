import { FastifyInstance } from 'fastify'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../auth/middlewares/request-context.js'

// Public controllers
import { getPublicStoreController } from '../controllers/get-public-store-controller.js'
import { createOnlineOrderController } from '../controllers/create-online-order-controller.js'
import { getCustomerByPhoneController } from '../controllers/get-customer-by-phone-controller.js'
import { getCustomerOrdersController } from '../controllers/get-customer-orders-controller.js'

// Admin controllers
import { listOnlineStoresController } from '../controllers/list-online-stores-controller.js'
import { createOnlineStoreController } from '../controllers/create-online-store-controller.js'
import { getOnlineStoreController } from '../controllers/get-online-store-controller.js'
import { updateOnlineStoreController } from '../controllers/update-online-store-controller.js'
import { listOnlineOrdersController } from '../controllers/list-online-orders-controller.js'
import { updateOnlineOrderStatusController } from '../controllers/update-online-order-status-controller.js'
import { getOnlineStoreSummaryController } from '../controllers/get-online-store-summary-controller.js'
import { createManualOnlineOrderController } from '../controllers/create-manual-online-order-controller.js'
import { getOnlineStoreAvailabilityController } from '../controllers/get-online-store-availability-controller.js'
import { updateOnlineStoreAvailabilityController } from '../controllers/update-online-store-availability-controller.js'

export async function onlineStoresRoutes(app: FastifyInstance) {
  // Public routes
  app.get(
    '/public/stores/:slug',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    getPublicStoreController
  )

  app.get(
    '/public/stores/:slug/customers/by-phone',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    getCustomerByPhoneController
  )

  app.get(
    '/public/stores/:slug/customers/:customerId/orders',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    getCustomerOrdersController
  )

  app.post(
    '/public/stores/:slug/orders',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute'
        }
      }
    },
    createOnlineOrderController
  )

  // Admin routes
  app.get(
    '/online-stores',
    { preHandler: [verifyJWT, requireTenantContext] },
    listOnlineStoresController
  )

  app.post(
    '/online-stores',
    { preHandler: [verifyJWT, requireTenantContext] },
    createOnlineStoreController
  )

  app.get(
    '/online-stores/:id',
    { preHandler: [verifyJWT, requireTenantContext] },
    getOnlineStoreController
  )

  app.patch(
    '/online-stores/:id',
    { preHandler: [verifyJWT, requireTenantContext] },
    updateOnlineStoreController
  )

  app.get(
    '/online-stores/:storeId/summary',
    { preHandler: [verifyJWT, requireTenantContext] },
    getOnlineStoreSummaryController
  )

  app.get(
    '/online-stores/:storeId/availability',
    { preHandler: [verifyJWT, requireTenantContext] },
    getOnlineStoreAvailabilityController
  )

  app.patch(
    '/online-stores/:storeId/availability',
    { preHandler: [verifyJWT, requireTenantContext] },
    updateOnlineStoreAvailabilityController
  )

  app.get(
    '/online-stores/:storeId/orders',
    { preHandler: [verifyJWT, requireTenantContext] },
    listOnlineOrdersController
  )

  app.post(
    '/online-stores/:storeId/orders/manual-sale',
    { preHandler: [verifyJWT, requireTenantContext] },
    createManualOnlineOrderController
  )

  app.patch(
    '/online-orders/:orderId/status',
    { preHandler: [verifyJWT, requireTenantContext] },
    updateOnlineOrderStatusController
  )
}
