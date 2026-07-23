import { authenticateController } from '../controllers/authenticate-controller.js';
export async function authRoutes(app) {
    app.post('/sessions', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '1 minute'
            }
        }
    }, authenticateController);
}
