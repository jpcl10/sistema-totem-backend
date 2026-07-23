import { prisma } from '../../../lib/prisma.js';
export class ListEventAuditLogsService {
    async execute({ organizationId, eventId, page = 1, limit = 50, action, entity, userId, deviceId, startDate, endDate }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            },
            select: { id: true }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        // Build where clause
        const whereClause = {
            organizationId,
            eventId
        };
        if (action) {
            whereClause.action = action;
        }
        if (entity) {
            whereClause.entity = entity;
        }
        if (userId) {
            whereClause.userId = userId;
        }
        if (deviceId) {
            whereClause.deviceId = deviceId;
        }
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) {
                whereClause.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.createdAt.lte = new Date(endDate);
            }
        }
        // Calculate skip
        const skip = (page - 1) * limit;
        // Fetch audit logs with pagination
        const [auditLogs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    device: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            type: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit,
                skip
            }),
            prisma.auditLog.count({
                where: whereClause
            })
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            auditLogs,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        };
    }
}
