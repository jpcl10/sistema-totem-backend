import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { uploadImageController } from '../controllers/upload-image-controller.js'

export async function uploadsRoutes(
  app: FastifyInstance
) {
  app.post(
    '/uploads/images',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute'
        }
      }
    },
    uploadImageController
  )
}