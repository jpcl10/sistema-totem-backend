import { FastifyInstance } from 'fastify'
import { createUserController } from '../controllers/create-user-controller.js'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { profileController } from '../controllers/profile-controller.js'

export async function usersRoutes(app: FastifyInstance) {
  app.post('/users', createUserController)

  app.get('/users/profile',
    {preHandler: [verifyJWT]},profileController
)
}