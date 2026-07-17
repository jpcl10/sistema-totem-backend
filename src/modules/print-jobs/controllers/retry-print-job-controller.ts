import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { RetryPrintJobService }
  from '../services/retry-print-job-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function retryPrintJobController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printJobId } =
    request.params as {
      printJobId: string
    }
  const organizationId = getTenantOrganizationId(request)

  const service =
    new RetryPrintJobService()

  const { printJob } =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      printJobId
    })

  return reply.send({
    printJob
  })
}
