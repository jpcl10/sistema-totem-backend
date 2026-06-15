import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { MarkDevicePrintJobErrorService } from '../services/mark-device-print-job-error-service.js'

export async function markDevicePrintJobErrorController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const deviceId =
    request.device.deviceId

  const { id } = request.params as {
    id: string
  }

  const bodySchema =
    z.object({
      errorMessage: z.string().optional()
    })

  const {
    errorMessage
  } = bodySchema.parse(request.body ?? {})

  const service =
    new MarkDevicePrintJobErrorService()

  const { printJob } =
    await service.execute({
      printJobId: id,
      deviceId,
      errorMessage
    })

  return reply.send({
    printJob
  })
}