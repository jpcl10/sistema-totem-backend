import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { verifyDeviceJWT } from '../middlewares/verify-device-jwt.js'
import { deviceHeartbeatController } from '../controllers/device-heartbeat-controller.js'




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
  // Rotas públicas do dispositivo
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

  // Rotas administrativas
  app.addHook(
    'preHandler',
    verifyJWT
  )

  app.post(
    '/devices',
    createDeviceController
  )

  app.get(
    '/devices',
    listDevicesController
  )

  app.get(
    '/devices/:id',
    getDeviceController
  )

  app.patch(
    '/devices/:id',
    updateDeviceController
  )

  app.post(
    '/devices/:id/regenerate-credentials',
    regenerateDeviceCredentialsController
  )
  app.post(
  '/devices/heartbeat',
  {
    preHandler: verifyDeviceJWT
  },
  deviceHeartbeatController
)
}