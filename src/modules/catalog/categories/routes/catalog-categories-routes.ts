import { FastifyInstance } from 'fastify'
import { listCatalogCategoriesController } from '../controllers/list-catalog-categories-controller.js'
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../../auth/middlewares/request-context.js'
import { updateCatalogCategoryController } from '../controllers/update-catalog-category-controller.js'
import { createCatalogCategoryController } from '../controllers/create-catalog-category-controller.js'
import { deleteCatalogCategoryController } from '../controllers/delete-catalog-category-controller.js'

export async function catalogCategoriesRoutes(
  app: FastifyInstance
) {
  app.post(
    '/catalog/categories',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    createCatalogCategoryController
  )
  app.get(
  '/catalog/categories',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  listCatalogCategoriesController
)
app.patch(
  '/catalog/categories/:id',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  updateCatalogCategoryController
)
app.delete(
  '/catalog/categories/:id',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  deleteCatalogCategoryController
)
}
