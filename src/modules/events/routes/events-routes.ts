import { FastifyInstance } from 'fastify'
import { deleteEventController } from '../controllers/delete-event-controller.js'
import { archiveEventController } from '../controllers/archive-event-controller.js'
import { restoreEventController } from '../controllers/restore-event-controller.js'
import { reopenEventController } from '../controllers/reopen-event-controller.js'
import { getEventClosingController } from '../controllers/get-event-closing-controller.js'
import { getPublicEventCatalogMenuController } from '../controllers/get-public-event-catalog-menu-controller.js'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { getEventClosingPreviewController } from '../controllers/get-event-closing-preview-controller.js'
import { createEventController } from '../controllers/create-event-controller.js'
import { listEventsController } from '../controllers/list-events-controller.js'
import { getEventController } from '../controllers/get-event-controller.js'
import { updateEventController } from '../controllers/update-event-controller.js'
import { getPublicEventMenuController } from '../controllers/get-public-event-menu-controller.js'
import { uploadEventLogoController } from '../controllers/upload-event-logo-controller.js'
import { closeEventController } from '../controllers/close-event-controller.js'
export async function eventsRoutes(app: FastifyInstance) 



{
  app.post(
    '/events',
    {
      preHandler: [verifyJWT]
    },
    createEventController
  )

  app.get(
    '/events',
    {
      preHandler: [verifyJWT]
    },
    listEventsController
  )

  app.get(
    '/events/:id',
    {
      preHandler: [verifyJWT]
    },
    getEventController
  )

  app.patch(
    '/events/:id',
    {
      preHandler: [verifyJWT]
    },
    updateEventController
  )

  app.get(
  '/public/events/:slug/menu',
  getPublicEventMenuController
  )
  app.post(
  '/events/:id/logo',
  {
    preHandler: [verifyJWT]
  },
  uploadEventLogoController
  )
  app.get(
  '/public/events/:slug/catalog-menu',
  getPublicEventCatalogMenuController
  )

  app.get(
  '/events/:eventId/closing-preview',
  {
    preHandler: [verifyJWT]
  },
  getEventClosingPreviewController
  )

  app.post(
  '/events/:eventId/close',
  {
    preHandler: [verifyJWT]
  },
  closeEventController
  )
  app.get(
  '/events/:eventId/closing',
  {
    preHandler: [verifyJWT]
  },
  getEventClosingController
  )
  app.post(
  '/events/:eventId/reopen',
  {
    preHandler: [verifyJWT]
  },
  reopenEventController
  )
  app.patch(
  '/events/:eventId/archive',
  {
    preHandler: [verifyJWT]
  },
  archiveEventController
  )

  app.patch(
  '/events/:eventId/restore',
  {
    preHandler: [verifyJWT]
  },
  restoreEventController
  )
  app.delete(
  '/events/:eventId',
  {
    preHandler: [verifyJWT]
  },
  deleteEventController
  )
  }
