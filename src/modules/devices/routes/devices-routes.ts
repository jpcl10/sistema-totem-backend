import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { verifyDeviceJWT } from '../middlewares/verify-device-jwt.js'

import { deviceHeartbeatController } from '../controllers/device-heartbeat-controller.js'
import { listDevicePendingPrintJobsController } from '../controllers/list-device-pending-print-jobs-controller.js'
import { markDevicePrintJobPrintedController } from '../controllers/mark-device-print-job-printed-controller.js'
import { markDevicePrintJobErrorController } from '../controllers/mark-device-print-job-error-controller.js'

import { activateDeviceController } from '../controllers/activate-device-controller.js'
import { createDeviceController } from '../controllers/create-device-controller.js'
import { listDevicesController } from '../controllers/list-devices-controller.js'
import { getDeviceController } from '../controllers/get-device-controller.js'
import { updateDeviceController } from '../controllers/update-device-controller.js'
import { regenerateDeviceCredentialsController } from '../controllers/regenerate-device-credentials-controller.js'
import { getDeviceConfigController } from '../controllers/get-device-config-controller.js'

export async function devicesRoutes(
  app: FastifyInstance
) {
  app.post(
    '/devices/activate',
    activateDeviceController
  )

  app.get(
    '/devices/me/config',
    {
      preHandler: verifyDeviceJWT
    },
    getDeviceConfigController
  )

  app.post(
    '/devices/heartbeat',
    {
      preHandler: verifyDeviceJWT
    },
    deviceHeartbeatController
  )

  app.get(
    '/devices/print-jobs/pending',
    {
      preHandler: verifyDeviceJWT
    },
    listDevicePendingPrintJobsController
  )

  app.patch(
    '/devices/print-jobs/:id/printed',
    {
      preHandler: verifyDeviceJWT
    },
    markDevicePrintJobPrintedController
  )

  app.patch(
    '/devices/print-jobs/:id/error',
    {
      preHandler: verifyDeviceJWT
    },
    markDevicePrintJobErrorController
  )

  app.post(
    '/devices',
    {
      preHandler: verifyJWT
    },
    createDeviceController
  )

  app.get(
    '/devices',
    {
      preHandler: verifyJWT
    },
    listDevicesController
  )

  app.get(
    '/devices/:id',
    {
      preHandler: verifyJWT
    },
    getDeviceController
  )

  app.patch(
    '/devices/:id',
    {
      preHandler: verifyJWT
    },
    updateDeviceController
  )

  app.post(
    '/devices/:id/regenerate-credentials',
    {
      preHandler: verifyJWT
    },
    regenerateDeviceCredentialsController
  )
}