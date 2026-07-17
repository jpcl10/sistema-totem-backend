import {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  PaymentStatus
} from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import {
  createManualOnlineOrderParamsSchema,
  createManualOnlineOrderSchema
} from '../schemas/create-manual-online-order-schema.js'
import { CreateManualOnlineOrderService } from '../services/create-manual-online-order-service.js'
import { isOnlineOrderItemValidationError } from '../services/online-order-items-builder.js'

export async function createManualOnlineOrderController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { storeId } = createManualOnlineOrderParamsSchema.parse(request.params)
    const body = createManualOnlineOrderSchema.parse(request.body)
    const organizationId = getTenantOrganizationId(request)
    const service = new CreateManualOnlineOrderService()

    const result = await service.execute({
      organizationId,
      storeId,
      customerId: body.customerId,
      customer: body.customer,
      customerAddressId: body.customerAddressId,
      fulfillment: body.fulfillment as OnlineOrderFulfillmentType,
      delivery: body.delivery,
      paymentMethod: body.paymentMethod as OnlineOrderPaymentMethod,
      paymentStatus: body.paymentStatus as PaymentStatus,
      amountReceivedInCents: body.amountReceivedInCents,
      notes: body.notes,
      items: body.items
    })

    return reply.status(201).send(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Invalid request',
        issues: error.issues
      })
    }

    if (error instanceof Error) {
      if (error.message === 'Store not found') {
        return reply.status(404).send({ message: 'Loja n\u00e3o encontrada' })
      }

      if (error.message === 'Customer not found') {
        return reply.status(404).send({ message: 'Cliente n\u00e3o encontrado' })
      }

      if (
        error.message === 'Store is currently unavailable' ||
        error.message === 'MANUALLY_CLOSED' ||
        error.message === 'OUTSIDE_BUSINESS_HOURS' ||
        error.message === 'ONLINE_ORDERING_DISABLED' ||
        error.message === 'MINIMUM_ORDER_NOT_REACHED' ||
        error.message === 'Delivery neighborhood is not served' ||
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
