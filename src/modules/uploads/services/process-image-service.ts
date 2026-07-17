import sharp from 'sharp'
import { createHash } from 'node:crypto'

import {
  getUploadOutputContentType,
  UPLOAD_PIPELINE_VERSION,
  UploadAssetProfile,
  UploadAssetType,
  sharpLimitInputPixels
} from '../upload-config.js'
import {
  createFileTooLargeError,
  UploadError
} from './upload-errors.js'

type ProcessImageServiceRequest = {
  buffer: Buffer
  originalContentType: string
  assetType: UploadAssetType
  profile: UploadAssetProfile
}

export type ProcessedImageMetadata = {
  assetType: UploadAssetType
  width: number
  height: number
  sizeInBytes: number
  contentType: string
  format: string
  aspectRatio: number
  processedAt: string
  version: number
  hash: string
  original: {
    width: number | null
    height: number | null
    sizeInBytes: number
    contentType: string
    format: string | null
  }
}

type ProcessImageServiceResponse = {
  buffer: Buffer
  contentType: string
  metadata: ProcessedImageMetadata
}

const supportedSharpFormats = new Set([
  'jpeg',
  'png',
  'webp'
])

const contentTypeBySharpFormat: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

function getShortHash(buffer: Buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 12)
}

export class ProcessImageService {
  async execute({
    buffer,
    originalContentType,
    assetType,
    profile
  }: ProcessImageServiceRequest): Promise<ProcessImageServiceResponse> {
    if (buffer.length > profile.maxFileSizeInBytes) {
      throw createFileTooLargeError(profile)
    }

    if (!profile.allowedMimeTypes.includes(originalContentType)) {
      throw new UploadError(
        'INVALID_IMAGE_TYPE',
        'Formato invalido. Use JPG, PNG ou WEBP.',
        400
      )
    }

    let originalMetadata

    try {
      originalMetadata =
        await sharp(buffer, {
          limitInputPixels: sharpLimitInputPixels
        }).metadata()
    } catch {
      throw new UploadError(
        'INVALID_IMAGE',
        'Imagem invalida ou corrompida.',
        400
      )
    }

    if (
      !originalMetadata.format ||
      !supportedSharpFormats.has(originalMetadata.format)
    ) {
      throw new UploadError(
        'INVALID_IMAGE_TYPE',
        'Formato invalido. Use JPG, PNG ou WEBP.',
        400
      )
    }

    const detectedContentType =
      contentTypeBySharpFormat[originalMetadata.format]

    if (detectedContentType !== originalContentType) {
      throw new UploadError(
        'INVALID_IMAGE_TYPE',
        'O conteudo da imagem nao corresponde ao tipo informado.',
        400
      )
    }

    try {
      let pipeline =
        sharp(buffer, {
          limitInputPixels: sharpLimitInputPixels
        })
          .rotate()
          .resize({
            width: profile.width,
            height: profile.height,
            fit: profile.fit,
            position: profile.position,
            withoutEnlargement: profile.withoutEnlargement,
            background: profile.background
          })

      if (profile.outputFormat === 'png') {
        pipeline =
          pipeline.png({
            compressionLevel: 9,
            adaptiveFiltering: true
          })
      } else {
        pipeline =
          pipeline.webp({
            quality: profile.quality ?? 85,
            effort: 4
          })
      }

      const processedBuffer =
        await pipeline.toBuffer()

      const processedMetadata =
        await sharp(processedBuffer, {
          limitInputPixels: sharpLimitInputPixels
        }).metadata()

      const contentType =
        getUploadOutputContentType(profile.outputFormat)

      const width =
        processedMetadata.width ?? profile.width

      const height =
        processedMetadata.height ?? profile.height

      return {
        buffer: processedBuffer,
        contentType,
        metadata: {
          assetType,
          width,
          height,
          sizeInBytes: processedBuffer.length,
          contentType,
          format: profile.outputFormat,
          aspectRatio: width / height,
          processedAt: new Date().toISOString(),
          version: UPLOAD_PIPELINE_VERSION,
          hash: getShortHash(processedBuffer),
          original: {
            width: originalMetadata.width ?? null,
            height: originalMetadata.height ?? null,
            sizeInBytes: buffer.length,
            contentType: originalContentType,
            format: originalMetadata.format ?? null
          }
        }
      }
    } catch (error) {
      if (error instanceof UploadError) {
        throw error
      }

      throw new UploadError(
        'IMAGE_PROCESSING_FAILED',
        'Nao foi possivel processar a imagem.',
        400
      )
    }
  }
}
