import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { TestPrinterService }
  from '../services/test-printer-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function testPrinterController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printerId } =
    request.params as {
      printerId: string
    }
  const organizationId = getTenantOrganizationId(request)

  const service =
    new TestPrinterService()

  await service.execute({
    organizationId,
    userRole: request.user.role,
    printerId
  })

  return reply.send({
    success: true
  })
}
