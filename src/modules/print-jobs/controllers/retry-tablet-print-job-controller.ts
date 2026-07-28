import { FastifyReply, FastifyRequest } from 'fastify'

import { prisma } from '../../../lib/prisma.js'
import { RetryPrintJobService } from '../services/retry-print-job-service.js'

export async function retryTabletPrintJobController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId, printJobId } = request.params as {
    orderId: string
    printJobId: string
  }

  const printJob = await prisma.eventPrintJob.findFirst({
    where: {
      id: printJobId,
      orderId,
      order: {
        deviceId: request.device.deviceId,
        event: {
          organizationId: request.device.organizationId
        }
      }
    },
    select: {
      id: true
    }
  })

  if (!printJob) {
    return reply.status(404).send({
      message: 'Print job not found'
    })
  }

  const service = new RetryPrintJobService()
  const result = await service.execute({
    organizationId: request.device.organizationId,
    userRole: 'OPERATOR',
    printJobId
  })

  return reply.send(result)
}
