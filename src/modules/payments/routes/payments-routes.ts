import { FastifyInstance } from 'fastify'
import { preparePublicCheckoutPaymentController } from '../controllers/prepare-public-checkout-payment-controller.js'
import { mercadoPagoWebhookController } from '../controllers/mercado-pago-webhook-controller.js'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { createPaymentTransactionController } from '../controllers/create-payment-transaction-controller.js'
import { listOrderPaymentTransactionsController } from '../controllers/list-order-payment-transactions-controller.js'
import { updatePaymentTransactionStatusController } from '../controllers/update-payment-transaction-status-controller.js'
import { createPublicPixAutomaticPaymentController } from '../controllers/create-public-pix-automatic-payment-controller.js'
import { getCheckoutPaymentSettingsController } from '../controllers/get-checkout-payment-settings-controller.js'

export async function paymentsRoutes(
  app: FastifyInstance
) {
  app.post(
    '/orders/:orderId/payment-transactions',
    {
      preHandler: [verifyJWT]
    },
    createPaymentTransactionController
  )

  app.get(
    '/orders/:orderId/payment-transactions',
    {
      preHandler: [verifyJWT]
    },
    listOrderPaymentTransactionsController
  )

  app.patch(
    '/payment-transactions/:paymentTransactionId/status',
    {
      preHandler: [verifyJWT]
    },
    updatePaymentTransactionStatusController
  )

  app.get(
  '/events/:eventId/checkout-payment-settings',
  getCheckoutPaymentSettingsController
)

app.post(
  '/orders/:orderId/pix-automatic-payment',
  createPublicPixAutomaticPaymentController
)

app.post(
  '/orders/:orderId/checkout-payment',
  preparePublicCheckoutPaymentController
)
app.post(
  '/public/orders/:orderId/checkout-payment',
  preparePublicCheckoutPaymentController
)
app.post(
  '/webhooks/mercado-pago',
  mercadoPagoWebhookController
)
}