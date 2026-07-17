import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { MarkPrintJobPrintedService }
  from '../services/mark-print-job-printed-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function markPrintJobPrintedController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printJobId } =
    request.params as {
      printJobId: string
    }
  const organizationId = getTenantOrganizationId(request)

  const service =
    new MarkPrintJobPrintedService()

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
