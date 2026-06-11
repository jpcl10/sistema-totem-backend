import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { ListPendingDevicePrintJobsService }
  from '../services/list-pending-device-print-jobs-service.js'

export async function listPendingDevicePrintJobsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    request.query as {
      eventId?: string
    }

  const organizationId =
    request.user.organizationId

  const service =
    new ListPendingDevicePrintJobsService()

  const { printJobs } =
    await service.execute({
      organizationId,
      eventId
    })

  return reply.send({
    printJobs
  })
}