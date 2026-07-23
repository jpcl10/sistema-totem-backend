import { listPrintersController } from '../controllers/list-printers-controller.js';
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js';
import { requireTenantContext } from '../../auth/middlewares/request-context.js';
import { updatePrinterController } from '../controllers/update-printer-controller.js';
import { createPrinterController } from '../controllers/create-printer-controller.js';
import { testPrinterController } from '../controllers/test-printer-controller.js';
export async function printersRoutes(app) {
    app.post('/events/:eventId/printers', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, createPrinterController);
    app.get('/events/:eventId/printers', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, listPrintersController);
    app.patch('/printers/:printerId', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, updatePrinterController);
    app.post('/printers/:printerId/test', {
        preHandler: [verifyJWT, requireTenantContext],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, testPrinterController);
}
