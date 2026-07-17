import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { ListPendingDevicePrintJobsService }
  from '../services/list-pending-device-print-jobs-service.js'
import { getTenantOrganizationId }
  from '../../auth/middlewares/request-context.js'

export async function listPendingDevicePrintJobsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, storeId } =
    request.query as {
      eventId?: string
      storeId?: string
    }

  const organizationId =
    getTenantOrganizationId(request)

  const service =
    new ListPendingDevicePrintJobsService()

  const { printJobs } =
    await service.execute({
      organizationId,
      eventId,
      storeId
    })

  return reply.send({
    printJobs
  })
}
