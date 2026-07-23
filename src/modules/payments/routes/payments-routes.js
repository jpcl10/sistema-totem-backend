import { preparePublicCheckoutPaymentController } from '../controllers/prepare-public-checkout-payment-controller.js';
import { mercadoPagoWebhookController } from '../controllers/mercado-pago-webhook-controller.js';
import { expirePendingPixPaymentsController } from '../controllers/expire-pending-pix-payments-controller.js';
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js';
import { requireTenantContext } from '../../auth/middlewares/request-context.js';
import { createPaymentTransactionController } from '../controllers/create-payment-transaction-controller.js';
import { listOrderPaymentTransactionsController } from '../controllers/list-order-payment-transactions-controller.js';
import { updatePaymentTransactionStatusController } from '../controllers/update-payment-transaction-status-controller.js';
import { createPublicPixAutomaticPaymentController } from '../controllers/create-public-pix-automatic-payment-controller.js';
import { getCheckoutPaymentSettingsController } from '../controllers/get-checkout-payment-settings-controller.js';
import { confirmCardPaymentIntentController, createCardPaymentIntentController } from '../controllers/card-payment-intent-controller.js';
import { verifyDeviceJWT } from '../../devices/middlewares/verify-device-jwt.js';
export async function paymentsRoutes(app) {
    app.post('/orders/:orderId/payment-transactions', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, createPaymentTransactionController);
    app.get('/orders/:orderId/payment-transactions', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, listOrderPaymentTransactionsController);
    app.patch('/payment-transactions/:paymentTransactionId/status', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, updatePaymentTransactionStatusController);
    app.post('/payment-intents/card', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 120,
                timeWindow: '1 minute'
            }
        }
    }, createCardPaymentIntentController);
    app.post('/devices/payment-intents/:paymentTransactionId/confirm', {
        preHandler: [verifyDeviceJWT],
        config: {
            rateLimit: {
                max: 120,
                timeWindow: '1 minute'
            }
        }
    }, confirmCardPaymentIntentController);
    app.get('/events/:eventId/checkout-payment-settings', {
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, getCheckoutPaymentSettingsController);
    app.post('/orders/:orderId/pix-automatic-payment', {
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, createPublicPixAutomaticPaymentController);
    app.post('/orders/:orderId/checkout-payment', {
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, preparePublicCheckoutPaymentController);
    app.post('/public/orders/:orderId/checkout-payment', {
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, preparePublicCheckoutPaymentController);
    app.post('/webhooks/mercado-pago', {
        config: {
            rateLimit: {
                max: 120,
                timeWindow: '1 minute'
            }
        }
    }, mercadoPagoWebhookController);
    app.post('/expire-pending-pix-payments', {
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, expirePendingPixPaymentsController);
}
