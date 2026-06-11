import { FastifyInstance } from 'fastify'
import { listEventProductsController } from '../controllers/list-event-products-controller.js'
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js'
import { deleteEventProductController } from '../controllers/delete-event-product-controller.js'
import { createEventProductController } from '../controllers/create-event-product-controller.js'
import { updateEventProductController } from '../controllers/update-event-product-controller.js'

export async function eventProductsRoutes(
  app: FastifyInstance
) {
  app.post(
    '/events/:eventId/catalog-products',
    {
      preHandler: [verifyJWT]
    },
    createEventProductController
  )
  app.get(
    '/events/:eventId/catalog-products',
    {
      preHandler: [verifyJWT]
    },
    listEventProductsController
  )
  app.delete(
    '/events/:eventId/catalog-products/:eventProductId',
    {
      preHandler: [verifyJWT]
    },
    deleteEventProductController
  )
  app.patch(
  '/events/:eventId/catalog-products/:eventProductId',
  {
    preHandler: [verifyJWT]
  },
  updateEventProductController
)
}