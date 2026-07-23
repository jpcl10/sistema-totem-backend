import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { CreateTestPrintJobService } from '../services/create-test-print-job-service.js'

const bodySchema = z.object({
  deviceId: z.string().min(1),
  printerId: z.string().min(1).nullable().optional(),
  sector: z.enum(['GENERAL', 'BAR', 'KITCHEN']).default('GENERAL')
})

export async function createTestPrintJobController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.params as {
    eventId: string
  }
  const body = bodySchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  const result = await new CreateTestPrintJobService().execute({
    organizationId,
    userId: request.user.sub,
    userRole: request.user.role,
    eventId,
    deviceId: body.deviceId,
    printerId: body.printerId,
    sector: body.sector
  })

  return reply.status(201).send(result)
}
