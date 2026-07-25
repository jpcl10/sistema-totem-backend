import { FastifyReply, FastifyRequest } from 'fastify'
import {
  createManualSaleBodySchema,
  createManualSaleParamsSchema
} from '../schemas/create-manual-sale-schema.js'
import { CreateManualSaleService } from '../services/create-manual-sale-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { isConfigurableOrderItemValidationError } from '../services/configurable-order-item-builder.js'

export async function createManualSaleController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = createManualSaleParamsSchema.parse(request.params)
  const body = createManualSaleBodySchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  const createManualSaleService = new CreateManualSaleService()

  try {
    const result = await createManualSaleService.execute({
      organizationId,
      userRole: request.user.role,
      userId: request.user.sub,
      eventId,
      customerName: body.customerName,
      customerId: body.customerId,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
      items: body.items
    })

    return reply.status(201).send(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Event not found') {
        return reply.status(404).send({
          code: 'EVENT_NOT_FOUND',
          message: 'Evento n\u00e3o encontrado.'
        })
      }

      if (error.message === 'Customer not found') {
        return reply.status(404).send({
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente n\u00e3o encontrado.'
        })
      }

      if (isConfigurableOrderItemValidationError(error.message)) {
        return reply.status(400).send({
          code: 'INVALID_PRODUCT_OPTIONS',
          message: error.message
        })
      }
    }

    throw error
  }
}
