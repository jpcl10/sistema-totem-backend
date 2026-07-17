import { FastifyReply, FastifyRequest } from 'fastify'
import { getPublicStoreParamsSchema } from '../schemas/get-public-store-schema.js'
import { GetPublicStoreService } from '../services/get-public-store-service.js'

export async function getPublicStoreController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { slug } = getPublicStoreParamsSchema.parse(request.params)
  const service = new GetPublicStoreService()

  try {
    const result = await service.execute({ slug })
    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Store not found') {
      return reply.status(404).send({ message: 'Loja não encontrada' })
    }
    throw error
  }
}
