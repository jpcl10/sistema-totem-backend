import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../auth/middlewares/request-context.js'

import { createNfcCardController } from '../controllers/create-nfc-card-controller.js'
import { listNfcCardsController } from '../controllers/list-nfc-cards-controller.js'
import { getNfcCardByUidController } from '../controllers/get-nfc-card-by-uid-controller.js'
import { updateNfcCardController } from '../controllers/update-nfc-card-controller.js'
import { blockNfcCardController } from '../controllers/block-nfc-card-controller.js'
import { readNfcCardController } from '../controllers/read-nfc-card-controller.js'
import { listNfcCardReadsController } from '../controllers/list-nfc-card-reads-controller.js'
import { identifyNfcCardController } from '../controllers/identify-nfc-card-controller.js'
import { topupNfcCardController } from '../controllers/topup-nfc-card-controller.js'
import { debitNfcCardController } from '../controllers/debit-nfc-card-controller.js'
import { adjustNfcCardController } from '../controllers/adjust-nfc-card-controller.js'
import { refundNfcCardController } from '../controllers/refund-nfc-card-controller.js'
import { listNfcCardTransactionsController } from '../controllers/list-nfc-card-transactions-controller.js'
import { payOrderWithNfcBalanceController } from '../controllers/pay-order-with-nfc-balance-controller.js'

export async function nfcCardsRoutes(
  app: FastifyInstance
) {
  // Public route for totem NFC identification
  app.post(
    '/public/events/:eventSlug/nfc/identify',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    identifyNfcCardController
  )

  // Public route for paying order with NFC balance
  app.post(
    '/public/events/:eventSlug/orders/:orderId/pay-with-nfc-balance',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute'
        }
      }
    },
    payOrderWithNfcBalanceController
  )

  app.post(
    '/events/:eventId/nfc-cards',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    createNfcCardController
  )

  app.get(
    '/events/:eventId/nfc-cards',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listNfcCardsController
  )

  app.get(
    '/events/:eventId/nfc-cards/uid/:uid',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    getNfcCardByUidController
  )

  app.patch(
    '/events/:eventId/nfc-cards/:id',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    updateNfcCardController
  )

  app.post(
    '/events/:eventId/nfc-cards/:id/block',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    blockNfcCardController
  )

  app.post(
    '/events/:eventId/nfc-cards/read',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    readNfcCardController
  )

  app.get(
    '/events/:eventId/nfc-cards/:id/reads',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listNfcCardReadsController
  )

  // Balance operations
  app.post(
    '/events/:eventId/nfc-cards/:id/topup',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    topupNfcCardController
  )

  app.post(
    '/events/:eventId/nfc-cards/:id/debit',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    debitNfcCardController
  )

  app.post(
    '/events/:eventId/nfc-cards/:id/adjust',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    adjustNfcCardController
  )

  app.post(
    '/events/:eventId/nfc-cards/:id/refund',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    refundNfcCardController
  )

  app.get(
    '/events/:eventId/nfc-cards/:id/transactions',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listNfcCardTransactionsController
  )
}
