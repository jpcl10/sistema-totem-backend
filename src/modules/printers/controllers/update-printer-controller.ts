import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { UpdatePrinterService }
  from '../services/update-printer-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const updatePrinterBodySchema =
  z.object({
    name: z.string().optional(),

    sector: z.enum([
      'FULL_ORDER',
      'BAR',
      'KITCHEN'
    ]).optional(),

    ipAddress: z.string().optional(),

    port: z.number().optional(),

    paperSize: z.enum([
      '58mm',
      '80mm'
    ]).optional(),

    active: z.boolean().optional()
  })

export async function updatePrinterController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { printerId } =
    request.params as {
      printerId: string
    }

  const body =
    updatePrinterBodySchema.parse(
      request.body
    )
  const organizationId = getTenantOrganizationId(request)

  const service =
    new UpdatePrinterService()

  const { printer } =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      printerId,
      ...body
    })

  return reply.send({
    printer
  })
}
