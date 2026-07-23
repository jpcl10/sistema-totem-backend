import jwt from 'jsonwebtoken';
import { DeviceAuthStatus, DeviceStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
export async function verifyDeviceJWT(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return reply.status(401).send({
            message: 'Missing device token'
        });
    }
    const [, token] = authHeader.split(' ');
    if (!token) {
        return reply.status(401).send({
            message: 'Invalid device token'
        });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return reply.status(500).send({
            message: 'JWT_SECRET is not set'
        });
    }
    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded.type !== 'device') {
            return reply.status(401).send({
                message: 'Invalid token type'
            });
        }
        const device = await prisma.device.findUnique({
            where: {
                id: decoded.deviceId
            }
        });
        if (!device) {
            return reply.status(401).send({
                message: 'Device not found'
            });
        }
        if (device.authStatus !== DeviceAuthStatus.ACTIVE) {
            return reply.status(403).send({
                message: 'Device not active'
            });
        }
        if (device.status === DeviceStatus.MAINTENANCE ||
            device.status === DeviceStatus.PAUSED) {
            return reply.status(403).send({
                message: 'Device not allowed'
            });
        }
        request.device = {
            sub: device.id,
            deviceId: device.id,
            organizationId: device.organizationId,
            eventId: device.eventId,
            deviceType: device.type
        };
        return;
    }
    catch {
        return reply.status(401).send({
            message: 'Invalid or expired device token'
        });
    }
}
