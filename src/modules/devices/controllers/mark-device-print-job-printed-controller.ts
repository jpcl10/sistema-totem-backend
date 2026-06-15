import { FastifyReply, FastifyRequest } from 'fastify'

import { MarkDevicePrintJobPrintedService } from '../services/mark-device-print-job-printed-service.js'

export async function markDevicePrintJobPrintedController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const deviceId = request.device.deviceId

  const { id } = request.params as {
    id: string
  }

  const service =
    new MarkDevicePrintJobPrintedService()

  const { printJob } =
    await service.execute({
      printJobId: id,
      deviceId
    })

  return reply.send({
    printJob
  })
}