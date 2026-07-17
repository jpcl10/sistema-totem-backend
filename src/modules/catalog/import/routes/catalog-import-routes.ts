import { FastifyInstance } from 'fastify'
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../../auth/middlewares/request-context.js'
import { importCatalogController } from '../controllers/import-catalog-controller.js'

export async function catalogImportRoutes(app: FastifyInstance) {
  app.post(
    '/catalog/import',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    importCatalogController
  )
}
