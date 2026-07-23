import { randomBytes, createHash } from 'node:crypto';
import { DeviceAuthStatus, AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
function generateDeviceSecret() {
    return `dvs_${randomBytes(32).toString('hex')}`;
}
function hashSecret(secret) {
    return createHash('sha256')
        .update(secret)
        .digest('hex');
}
export class RegenerateDeviceCredentialsService {
    async execute({ organizationId, deviceId }) {
        const device = await prisma.device.findFirst({
            where: {
                id: deviceId,
                organizationId
            }
        });
        if (!device) {
            throw new Error('Device not found');
        }
        const deviceSecret = generateDeviceSecret();
        const deviceSecretHash = hashSecret(deviceSecret);
        const updatedDevice = await prisma.device.update({
            where: {
                id: device.id
            },
            data: {
                deviceSecretHash,
                authStatus: DeviceAuthStatus.PENDING,
                tokenHash: null,
                lastSeenAt: null
            }
        });
        // Audit: DEVICE_REVOKED
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: updatedDevice.organizationId,
            eventId: updatedDevice.eventId,
            entity: 'Device',
            entityId: updatedDevice.id,
            action: AuditAction.DEVICE_REVOKED,
            description: 'Dispositivo revogado, credenciais regeneradas',
            metadata: {
                deviceId: updatedDevice.id,
                code: updatedDevice.code
            }
        });
        return {
            device: updatedDevice,
            deviceSecret
        };
    }
}
