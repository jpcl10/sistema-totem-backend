import { CustomerSource, Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export async function touchCustomerInteraction(
  tx: TransactionClient,
  {
    customerId,
    organizationId,
    source,
    seenAt = new Date()
  }: {
    customerId: string
    organizationId: string
    source: CustomerSource
    seenAt?: Date
  }
) {
  await tx.customer.updateMany({
    where: {
      id: customerId,
      organizationId
    },
    data: {
      lastSource: source,
      lastSeenAt: seenAt
    }
  })
}
