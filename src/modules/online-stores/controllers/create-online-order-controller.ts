import {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod
} from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'

import { createOnlineOrderParamsSchema, createOnlineOrderSchema } from '../schemas/create-online-order-schema.js'
import { CreateOnlineOrderService } from '../services/create-online-order-service.js'
import { isOnlineOrderItemValidationError } from '../services/online-order-items-builder.js'

export async function createOnlineOrderController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { slug } = createOnlineOrderParamsSchema.parse(request.params)
  const body = createOnlineOrderSchema.parse(request.body)
  const service = new CreateOnlineOrderService()

  try {
    const result = await service.execute({
      slug,
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      customerDocument: body.customerDocument,
      customerNotes: body.customerNotes,
      fulfillment: body.fulfillment as OnlineOrderFulfillmentType,
      customerAddressId: body.customerAddressId,
      deliveryLabel: body.deliveryLabel,
      deliveryAddress: body.deliveryAddress,
      deliveryNumber: body.deliveryNumber,
      deliveryNeighborhood: body.deliveryNeighborhood,
      deliveryCity: body.deliveryCity,
      deliveryState: body.deliveryState,
      deliveryPostalCode: body.deliveryPostalCode,
      deliveryComplement: body.deliveryComplement,
      deliveryReference: body.deliveryReference,
      paymentMethod: body.paymentMethod as OnlineOrderPaymentMethod,
      changeForInCents: body.changeForInCents,
      deliveryFeeInCents: body.deliveryFeeInCents,
      notes: body.notes,
      items: body.items
    })

    return reply.status(201).send(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Store not found') {
        return reply.status(404).send({ message: 'Loja n\u00e3o encontrada' })
      }

      if (
        error.message === 'Store is currently closed' ||
        error.message === 'Store is currently unavailable' ||
        error.message === 'MANUALLY_CLOSED' ||
        error.message === 'OUTSIDE_BUSINESS_HOURS' ||
        error.message === 'ONLINE_ORDERING_DISABLED' ||
        error.message === 'MINIMUM_ORDER_NOT_REACHED' ||
        error.message === 'Delivery neighborhood is not served' ||
        error.message === 'Delivery is disabled' ||
        error.message === 'Pickup is disabled' ||
        error.message.endsWith('_DISABLED')
      ) {
        return reply.status(400).send({ message: error.message })
      }

      if (isOnlineOrderItemValidationError(error.message)) {
        return reply.status(400).send({ message: error.message })
      }
    }

    throw error
  }
}
