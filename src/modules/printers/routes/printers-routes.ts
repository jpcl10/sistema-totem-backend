import { FastifyInstance } from 'fastify'
import { listPrintersController } from '../controllers/list-printers-controller.js'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { updatePrinterController } from '../controllers/update-printer-controller.js'
import { createPrinterController } from '../controllers/create-printer-controller.js'
import { testPrinterController } from '../controllers/test-printer-controller.js'
export async function printersRoutes(
  app: FastifyInstance
) {
  app.post(
    '/events/:eventId/printers',
    {
      preHandler: [verifyJWT]
    },
    createPrinterController
  )

  app.get(
    '/events/:eventId/printers',
    {
      preHandler: [verifyJWT]
    },
    listPrintersController
  )
  app.patch(
  '/printers/:printerId',
  {
    preHandler: [verifyJWT]
  },
  updatePrinterController
)
  app.post(
  '/printers/:printerId/test',
  {
    preHandler: [verifyJWT]
  }, testPrinterController
)
}