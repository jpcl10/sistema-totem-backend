import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { MarkPrintJobPrintedService }
  from '../services/mark-print-job-printed-service.js'

export async function markPrintJobPrintedController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printJobId } =
    request.params as {
      printJobId: string
    }

  const organizationId =
    request.user.organizationId

  const service =
    new MarkPrintJobPrintedService()

  const { printJob } =
    await service.execute({
      organizationId,
      printJobId
    })

  return reply.send({
    printJob
  })
}