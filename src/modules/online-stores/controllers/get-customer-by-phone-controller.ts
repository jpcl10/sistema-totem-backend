import { FastifyRequest, FastifyReply } from 'fastify'
import { GetCustomerByPhoneService } from '../services/get-customer-by-phone-service.js'

export async function getCustomerByPhoneController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { slug } = request.params as { slug: string }
    const { phone } = request.query as { phone: string }

    const getCustomerByPhoneService = new GetCustomerByPhoneService()
    const result = await getCustomerByPhoneService.execute({
      slug,
      phone
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Store not found') {
      return reply.status(404).send({ message: 'Loja não encontrada' })
    }
    throw error
  }
}
