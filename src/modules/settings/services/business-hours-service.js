import { AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { normalizeAndValidateBusinessHourException, normalizeAndValidateBusinessHours } from './business-hours-validation.js';
import { ensureStoreBelongsToOrganization, normalizeContext, normalizeChannel, toDateOnly } from './settings-shared.js';
export class BusinessHoursService {
    async list({ organizationId, contextType, storeId, channel }) {
        if (storeId) {
            await ensureStoreBelongsToOrganization(organizationId, storeId);
        }
        const [weekly, exceptions] = await Promise.all([
            prisma.businessHour.findMany({
                where: {
                    organizationId,
                    ...(contextType && { contextType }),
                    ...(storeId !== undefined && { storeId }),
                    ...(channel && { channel })
                },
                orderBy: [
                    { contextType: 'asc' },
                    { storeId: 'asc' },
                    { channel: 'asc' },
                    { dayOfWeek: 'asc' },
                    { periodIndex: 'asc' }
                ]
            }),
            prisma.businessHourException.findMany({
                where: {
                    organizationId,
                    ...(storeId !== undefined && { storeId }),
                    ...(channel && { channel })
                },
                orderBy: [
                    { date: 'asc' },
                    { channel: 'asc' }
                ]
            })
        ]);
        return {
            businessHours: {
                weekly,
                exceptions
            }
        };
    }
    async upsert({ organizationId, userId, contextType, storeId, channel, hours }) {
        const normalizedContext = normalizeContext(contextType, storeId);
        if (normalizedContext.storeId) {
            await ensureStoreBelongsToOrganization(organizationId, normalizedContext.storeId);
        }
        const normalizedChannel = normalizeChannel(channel);
        const normalizedHours = normalizeAndValidateBusinessHours(hours);
        const savedHours = await prisma.$transaction(async (tx) => {
            await tx.businessHour.deleteMany({
                where: {
                    organizationId,
                    contextType: normalizedContext.contextType,
                    storeId: normalizedContext.storeId,
                    channel: normalizedChannel
                }
            });
            if (normalizedHours.length > 0) {
                await tx.businessHour.createMany({
                    data: normalizedHours.map(hour => ({
                        organizationId,
                        contextType: normalizedContext.contextType,
                        storeId: normalizedContext.storeId,
                        channel: normalizedChannel,
                        dayOfWeek: hour.dayOfWeek,
                        periodIndex: hour.periodIndex,
                        opensAt: hour.opensAt,
                        closesAt: hour.closesAt,
                        isClosed: hour.isClosed,
                        is24Hours: hour.is24Hours
                    }))
                });
            }
            return tx.businessHour.findMany({
                where: {
                    organizationId,
                    contextType: normalizedContext.contextType,
                    storeId: normalizedContext.storeId,
                    channel: normalizedChannel
                },
                orderBy: [
                    { dayOfWeek: 'asc' },
                    { periodIndex: 'asc' }
                ]
            });
        });
        await new CreateAuditLogService().execute({
            organizationId,
            userId,
            entity: 'BusinessHour',
            action: AuditAction.BUSINESS_HOURS_UPDATED,
            description: 'Horários de funcionamento atualizados',
            metadata: {
                contextType: normalizedContext.contextType,
                storeId: normalizedContext.storeId,
                channel: normalizedChannel,
                count: savedHours.length
            }
        });
        return {
            businessHours: savedHours
        };
    }
    async createException({ organizationId, userId, storeId, channel, date, isClosed, is24Hours, opensAt, closesAt, reason }) {
        await ensureStoreBelongsToOrganization(organizationId, storeId);
        const normalizedTimes = normalizeAndValidateBusinessHourException({
            isClosed,
            is24Hours,
            opensAt,
            closesAt
        });
        const exception = await prisma.businessHourException.create({
            data: {
                organizationId,
                storeId: storeId ?? null,
                channel: normalizeChannel(channel),
                date: toDateOnly(date),
                isClosed,
                is24Hours,
                opensAt: normalizedTimes.opensAt,
                closesAt: normalizedTimes.closesAt,
                reason: reason ?? null
            }
        });
        await new CreateAuditLogService().execute({
            organizationId,
            userId,
            entity: 'BusinessHourException',
            entityId: exception.id,
            action: AuditAction.BUSINESS_HOUR_EXCEPTION_CREATED,
            description: 'Exceção de horário criada',
            metadata: {
                storeId: exception.storeId,
                channel: exception.channel,
                date: exception.date
            }
        });
        return {
            exception
        };
    }
    async updateException(request) {
        const current = await prisma.businessHourException.findFirst({
            where: {
                id: request.exceptionId,
                organizationId: request.organizationId
            }
        });
        if (!current) {
            throw new Error('Business hour exception not found');
        }
        const nextStoreId = request.storeId !== undefined
            ? request.storeId
            : current.storeId;
        await ensureStoreBelongsToOrganization(request.organizationId, nextStoreId);
        const isClosed = request.isClosed ?? current.isClosed;
        const is24Hours = request.is24Hours ?? current.is24Hours;
        const opensAt = request.opensAt !== undefined
            ? request.opensAt
            : current.opensAt;
        const closesAt = request.closesAt !== undefined
            ? request.closesAt
            : current.closesAt;
        const normalizedTimes = normalizeAndValidateBusinessHourException({
            isClosed,
            is24Hours,
            opensAt,
            closesAt
        });
        const exception = await prisma.businessHourException.update({
            where: {
                id: request.exceptionId
            },
            data: {
                ...(request.storeId !== undefined && {
                    storeId: request.storeId
                }),
                ...(request.channel !== undefined && {
                    channel: request.channel
                }),
                ...(request.date !== undefined && {
                    date: toDateOnly(request.date)
                }),
                ...(request.isClosed !== undefined && {
                    isClosed: request.isClosed
                }),
                ...(request.is24Hours !== undefined && {
                    is24Hours: request.is24Hours
                }),
                opensAt: normalizedTimes.opensAt,
                closesAt: normalizedTimes.closesAt,
                ...(request.reason !== undefined && {
                    reason: request.reason
                })
            }
        });
        await new CreateAuditLogService().execute({
            organizationId: request.organizationId,
            userId: request.userId,
            entity: 'BusinessHourException',
            entityId: exception.id,
            action: AuditAction.BUSINESS_HOUR_EXCEPTION_UPDATED,
            description: 'Exceção de horário atualizada',
            metadata: {
                changedFields: Object.keys(request)
                    .filter(key => ![
                    'organizationId',
                    'userId',
                    'exceptionId'
                ].includes(key))
            }
        });
        return {
            exception
        };
    }
    async deleteException({ organizationId, userId, exceptionId }) {
        const exception = await prisma.businessHourException.findFirst({
            where: {
                id: exceptionId,
                organizationId
            }
        });
        if (!exception) {
            throw new Error('Business hour exception not found');
        }
        await prisma.businessHourException.delete({
            where: {
                id: exception.id
            }
        });
        await new CreateAuditLogService().execute({
            organizationId,
            userId,
            entity: 'BusinessHourException',
            entityId: exception.id,
            action: AuditAction.BUSINESS_HOUR_EXCEPTION_DELETED,
            description: 'Exceção de horário removida',
            metadata: {
                storeId: exception.storeId,
                channel: exception.channel,
                date: exception.date
            }
        });
        return {
            deleted: true
        };
    }
}
