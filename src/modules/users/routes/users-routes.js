import { createUserController } from '../controllers/create-user-controller.js';
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js';
import { profileController } from '../controllers/profile-controller.js';
export async function usersRoutes(app) {
    app.post('/users', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '1 minute'
            }
        }
    }, createUserController);
    app.get('/users/profile', {
        preHandler: [verifyJWT],
        config: {
            rateLimit: {
                max: 300,
                timeWindow: '1 minute'
            }
        }
    }, profileController);
}
