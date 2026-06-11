import fs from 'node:fs'
import path from 'node:path'

import { FastifyReply, FastifyRequest } from 'fastify'

import { UploadEventLogoService } from '../services/upload-event-logo-service.js'

export async function uploadEventLogoController(
  request: FastifyRequest,
  reply: FastifyReply
) {

  const { id } = request.params as {
    id: string
  }

  const organizationId = request.user.organizationId

  const file = await request.file()

  if (!file) {
    return reply.status(400).send({
      message: 'Arquivo não enviado'
    })
  }

  const fileName = `${Date.now()}-${file.filename}`

  const uploadPath = path.resolve(
    'uploads/events',
    fileName
  )

  const buffer = await file.toBuffer()

  fs.writeFileSync(uploadPath, buffer)

  const logoUrl = `/uploads/events/${fileName}`

  const uploadEventLogoService =
    new UploadEventLogoService()

  const { event } =
    await uploadEventLogoService.execute({
      organizationId,
      eventId: id,
      logoUrl
    })

  return reply.send({
    event
  })
}