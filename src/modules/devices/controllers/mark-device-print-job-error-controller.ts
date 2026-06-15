import { FastifyReply, FastifyRequest } from 'fastify'

import { MarkDevicePrintJobErrorService } from '../services/mark-device-print-job-error-service.js'

export async function markDevicePrintJobErrorController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const deviceId = request.device.deviceId

  const { id } = request.params as {
    id: string
  }

  const service =
    new MarkDevicePrintJobErrorService()

  const { printJob } =
    await service.execute({
      printJobId: id,
      deviceId
    })

  return reply.send({
    printJob
  })
}