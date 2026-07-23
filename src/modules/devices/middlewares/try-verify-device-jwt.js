import { verifyDeviceJWT } from './verify-device-jwt.js';
export async function tryVerifyDeviceJWT(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return;
    }
    await verifyDeviceJWT(request, reply);
}
