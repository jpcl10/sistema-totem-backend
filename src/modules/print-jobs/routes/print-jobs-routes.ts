import { FastifyInstance } from 'fastify'
import { retryPrintJobController } from '../controllers/retry-print-job-controller.js'
import { cancelPrintJobController } from '../controllers/cancel-print-job-controller.js'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'

import { listPrintJobsController } from '../controllers/list-print-jobs-controller.js'
import { markPrintJobPrintedController } from '../controllers/mark-print-job-printed-controller.js'

export async function printJobsRoutes(
  app: FastifyInstance
) {

  app.get(
    '/events/:eventId/print-jobs',
    {
      preHandler: [verifyJWT]
    },
    listPrintJobsController
  )
  app.patch(
  '/print-jobs/:printJobId/cancel',
  {
    preHandler: [verifyJWT]
  },
  cancelPrintJobController
)

app.patch(
  '/print-jobs/:printJobId/printed',
  {
    preHandler: [verifyJWT]
  },
  markPrintJobPrintedController
)

app.patch(
  '/print-jobs/:printJobId/retry',
  {
    preHandler: [verifyJWT]
  },
  retryPrintJobController
)

}
