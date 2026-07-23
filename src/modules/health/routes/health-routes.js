import { healthController } from '../controllers/health-controller.js';
export async function healthRoutes(app) {
    app.get('/health', {}, healthController);
}
