import { FastifyReply, FastifyRequest } from 'fastify'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { AuditAction } from '@prisma/client'

import { r2 } from '../../../lib/r2.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp'
]

export async function uploadImageController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const publicBaseUrl =
    process.env.R2_PUBLIC_URL?.replace(/\/+$/, '')

  if (!publicBaseUrl) {
    return reply.status(500).send({
      message: 'R2_PUBLIC_URL não configurada'
    })
  }

  const organizationId = request.user.organizationId

  const file = await request.file()

  if (!file) {
    return reply.status(400).send({
      message: 'Imagem não enviada'
    })
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return reply.status(400).send({
      message: 'Formato inválido. Use JPG, PNG ou WEBP.'
    })
  }

  const buffer = await file.toBuffer()

  const maxSizeInBytes = 5 * 1024 * 1024

  if (buffer.length > maxSizeInBytes) {
    return reply.status(400).send({
      message: 'Imagem muito grande. Máximo 5MB.'
    })
  }

  const extension =
    path.extname(file.filename) || '.jpg'

  const key =
    `organizations/${organizationId}/images/${randomUUID()}${extension}`

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.mimetype
    })
  )

  const imageUrl =
    `${publicBaseUrl}/${key}`

  const createAuditLogService =
    new CreateAuditLogService()

  await createAuditLogService.execute({
    organizationId,
    userId: null,
    entity: 'Image',
    entityId: key,
    action: AuditAction.IMAGE_UPLOADED,
    description: 'Imagem enviada para o Cloudflare R2',
    metadata: {
      key,
      imageUrl,
      originalFilename: file.filename,
      mimetype: file.mimetype,
      sizeInBytes: buffer.length
    }
  })

  return reply.status(201).send({
    imageUrl,
    key
  })
}