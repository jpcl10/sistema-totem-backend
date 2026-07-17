import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { ListOrderPaymentTransactionsService } from '../services/list-order-payment-transactions-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const listOrderPaymentTransactionsParamsSchema = z.object({
  orderId: z.string()
})

export async function listOrderPaymentTransactionsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } =
    listOrderPaymentTransactionsParamsSchema.parse(request.params)

  const organizationId =
    getTenantOrganizationId(request)

  const listOrderPaymentTransactionsService =
    new ListOrderPaymentTransactionsService()

  const {
    order,
    paymentTransactions
  } = await listOrderPaymentTransactionsService.execute({
    organizationId,
    orderId
  })

  return reply.status(200).send({
    order,
    paymentTransactions
  })
}
