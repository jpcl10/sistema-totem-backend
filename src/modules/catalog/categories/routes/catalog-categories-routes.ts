import { FastifyInstance } from 'fastify'
import { listCatalogCategoriesController } from '../controllers/list-catalog-categories-controller.js'
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js'
import { updateCatalogCategoryController } from '../controllers/update-catalog-category-controller.js'
import { createCatalogCategoryController } from '../controllers/create-catalog-category-controller.js'

export async function catalogCategoriesRoutes(
  app: FastifyInstance
) {
  app.post(
    '/catalog/categories',
    {
      preHandler: [verifyJWT]
    },
    createCatalogCategoryController
  )
  app.get(
  '/catalog/categories',
  {
    preHandler: [verifyJWT]
  },
  listCatalogCategoriesController
)
app.patch(
  '/catalog/categories/:id',
  {
    preHandler: [verifyJWT]
  },
  updateCatalogCategoryController
)
}