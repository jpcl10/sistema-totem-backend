import { AuditAction, CustomerInterestSource, CustomerSource } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { normalizeDocument, normalizeEmail, normalizeInterestKey, normalizePhone } from '../utils/customer-normalization.js';
async function createAuditLog({ organizationId, userId, entity, entityId, action, description, metadata }) {
    const service = new CreateAuditLogService();
    await service.execute({
        organizationId,
        userId,
        entity,
        entityId,
        action,
        description,
        metadata: metadata
    });
}
async function assertNoDuplicateCustomerIdentifiers({ organizationId, normalizedPhone, normalizedEmail, normalizedDocument, ignoreCustomerId }) {
    const or = [];
    if (normalizedPhone) {
        or.push({ normalizedPhone });
    }
    if (normalizedEmail) {
        or.push({ normalizedEmail });
    }
    if (normalizedDocument) {
        or.push({ normalizedDocument });
    }
    if (or.length === 0) {
        return;
    }
    const duplicate = await prisma.customer.findFirst({
        where: {
            organizationId,
            OR: or,
            ...(ignoreCustomerId ? { id: { not: ignoreCustomerId } } : {})
        },
        select: {
            id: true
        }
    });
    if (duplicate) {
        throw new Error('Customer with same identifier already exists');
    }
}
export class ListCustomersService {
    async execute({ organizationId, search, active, phone, email, document, interestId, page, limit, sortBy, sortOrder }) {
        const normalizedPhone = normalizePhone(phone);
        const normalizedEmail = normalizeEmail(email);
        const normalizedDocument = normalizeDocument(document);
        const where = {
            organizationId,
            ...(active !== undefined ? { active } : {}),
            ...(normalizedPhone ? { normalizedPhone: { contains: normalizedPhone } } : {}),
            ...(normalizedEmail ? { normalizedEmail: { contains: normalizedEmail } } : {}),
            ...(normalizedDocument ? { normalizedDocument: { contains: normalizedDocument } } : {}),
            ...(interestId
                ? {
                    customerInterests: {
                        some: {
                            interestId,
                            interest: {
                                organizationId
                            }
                        }
                    }
                }
                : {})
        };
        if (search) {
            const normalizedSearchPhone = normalizePhone(search);
            const normalizedSearchEmail = normalizeEmail(search);
            const normalizedSearchDocument = normalizeDocument(search);
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                ...(normalizedSearchPhone
                    ? [{ normalizedPhone: { contains: normalizedSearchPhone } }]
                    : []),
                ...(normalizedSearchEmail
                    ? [{ normalizedEmail: { contains: normalizedSearchEmail } }]
                    : []),
                ...(normalizedSearchDocument
                    ? [{ normalizedDocument: { contains: normalizedSearchDocument } }]
                    : [])
            ];
        }
        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                orderBy: {
                    [sortBy]: sortOrder
                },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.customer.count({ where })
        ]);
        return {
            data: customers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
export class CreateCustomerService {
    async execute({ organizationId, userId, data }) {
        const normalizedPhone = normalizePhone(data.phone);
        const normalizedEmail = normalizeEmail(data.email);
        const normalizedDocument = normalizeDocument(data.document);
        await assertNoDuplicateCustomerIdentifiers({
            organizationId,
            normalizedPhone,
            normalizedEmail,
            normalizedDocument
        });
        const customer = await prisma.customer.create({
            data: {
                organizationId,
                name: data.name,
                phone: data.phone ?? null,
                normalizedPhone,
                email: data.email ?? null,
                normalizedEmail,
                document: data.document ?? null,
                normalizedDocument,
                birthDate: data.birthDate ?? null,
                notes: data.notes ?? null,
                active: data.active ?? true,
                firstSource: CustomerSource.ADMIN,
                lastSource: CustomerSource.ADMIN,
                firstSeenAt: new Date(),
                lastSeenAt: new Date()
            }
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'Customer',
            entityId: customer.id,
            action: AuditAction.CUSTOMER_CREATED,
            description: 'Cliente criado',
            metadata: {
                customerId: customer.id,
                hasPhone: Boolean(normalizedPhone),
                hasEmail: Boolean(normalizedEmail),
                hasDocument: Boolean(normalizedDocument)
            }
        });
        return { customer };
    }
}
export class GetCustomerService {
    async execute({ organizationId, customerId }) {
        const customer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                organizationId
            },
            include: {
                addresses: {
                    where: {
                        organizationId
                    },
                    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
                },
                customerInterests: {
                    include: {
                        interest: true
                    }
                }
            }
        });
        if (!customer) {
            throw new Error('Customer not found');
        }
        const [onlineOrdersCount, eventOrdersCount, onlineOrdersTotal, eventOrdersTotal, lastOnlineOrder, lastEventOrder] = await Promise.all([
            prisma.onlineOrder.count({
                where: {
                    customerId,
                    store: { organizationId }
                }
            }),
            prisma.order.count({
                where: {
                    customerId,
                    event: { organizationId }
                }
            }),
            prisma.onlineOrder.aggregate({
                where: {
                    customerId,
                    store: { organizationId }
                },
                _sum: { totalInCents: true }
            }),
            prisma.order.aggregate({
                where: {
                    customerId,
                    event: { organizationId }
                },
                _sum: { totalInCents: true }
            }),
            prisma.onlineOrder.findFirst({
                where: {
                    customerId,
                    store: { organizationId }
                },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true }
            }),
            prisma.order.findFirst({
                where: {
                    customerId,
                    event: { organizationId }
                },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true }
            })
        ]);
        const lastDates = [
            lastOnlineOrder?.createdAt,
            lastEventOrder?.createdAt
        ].filter((date) => Boolean(date));
        const totalSpentOnline = onlineOrdersTotal._sum.totalInCents ?? 0;
        const totalSpentEvents = eventOrdersTotal._sum.totalInCents ?? 0;
        const totalOrders = onlineOrdersCount + eventOrdersCount;
        const totalSpent = totalSpentOnline + totalSpentEvents;
        const lastOrderAt = lastDates.length > 0
            ? new Date(Math.max(...lastDates.map(date => date.getTime())))
            : null;
        const lastOrderSource = lastOnlineOrder?.createdAt &&
            (!lastEventOrder?.createdAt ||
                lastOnlineOrder.createdAt >= lastEventOrder.createdAt)
            ? CustomerSource.ONLINE
            : lastEventOrder?.createdAt
                ? CustomerSource.EVENT
                : null;
        return {
            customer,
            summary: {
                totalOrders,
                totalOnlineOrders: onlineOrdersCount,
                totalEventOrders: eventOrdersCount,
                totalSpent,
                totalSpentOnline,
                totalSpentEvents,
                averageTicket: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
                lastOrderAt,
                lastOrderSource,
                activeTabs: 0,
                activeCredentials: 0,
                // Backward-compatible aliases kept for the current frontend.
                onlineOrdersCount,
                eventOrdersCount,
                totalOrdersCount: totalOrders,
                totalSpentInCents: totalSpent
            }
        };
    }
}
export class UpdateCustomerService {
    async execute({ organizationId, userId, customerId, data }) {
        const current = await prisma.customer.findFirst({
            where: { id: customerId, organizationId }
        });
        if (!current) {
            throw new Error('Customer not found');
        }
        const normalizedPhone = data.phone !== undefined ? normalizePhone(data.phone) : current.normalizedPhone;
        const normalizedEmail = data.email !== undefined ? normalizeEmail(data.email) : current.normalizedEmail;
        const normalizedDocument = data.document !== undefined ? normalizeDocument(data.document) : current.normalizedDocument;
        await assertNoDuplicateCustomerIdentifiers({
            organizationId,
            normalizedPhone,
            normalizedEmail,
            normalizedDocument,
            ignoreCustomerId: customerId
        });
        const customer = await prisma.customer.update({
            where: { id: customerId },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.phone !== undefined
                    ? { phone: data.phone, normalizedPhone }
                    : {}),
                ...(data.email !== undefined
                    ? { email: data.email, normalizedEmail }
                    : {}),
                ...(data.document !== undefined
                    ? { document: data.document, normalizedDocument }
                    : {}),
                ...(data.birthDate !== undefined ? { birthDate: data.birthDate } : {}),
                ...(data.notes !== undefined ? { notes: data.notes } : {}),
                ...(data.active !== undefined ? { active: data.active } : {})
            }
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'Customer',
            entityId: customer.id,
            action: AuditAction.CUSTOMER_UPDATED,
            description: 'Cliente atualizado',
            metadata: {
                customerId: customer.id,
                changedFields: Object.keys(data)
            }
        });
        return { customer };
    }
}
export class UpdateCustomerStatusService {
    async execute({ organizationId, userId, customerId, active }) {
        const result = await prisma.customer.updateMany({
            where: {
                id: customerId,
                organizationId
            },
            data: {
                active
            }
        });
        if (result.count === 0) {
            throw new Error('Customer not found');
        }
        await createAuditLog({
            organizationId,
            userId,
            entity: 'Customer',
            entityId: customerId,
            action: AuditAction.CUSTOMER_STATUS_UPDATED,
            description: active ? 'Cliente ativado' : 'Cliente desativado',
            metadata: { customerId, active }
        });
        return { customerId, active };
    }
}
export class ListCustomerAddressesService {
    async execute({ organizationId, customerId }) {
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, organizationId },
            select: { id: true }
        });
        if (!customer) {
            throw new Error('Customer not found');
        }
        const addresses = await prisma.customerAddress.findMany({
            where: {
                organizationId,
                customerId
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
        });
        return { addresses };
    }
}
export class CreateCustomerAddressService {
    async execute({ organizationId, userId, customerId, data }) {
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, organizationId },
            select: { id: true }
        });
        if (!customer) {
            throw new Error('Customer not found');
        }
        const address = await prisma.$transaction(async (tx) => {
            if (data.isDefault) {
                await tx.customerAddress.updateMany({
                    where: { organizationId, customerId, active: true },
                    data: { isDefault: false }
                });
            }
            return tx.customerAddress.create({
                data: {
                    organizationId,
                    customerId,
                    label: data.label ?? null,
                    recipientName: data.recipientName ?? null,
                    street: data.street,
                    number: data.number ?? null,
                    complement: data.complement ?? null,
                    neighborhood: data.neighborhood ?? null,
                    city: data.city ?? null,
                    state: data.state ?? null,
                    postalCode: data.postalCode ?? null,
                    reference: data.reference ?? null,
                    active: data.active ?? true,
                    isDefault: data.isDefault ?? false
                }
            });
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'CustomerAddress',
            entityId: address.id,
            action: AuditAction.CUSTOMER_ADDRESS_CREATED,
            description: 'Endereço de cliente criado',
            metadata: { customerId, addressId: address.id }
        });
        return { address };
    }
}
export class UpdateCustomerAddressService {
    async execute({ organizationId, userId, customerId, addressId, data }) {
        const current = await prisma.customerAddress.findFirst({
            where: { id: addressId, customerId, organizationId }
        });
        if (!current) {
            throw new Error('Customer address not found');
        }
        const address = await prisma.$transaction(async (tx) => {
            if (data.isDefault) {
                await tx.customerAddress.updateMany({
                    where: {
                        organizationId,
                        customerId,
                        active: true,
                        id: { not: addressId }
                    },
                    data: { isDefault: false }
                });
            }
            return tx.customerAddress.update({
                where: { id: addressId },
                data: {
                    ...(data.label !== undefined ? { label: data.label } : {}),
                    ...(data.recipientName !== undefined ? { recipientName: data.recipientName } : {}),
                    ...(data.street !== undefined ? { street: data.street } : {}),
                    ...(data.number !== undefined ? { number: data.number } : {}),
                    ...(data.complement !== undefined ? { complement: data.complement } : {}),
                    ...(data.neighborhood !== undefined ? { neighborhood: data.neighborhood } : {}),
                    ...(data.city !== undefined ? { city: data.city } : {}),
                    ...(data.state !== undefined ? { state: data.state } : {}),
                    ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
                    ...(data.reference !== undefined ? { reference: data.reference } : {}),
                    ...(data.active !== undefined ? { active: data.active } : {}),
                    ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {})
                }
            });
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'CustomerAddress',
            entityId: address.id,
            action: AuditAction.CUSTOMER_ADDRESS_UPDATED,
            description: 'Endereço de cliente atualizado',
            metadata: { customerId, addressId: address.id, changedFields: Object.keys(data) }
        });
        return { address };
    }
}
export class UpdateCustomerAddressStatusService {
    async execute({ organizationId, userId, customerId, addressId, active }) {
        const result = await prisma.customerAddress.updateMany({
            where: { id: addressId, customerId, organizationId },
            data: {
                active,
                ...(active ? {} : { isDefault: false })
            }
        });
        if (result.count === 0) {
            throw new Error('Customer address not found');
        }
        await createAuditLog({
            organizationId,
            userId,
            entity: 'CustomerAddress',
            entityId: addressId,
            action: AuditAction.CUSTOMER_ADDRESS_STATUS_UPDATED,
            description: active ? 'Endereço de cliente ativado' : 'Endereço de cliente desativado',
            metadata: { customerId, addressId, active }
        });
        return { addressId, active };
    }
}
export class ListInterestsService {
    async execute({ organizationId, active, search, page, limit }) {
        const where = {
            organizationId,
            ...(active !== undefined ? { active } : {}),
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { key: { contains: normalizeInterestKey(search) } }
                    ]
                }
                : {})
        };
        const [interests, total] = await Promise.all([
            prisma.interest.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.interest.count({ where })
        ]);
        return {
            data: interests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
export class CreateInterestService {
    async execute({ organizationId, userId, name, key, active }) {
        const normalizedKey = normalizeInterestKey(key ?? name);
        const interest = await prisma.interest.create({
            data: {
                organizationId,
                name,
                key: normalizedKey,
                active: active ?? true
            }
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'Interest',
            entityId: interest.id,
            action: AuditAction.INTEREST_CREATED,
            description: 'Interesse criado',
            metadata: { interestId: interest.id, key: interest.key }
        });
        return { interest };
    }
}
export class UpdateInterestService {
    async execute({ organizationId, userId, interestId, name, key, active }) {
        const current = await prisma.interest.findFirst({
            where: { id: interestId, organizationId }
        });
        if (!current) {
            throw new Error('Interest not found');
        }
        const interest = await prisma.interest.update({
            where: { id: interestId },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(key !== undefined ? { key: normalizeInterestKey(key) } : {}),
                ...(active !== undefined ? { active } : {})
            }
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'Interest',
            entityId: interest.id,
            action: AuditAction.INTEREST_UPDATED,
            description: 'Interesse atualizado',
            metadata: { interestId: interest.id }
        });
        return { interest };
    }
}
export class UpdateInterestStatusService {
    async execute({ organizationId, userId, interestId, active }) {
        const result = await prisma.interest.updateMany({
            where: { id: interestId, organizationId },
            data: { active }
        });
        if (result.count === 0) {
            throw new Error('Interest not found');
        }
        await createAuditLog({
            organizationId,
            userId,
            entity: 'Interest',
            entityId: interestId,
            action: AuditAction.INTEREST_STATUS_UPDATED,
            description: active ? 'Interesse ativado' : 'Interesse desativado',
            metadata: { interestId, active }
        });
        return { interestId, active };
    }
}
export class AddCustomerInterestService {
    async execute({ organizationId, userId, customerId, interestId, source }) {
        const [customer, interest] = await Promise.all([
            prisma.customer.findFirst({ where: { id: customerId, organizationId }, select: { id: true } }),
            prisma.interest.findFirst({ where: { id: interestId, organizationId }, select: { id: true } })
        ]);
        if (!customer || !interest) {
            throw new Error('Customer or interest not found');
        }
        const customerInterest = await prisma.customerInterest.upsert({
            where: {
                customerId_interestId: {
                    customerId,
                    interestId
                }
            },
            create: {
                customerId,
                interestId,
                source: source ?? CustomerInterestSource.MANUAL
            },
            update: {}
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'CustomerInterest',
            entityId: customerInterest.id,
            action: AuditAction.CUSTOMER_INTEREST_ADDED,
            description: 'Interesse associado ao cliente',
            metadata: { customerId, interestId }
        });
        return { customerInterest };
    }
}
export class RemoveCustomerInterestService {
    async execute({ organizationId, userId, customerId, interestId }) {
        const customerInterest = await prisma.customerInterest.findFirst({
            where: {
                customerId,
                interestId,
                customer: { organizationId },
                interest: { organizationId }
            }
        });
        if (!customerInterest) {
            throw new Error('Customer interest not found');
        }
        await prisma.customerInterest.delete({
            where: { id: customerInterest.id }
        });
        await createAuditLog({
            organizationId,
            userId,
            entity: 'CustomerInterest',
            entityId: customerInterest.id,
            action: AuditAction.CUSTOMER_INTEREST_REMOVED,
            description: 'Interesse removido do cliente',
            metadata: { customerId, interestId }
        });
        return { removed: true };
    }
}
