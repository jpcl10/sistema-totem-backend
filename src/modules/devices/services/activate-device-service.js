import { createHash } from 'node:crypto';
import { DeviceAuthStatus, DeviceStatus, AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { buildPublicEventUrl } from '../../../lib/public-urls.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js';
function hashValue(value) {
    return createHash('sha256')
        .update(value)
        .digest('hex');
}
export class ActivateDeviceService {
    async execute({ code, secret, appVersion, ipAddress, userAgent }) {
        const normalizedCode = code.trim().toUpperCase();
        const device = await prisma.device.findUnique({
            where: {
                code: normalizedCode
            },
            include: {
                event: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                organization: {
                    select: {
                        slug: true
                    }
                }
            }
        });
        if (!device) {
            throw new Error('Device not found');
        }
        if (device.authStatus === DeviceAuthStatus.REVOKED) {
            throw new Error('Device credentials revoked');
        }
        if (device.status === DeviceStatus.MAINTENANCE) {
            throw new Error('Device is under maintenance');
        }
        if (!device.deviceSecretHash) {
            throw new Error('Device credentials not generated');
        }
        const secretHash = hashValue(secret);
        if (secretHash !== device.deviceSecretHash) {
            throw new Error('Invalid device credentials');
        }
        const jwt = await import('jsonwebtoken');
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not set.');
        }
        const deviceToken = jwt.default.sign({
            type: 'device',
            deviceId: device.id,
            organizationId: device.organizationId,
            eventId: device.eventId,
            deviceType: device.type
        }, jwtSecret, {
            subject: device.id,
            expiresIn: '30d'
        });
        const tokenHash = hashValue(deviceToken);
        const now = new Date();
        const updatedDevice = await prisma.device.update({
            where: {
                id: device.id
            },
            data: {
                tokenHash,
                authStatus: DeviceAuthStatus.ACTIVE,
                lastActivatedAt: now,
                lastSeenAt: now,
                appVersion: appVersion ?? device.appVersion,
                lastIpAddress: ipAddress ?? device.lastIpAddress,
                lastUserAgent: userAgent ?? device.lastUserAgent
            },
            include: {
                event: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                organization: {
                    select: {
                        slug: true
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                }
            }
        });
        // Audit: DEVICE_ACTIVATED
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: updatedDevice.organizationId,
            eventId: updatedDevice.eventId,
            deviceId: updatedDevice.id,
            entity: 'Device',
            entityId: updatedDevice.id,
            action: AuditAction.DEVICE_ACTIVATED,
            description: 'Dispositivo ativado',
            metadata: {
                deviceId: updatedDevice.id,
                code: updatedDevice.code,
                appVersion
            }
        });
        const effective = await new SettingsResolverService().execute({
            organizationId: updatedDevice.organizationId,
            eventId: updatedDevice.eventId ?? undefined,
            storeId: updatedDevice.storeId ?? undefined,
            deviceId: updatedDevice.id
        });
        const canonicalPublicUrl = updatedDevice.event
            ? buildPublicEventUrl({
                organizationSlug: updatedDevice.organization.slug,
                eventSlug: updatedDevice.event.slug
            })
            : null;
        return {
            deviceToken,
            device: updatedDevice,
            config: {
                apiBaseUrl: null,
                eventId: updatedDevice.eventId,
                eventSlug: updatedDevice.event?.slug ?? null,
                organizationSlug: updatedDevice.organization.slug,
                canonicalPublicUrl,
                eventName: updatedDevice.event?.name ?? null,
                storeId: updatedDevice.storeId,
                storeSlug: updatedDevice.store?.slug ?? null,
                storeName: updatedDevice.store?.name ?? null,
                deviceCode: updatedDevice.code,
                deviceType: updatedDevice.type,
                autoPrintEnabled: effective.printing.autoPrintEnabled,
                printingEnabled: effective.printing.printingEnabled,
                printerPaperSize: effective.printing.paperSize,
                printing: effective.printing
            }
        };
    }
}
