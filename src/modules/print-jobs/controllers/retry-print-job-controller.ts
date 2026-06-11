import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { RetryPrintJobService }
  from '../services/retry-print-job-service.js'

export async function retryPrintJobController(
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
    new RetryPrintJobService()

  const { printJob } =
    await service.execute({
      organizationId,
      printJobId
    })

  return reply.send({
    printJob
  })
}