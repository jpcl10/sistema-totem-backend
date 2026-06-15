import { FastifyReply, FastifyRequest } from 'fastify'

import { ListDevicePendingPrintJobsService } from '../services/list-device-pending-print-jobs-service.js'

export async function listDevicePendingPrintJobsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const deviceId = request.device.deviceId

  const service =
    new ListDevicePendingPrintJobsService()

  const { printJobs } =
    await service.execute({
      deviceId
    })

  return reply.send({
    printJobs
  })
}