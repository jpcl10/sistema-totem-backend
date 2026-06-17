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
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    createEventProductController
  )
  app.get(
    '/events/:eventId/catalog-products',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listEventProductsController
  )
  app.delete(
    '/events/:eventId/catalog-products/:eventProductId',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    deleteEventProductController
  )
  app.patch(
  '/events/:eventId/catalog-products/:eventProductId',
  {
    preHandler: [verifyJWT],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  updateEventProductController
)
}