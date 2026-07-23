import { listEventProductsController } from '../controllers/list-event-products-controller.js';
import { verifyJWT } from '../../../auth/middlewares/verify-jwt.js';
import { requireTenantContext } from '../../../auth/middlewares/request-context.js';
import { deleteEventProductController } from '../controllers/delete-event-product-controller.js';
import { createEventProductController } from '../controllers/create-event-product-controller.js';
import { updateEventProductController } from '../controllers/update-event-product-controller.js';
import { listAvailableEventProductsController } from '../controllers/list-available-event-products-controller.js';
import { bulkCreateEventProductsController } from '../controllers/bulk-create-event-products-controller.js';
import { syncEventCatalogController } from '../controllers/sync-event-catalog-controller.js';
export async function eventProductsRoutes(app) {
    app.post('/events/:eventId/catalog-products', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, createEventProductController);
    app.get('/events/:eventId/catalog-products', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, listEventProductsController);
    app.get('/events/:eventId/catalog-products/available', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, listAvailableEventProductsController);
    app.post('/events/:eventId/catalog-products/bulk', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, bulkCreateEventProductsController);
    app.post('/events/:eventId/catalog/sync', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, syncEventCatalogController);
    app.delete('/events/:eventId/catalog-products/:eventProductId', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, deleteEventProductController);
    app.patch('/events/:eventId/catalog-products/:eventProductId', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, updateEventProductController);
}
