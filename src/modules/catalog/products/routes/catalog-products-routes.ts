import { FastifyInstance } from 'fastify'
import { listCatalogProductsController } from '../controllers/list-catalog-products-controller.js'
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js'
import { updateCatalogProductController } from '../controllers/update-catalog-product-controller.js'
import { createCatalogProductController } from '../controllers/create-catalog-product-controller.js'
import { uploadCatalogProductImageController } from '../controllers/upload-catalog-product-image-controller.js'

export async function catalogProductsRoutes(
  app: FastifyInstance
) {
  app.post(
    '/catalog/products',
    {
      preHandler: [verifyJWT]
    },
    createCatalogProductController
  )
  app.get(
    '/catalog/products',
    {
      preHandler: [verifyJWT]
    },
    listCatalogProductsController
  )
  app.patch(
    '/catalog/products/:id',
    {
      preHandler: [verifyJWT]
    },
    updateCatalogProductController
  )
  app.post(
    '/catalog/products/:id/image',
    {
      preHandler: [verifyJWT]
    },
    uploadCatalogProductImageController
  )

}