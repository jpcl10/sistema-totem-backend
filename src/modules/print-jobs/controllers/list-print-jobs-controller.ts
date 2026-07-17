import { FastifyReply, FastifyRequest } from 'fastify'
import { ListPrintJobsService } from '../services/list-print-jobs-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function listPrintJobsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.params as {
    eventId: string
  }
  const organizationId = getTenantOrganizationId(request)

  const listPrintJobsService =
    new ListPrintJobsService()

  const { printJobs } =
    await listPrintJobsService.execute({
      organizationId,
      userRole: request.user.role,
      eventId
    })

  return reply.send({
    printJobs
  })
}
