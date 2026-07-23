export async function touchCustomerInteraction(tx, { customerId, organizationId, source, seenAt = new Date() }) {
    await tx.customer.updateMany({
        where: {
            id: customerId,
            organizationId
        },
        data: {
            lastSource: source,
            lastSeenAt: seenAt
        }
    });
}
