import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { createPrinterSchema } from '../schemas/create-printer-schema.js'
import { CreatePrinterService } from '../services/create-printer-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function createPrinterController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.params as {
    eventId: string
  }

  const body =
    createPrinterSchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  const service =
    new CreatePrinterService()

  const { printer } =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      eventId,
      name: body.name,
      sector: body.sector,
      connectionType: body.connectionType,
      ipAddress: body.ipAddress,
      port: body.port,
      paperSize: body.paperSize,
      active: body.active
    })

  return reply.status(201).send({
    printer
  })
}
