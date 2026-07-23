import { FastifyInstance } from 'fastify'
import { deleteEventController } from '../controllers/delete-event-controller.js'
import { archiveEventController } from '../controllers/archive-event-controller.js'
import { restoreEventController } from '../controllers/restore-event-controller.js'
import { reopenEventController } from '../controllers/reopen-event-controller.js'
import { getEventClosingController } from '../controllers/get-event-closing-controller.js'
import { getPublicEventCatalogMenuController } from '../controllers/get-public-event-catalog-menu-controller.js'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../../auth/middlewares/request-context.js'
import { getEventClosingPreviewController } from '../controllers/get-event-closing-preview-controller.js'
import { createEventController } from '../controllers/create-event-controller.js'
import { listEventsController } from '../controllers/list-events-controller.js'
import { getEventController } from '../controllers/get-event-controller.js'
import { updateEventController } from '../controllers/update-event-controller.js'
import { getPublicEventMenuController } from '../controllers/get-public-event-menu-controller.js'
import { closeEventController } from '../controllers/close-event-controller.js'
import { getTotemReadinessController } from '../controllers/get-totem-readiness-controller.js'
export async function eventsRoutes(app: FastifyInstance) 
 
 

{
  app.post(
    '/events',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    createEventController
  )

  app.get(
    '/events',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    listEventsController
  )

  app.get(
    '/events/:id',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    getEventController
  )

  app.patch(
    '/events/:id',
    {
      preHandler: [verifyJWT, requireTenantContext],
      config: {
        rateLimit: {
          max: 300,
          timeWindow: '1 minute'
        }
      }
    },
    updateEventController
  )

  app.get(
  '/public/organizations/:organizationSlug/events/:eventSlug/menu',
  {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  },
  getPublicEventMenuController
  )
  app.get(
  '/public/organizations/:organizationSlug/events/:eventSlug/catalog-menu',
  {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  },
  getPublicEventCatalogMenuController
  )

  app.get(
  '/public/events/:slug/menu',
  {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  },
  getPublicEventMenuController
  )
  app.get(
  '/public/events/:slug/catalog-menu',
  {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  },
  getPublicEventCatalogMenuController
  )

  app.get(
  '/events/:eventId/totem-readiness',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  getTotemReadinessController
  )

  app.get(
  '/events/:eventId/closing-preview',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  getEventClosingPreviewController
  )

  app.post(
  '/events/:eventId/close',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  closeEventController
  )
  app.get(
  '/events/:eventId/closing',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  getEventClosingController
  )
  app.post(
  '/events/:eventId/reopen',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  reopenEventController
  )
  app.patch(
  '/events/:eventId/archive',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  archiveEventController
  )

  app.patch(
  '/events/:eventId/restore',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  restoreEventController
  )
  app.delete(
  '/events/:eventId',
  {
    preHandler: [verifyJWT, requireTenantContext],
    config: {
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    }
  },
  deleteEventController
  )
  }
