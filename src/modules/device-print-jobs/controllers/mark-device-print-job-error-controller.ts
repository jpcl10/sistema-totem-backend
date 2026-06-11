import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { z } from 'zod'

import { MarkDevicePrintJobErrorService }
  from '../services/mark-device-print-job-error-service.js'

const markDevicePrintJobErrorBodySchema =
  z.object({
    errorMessage: z.string().optional()
  })

export async function markDevicePrintJobErrorController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printJobId } =
    request.params as {
      printJobId: string
    }

  const body =
    markDevicePrintJobErrorBodySchema.parse(
      request.body ?? {}
    )

  const organizationId =
    request.user.organizationId

  const service =
    new MarkDevicePrintJobErrorService()

  const { printJob } =
    await service.execute({
      organizationId,
      printJobId,
      errorMessage: body.errorMessage
    })

  return reply.send({
    printJob
  })
}