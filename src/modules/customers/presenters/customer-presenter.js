export function presentCustomer(customer) {
    return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        document: customer.document,
        birthDate: customer.birthDate,
        notes: customer.notes,
        active: customer.active,
        firstSource: customer.firstSource,
        lastSource: customer.lastSource,
        firstSeenAt: customer.firstSeenAt,
        lastSeenAt: customer.lastSeenAt,
        addresses: customer.addresses ?? [],
        interests: customer.customerInterests?.map(customerInterest => ({
            ...customerInterest.interest,
            source: customerInterest.source
        })) ?? [],
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
    };
}
