import { FastifyInstance } from 'fastify'

import { verifyJWT }
  from '../../auth/middlewares/verify-jwt.js'

import { listPendingDevicePrintJobsController }
  from '../controllers/list-pending-device-print-jobs-controller.js'

import { markDevicePrintJobPrintedController }
  from '../controllers/mark-device-print-job-printed-controller.js'

import { markDevicePrintJobErrorController }
  from '../controllers/mark-device-print-job-error-controller.js'

export async function devicePrintJobsRoutes(
  app: FastifyInstance
) {
  app.get(
    '/device/print-jobs/pending',
    {
      preHandler: [verifyJWT]
    },
    listPendingDevicePrintJobsController
  )

  app.patch(
    '/device/print-jobs/:printJobId/printed',
    {
      preHandler: [verifyJWT]
    },
    markDevicePrintJobPrintedController
  )

  app.patch(
    '/device/print-jobs/:printJobId/error',
    {
      preHandler: [verifyJWT]
    },
    markDevicePrintJobErrorController
  )
}