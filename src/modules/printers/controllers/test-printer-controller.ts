import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { TestPrinterService }
  from '../services/test-printer-service.js'

export async function testPrinterController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printerId } =
    request.params as {
      printerId: string
    }

  const organizationId =
    request.user.organizationId

  const service =
    new TestPrinterService()

  await service.execute({
    organizationId,
    printerId
  })

  return reply.send({
    success: true
  })
}