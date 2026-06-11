import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import path from 'node:path'
import fs from 'node:fs'

import { UploadCatalogProductImageService } from '../services/upload-catalog-product-image-service.js'

export async function uploadCatalogProductImageController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    id: string
  }

  const organizationId =
    request.user.organizationId

  const file = await request.file()

  if (!file) {
    throw new Error('File not found')
  }

  const fileName =
    `${Date.now()}-${file.filename}`

  const uploadPath = path.resolve(
    'uploads/products',
    fileName
  )

  await fs.promises.mkdir(
    path.dirname(uploadPath),
    { recursive: true }
  )

  const buffer = await file.toBuffer()

  await fs.promises.writeFile(
    uploadPath,
    buffer
  )

  const imageUrl =
    `/uploads/products/${fileName}`

  const service =
    new UploadCatalogProductImageService()

  const { product } =
    await service.execute({
      organizationId,

      productId: params.id,

      imageUrl
    })

  return reply.send({
    product
  })
}