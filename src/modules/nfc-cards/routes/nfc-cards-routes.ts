import { FastifyInstance } from 'fastify'

import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'

import { createNfcCardController } from '../controllers/create-nfc-card-controller.js'
import { listNfcCardsController } from '../controllers/list-nfc-cards-controller.js'
import { getNfcCardByUidController } from '../controllers/get-nfc-card-by-uid-controller.js'
import { updateNfcCardController } from '../controllers/update-nfc-card-controller.js'
import { blockNfcCardController } from '../controllers/block-nfc-card-controller.js'
import { readNfcCardController } from '../controllers/read-nfc-card-controller.js'

export async function nfcCardsRoutes(
  app: FastifyInstance
) {
  app.post(
    '/events/:eventId/nfc-cards',
    {
      preHandler: verifyJWT,
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
      preHandler: verifyJWT,
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
      preHandler: verifyJWT,
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
      preHandler: verifyJWT,
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
      preHandler: verifyJWT,
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
      preHandler: verifyJWT,
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    readNfcCardController
  )
}
