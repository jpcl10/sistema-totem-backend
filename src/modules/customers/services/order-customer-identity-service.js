import { normalizeDocument, normalizeEmail, normalizePhone } from '../utils/customer-normalization.js';
function buildAddressLabel(label) {
    return label?.trim() || null;
}
export class ResolveOrderCustomerIdentityService {
    async execute({ tx, organizationId, source, customer, address, shouldResolveAddress, fallbackCustomerName, fallbackCustomerPhone }) {
        const requestedName = customer?.name?.trim() || fallbackCustomerName?.trim() || null;
        const requestedPhone = customer?.phone ?? fallbackCustomerPhone ?? null;
        const normalizedPhone = normalizePhone(requestedPhone);
        const normalizedEmail = normalizeEmail(customer?.email);
        const normalizedDocument = normalizeDocument(customer?.document);
        let resolvedCustomer = null;
        if (customer?.id) {
            resolvedCustomer = await tx.customer.findFirst({
                where: {
                    id: customer.id,
                    organizationId,
                    active: true
                },
                select: {
                    id: true,
                    name: true,
                    phone: true
                }
            });
            if (!resolvedCustomer) {
                throw new Error('Customer not found');
            }
        }
        else if (normalizedPhone) {
            resolvedCustomer = await tx.customer.findFirst({
                where: {
                    organizationId,
                    normalizedPhone,
                    active: true
                },
                select: {
                    id: true,
                    name: true,
                    phone: true
                }
            });
            if (!resolvedCustomer) {
                resolvedCustomer = await tx.customer.create({
                    data: {
                        organizationId,
                        name: requestedName ?? 'Cliente',
                        phone: requestedPhone,
                        normalizedPhone,
                        email: customer?.email ?? null,
                        normalizedEmail,
                        document: customer?.document ?? null,
                        normalizedDocument,
                        notes: customer?.notes ?? null,
                        firstSource: source,
                        lastSource: source,
                        firstSeenAt: new Date(),
                        lastSeenAt: new Date()
                    },
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                });
            }
            else {
                const updateData = {
                    lastSource: source,
                    lastSeenAt: new Date()
                };
                if (customer?.email !== undefined) {
                    updateData.email = customer.email;
                    updateData.normalizedEmail = normalizedEmail;
                }
                if (customer?.document !== undefined) {
                    updateData.document = customer.document;
                    updateData.normalizedDocument = normalizedDocument;
                }
                if (customer?.notes !== undefined) {
                    updateData.notes = customer.notes;
                }
                if (requestedName && requestedName !== resolvedCustomer.name) {
                    updateData.name = requestedName;
                }
                resolvedCustomer = await tx.customer.update({
                    where: {
                        id: resolvedCustomer.id
                    },
                    data: updateData,
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                });
            }
        }
        let resolvedAddress = null;
        if (shouldResolveAddress && resolvedCustomer && address?.id) {
            resolvedAddress = await tx.customerAddress.findFirst({
                where: {
                    id: address.id,
                    organizationId,
                    customerId: resolvedCustomer.id,
                    active: true
                },
                select: {
                    id: true,
                    street: true,
                    number: true,
                    neighborhood: true,
                    complement: true,
                    reference: true
                }
            });
            if (!resolvedAddress) {
                throw new Error('Customer address not found');
            }
        }
        else if (shouldResolveAddress &&
            resolvedCustomer &&
            address?.street) {
            resolvedAddress = await tx.customerAddress.findFirst({
                where: {
                    organizationId,
                    customerId: resolvedCustomer.id,
                    street: address.street,
                    number: address.number ?? null,
                    neighborhood: address.neighborhood ?? null,
                    active: true
                },
                select: {
                    id: true,
                    street: true,
                    number: true,
                    neighborhood: true,
                    complement: true,
                    reference: true
                }
            });
            if (!resolvedAddress) {
                resolvedAddress = await tx.customerAddress.create({
                    data: {
                        organizationId,
                        customerId: resolvedCustomer.id,
                        label: buildAddressLabel(address.label),
                        recipientName: address.recipientName ?? requestedName,
                        street: address.street,
                        number: address.number ?? null,
                        neighborhood: address.neighborhood ?? null,
                        city: address.city ?? null,
                        state: address.state ?? null,
                        postalCode: address.postalCode ?? null,
                        complement: address.complement ?? null,
                        reference: address.reference ?? null,
                        isDefault: false
                    },
                    select: {
                        id: true,
                        street: true,
                        number: true,
                        neighborhood: true,
                        complement: true,
                        reference: true
                    }
                });
            }
        }
        return {
            customer: resolvedCustomer,
            address: resolvedAddress
        };
    }
}
