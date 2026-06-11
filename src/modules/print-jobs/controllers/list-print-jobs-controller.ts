import { FastifyReply, FastifyRequest } from 'fastify'

import { ListPrintJobsService } from '../services/list-print-jobs-service.js'

export async function listPrintJobsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.params as {
    eventId: string
  }

  const organizationId =
    request.user.organizationId

  const listPrintJobsService =
    new ListPrintJobsService()

  const { printJobs } =
    await listPrintJobsService.execute({
      organizationId,
      eventId
    })

  return reply.send({
    printJobs
  })
}