import { prisma } from '../../../lib/prisma.js'
import { normalizePhone } from '../../customers/utils/customer-normalization.js'

interface GetCustomerByPhoneServiceRequest {
  slug: string
  phone: string
}

export class GetCustomerByPhoneService {
  async execute(request: GetCustomerByPhoneServiceRequest) {
    const store = await prisma.onlineStore.findUnique({
      where: {
        slug: request.slug,
        active: true
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    const normalizedPhone = normalizePhone(request.phone)

    const customer = normalizedPhone ? await prisma.customer.findFirst({
      where: {
        organizationId: store.organizationId,
        normalizedPhone,
        active: true
      },
      include: {
        addresses: {
          where: {
            organizationId: store.organizationId,
            active: true
          }
        }
      }
    }) : null

    return {
      customer
    }
  }
}
