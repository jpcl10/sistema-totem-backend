import { FastifyRequest, FastifyReply } from 'fastify'
import { GetCustomerOrdersService } from '../services/get-customer-orders-service.js'

export async function getCustomerOrdersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { slug, customerId } = request.params as {
      slug: string
      customerId: string
    }

    const getCustomerOrdersService = new GetCustomerOrdersService()
    const result = await getCustomerOrdersService.execute({
      slug,
      customerId
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Store not found') {
      return reply.status(404).send({ message: 'Loja não encontrada' })
    }
    throw error
  }
}
