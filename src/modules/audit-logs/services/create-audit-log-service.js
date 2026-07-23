import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
const sensitiveKeyPattern = /(accessToken|refreshToken|token|secret|password|senha|privateKey|authorization|cardNumber|cvv|encryptedCredentials)/i;
function sanitizeAuditMetadataValue(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value
            .map(item => sanitizeAuditMetadataValue(item) ?? null);
    }
    if (typeof value === 'object') {
        const sanitized = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            if (sensitiveKeyPattern.test(key)) {
                sanitized[key] = '[REDACTED]';
                continue;
            }
            const sanitizedValue = sanitizeAuditMetadataValue(nestedValue);
            if (sanitizedValue !== undefined) {
                sanitized[key] = sanitizedValue;
            }
        }
        return sanitized;
    }
    return undefined;
}
export function sanitizeAuditMetadata(value) {
    const sanitized = sanitizeAuditMetadataValue(value);
    return sanitized === null
        ? undefined
        : sanitized;
}
export class CreateAuditLogService {
    async execute({ organizationId, eventId, userId, deviceId, entity, entityId, action, description, metadata }) {
        // Step 1: Verify organization exists (required)
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId }
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        // Step 2: Validate optional fields
        let validatedEventId = null;
        let validatedUserId = null;
        let validatedDeviceId = null;
        if (eventId) {
            const event = await prisma.event.findFirst({
                where: {
                    id: eventId,
                    organizationId
                }
            });
            if (event) {
                validatedEventId = eventId;
            }
            else {
                logger.warn({ eventId, organizationId }, 'Invalid eventId for audit log, setting to null');
            }
        }
        if (userId) {
            const user = await prisma.user.findFirst({
                where: {
                    id: userId,
                    organizationId
                }
            });
            if (user) {
                validatedUserId = userId;
            }
            else {
                logger.warn({ userId, organizationId }, 'Invalid userId for audit log, setting to null');
            }
        }
        if (deviceId) {
            const device = await prisma.device.findFirst({
                where: {
                    id: deviceId,
                    organizationId
                }
            });
            if (device) {
                validatedDeviceId = deviceId;
            }
            else {
                logger.warn({ deviceId, organizationId }, 'Invalid deviceId for audit log, setting to null');
            }
        }
        // Step 3: Create audit log with validated data
        const auditLog = await prisma.auditLog.create({
            data: {
                organizationId,
                eventId: validatedEventId,
                userId: validatedUserId,
                deviceId: validatedDeviceId,
                entity,
                entityId: entityId ?? null,
                action,
                description: description ?? null,
                metadata: sanitizeAuditMetadata(metadata)
            }
        });
        return {
            auditLog
        };
    }
}
