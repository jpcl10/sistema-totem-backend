import { FastifyReply, FastifyRequest } from 'fastify'

import { ExpirePendingPixPaymentsService } from '../services/expire-pending-pix-payments-service.js'

export async function expirePendingPixPaymentsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service =
    new ExpirePendingPixPaymentsService()

  const result =
    await service.execute()

  return reply.status(200).send(result)
}