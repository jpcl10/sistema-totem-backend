import { FastifyInstance } from 'fastify'
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../../auth/middlewares/request-context.js'
import { createCatalogProductOptionGroupController } from '../controllers/create-catalog-product-option-group-controller.js'
import { listCatalogProductOptionGroupsController } from '../controllers/list-catalog-product-option-groups-controller.js'
import { updateCatalogProductOptionGroupController } from '../controllers/update-catalog-product-option-group-controller.js'
import { patchCatalogProductOptionGroupStatusController } from '../controllers/patch-catalog-product-option-group-status-controller.js'
import { createCatalogProductOptionController } from '../controllers/create-catalog-product-option-controller.js'
import { updateCatalogProductOptionController } from '../controllers/update-catalog-product-option-controller.js'
import { patchCatalogProductOptionStatusController } from '../controllers/patch-catalog-product-option-status-controller.js'

export async function productOptionsRoutes(app: FastifyInstance) {
  // Option Groups
  app.post(
    '/catalog/products/:productId/option-groups',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    createCatalogProductOptionGroupController
  )

  app.get(
    '/catalog/products/:productId/option-groups',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listCatalogProductOptionGroupsController
  )

  app.put(
    '/catalog/option-groups/:groupId',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    updateCatalogProductOptionGroupController
  )

  app.patch(
    '/catalog/option-groups/:groupId/status',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    patchCatalogProductOptionGroupStatusController
  )

  // Options
  app.post(
    '/catalog/option-groups/:groupId/options',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    createCatalogProductOptionController
  )

  app.put(
    '/catalog/options/:optionId',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    updateCatalogProductOptionController
  )

  app.patch(
    '/catalog/options/:optionId/status',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    patchCatalogProductOptionStatusController
  )
}
