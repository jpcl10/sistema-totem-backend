import { FastifyInstance } from 'fastify'

import { authenticateController } from '../controllers/authenticate-controller.js'

export async function authRoutes(app: FastifyInstance) {

  app.post(
    '/sessions',
    authenticateController
  )

}