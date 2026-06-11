import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { MarkDevicePrintJobPrintedService }
  from '../services/mark-device-print-job-printed-service.js'

export async function markDevicePrintJobPrintedController(
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
    new MarkDevicePrintJobPrintedService()

  const { printJob } =
    await service.execute({
      organizationId,
      printJobId
    })

  return reply.send({
    printJob
  })
}