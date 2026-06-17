import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { listPaymentProviderSettingsController } from '../controllers/list-payment-provider-settings-controller.js'
import { upsertPaymentProviderSettingController } from '../controllers/upsert-payment-provider-setting-controller.js'

export async function paymentProviderSettingsRoutes(
  app: FastifyInstance
) {
  app.get(
    '/payment-provider-settings',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listPaymentProviderSettingsController
  )

  app.put(
    '/payment-provider-settings/:provider',
    {
      preHandler: [verifyJWT],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    upsertPaymentProviderSettingController
  )
}