import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import sharp from 'sharp'

import {
  normalizeUploadAssetType,
  UPLOAD_PIPELINE_VERSION,
  uploadAssetProfiles
} from '../src/modules/uploads/upload-config.js'
import { ProcessImageService } from '../src/modules/uploads/services/process-image-service.js'
import { UploadError } from '../src/modules/uploads/services/upload-errors.js'
import { UploadImageService } from '../src/modules/uploads/services/upload-image-service.js'

async function createImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp',
  options: {
    alpha?: boolean
    noisy?: boolean
  } = {}
) {
  const channels =
    options.alpha ? 4 : 3

  const input =
    options.noisy
      ? randomBytes(width * height * channels)
      : Buffer.alloc(width * height * channels, 180)

  let image =
    sharp(input, {
      raw: {
        width,
        height,
        channels
      }
    })

  if (format === 'jpeg') {
    image = image.jpeg({ quality: 100 })
  }

  if (format === 'png') {
    image = image.png()
  }

  if (format === 'webp') {
    image = image.webp({ quality: 90 })
  }

  return image.toBuffer()
}

async function expectUploadError(
  promise: Promise<unknown>,
  code: UploadError['code']
) {
  try {
    await promise
  } catch (error) {
    assert(error instanceof UploadError)
    assert.equal(error.code, code)
    return
  }

  assert.fail(`Expected upload error ${code}`)
}

async function processImage(
  assetType: keyof typeof uploadAssetProfiles,
  buffer: Buffer,
  contentType: string
) {
  return new ProcessImageService().execute({
    buffer,
    originalContentType: contentType,
    assetType,
    profile: uploadAssetProfiles[assetType]
  })
}

function shortHash(buffer: Buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 12)
}

async function createBannerDesktopFixture() {
  const sizes = [
    [2600, 1400],
    [3000, 1600],
    [3400, 1800],
    [3800, 2000]
  ] as const

  for (const [width, height] of sizes) {
    const buffer =
      await createImage(width, height, 'jpeg', { noisy: true })

    if (
      buffer.length > uploadAssetProfiles.generic.maxFileSizeInBytes &&
      buffer.length < uploadAssetProfiles['banner-desktop'].maxFileSizeInBytes
    ) {
      return buffer
    }
  }

  throw new Error('Could not create banner desktop fixture between 5MB and 10MB')
}

async function main() {
  assert.equal(normalizeUploadAssetType(undefined), 'generic')
  assert.equal(normalizeUploadAssetType(''), 'generic')
  assert.equal(normalizeUploadAssetType('logo-light'), 'logo-light')
  assert.equal(normalizeUploadAssetType('lightLogo'), 'logo-light')
  assert.throws(
    () => normalizeUploadAssetType('unknown'),
    /INVALID_ASSET_TYPE/
  )

  const productJpeg =
    await createImage(1600, 1200, 'jpeg')

  const product =
    await processImage('product', productJpeg, 'image/jpeg')

  assert.equal(product.contentType, 'image/webp')
  assert.equal(product.metadata.assetType, 'product')
  assert.equal(product.metadata.width, 800)
  assert.equal(product.metadata.height, 800)
  assert.equal(product.metadata.format, 'webp')
  assert.equal(product.metadata.version, UPLOAD_PIPELINE_VERSION)
  assert.equal(product.metadata.hash, shortHash(product.buffer))
  assert.equal(product.metadata.aspectRatio, 1)
  assert(!Number.isNaN(Date.parse(product.metadata.processedAt)))

  const transparentLogo =
    await createImage(512, 512, 'png', { alpha: true })

  const logo =
    await processImage('logo', transparentLogo, 'image/png')

  assert.equal(logo.contentType, 'image/webp')
  assert.equal(logo.metadata.width, 512)
  assert.equal(logo.metadata.height, 512)
  assert.equal(logo.metadata.format, 'webp')

  const bannerDesktop =
    await createBannerDesktopFixture()

  assert(
    bannerDesktop.length > uploadAssetProfiles.generic.maxFileSizeInBytes,
    'banner fixture should be above generic 5MB'
  )
  assert(
    bannerDesktop.length < uploadAssetProfiles['banner-desktop'].maxFileSizeInBytes,
    'banner fixture should be below banner desktop 10MB'
  )

  const desktop =
    await processImage('banner-desktop', bannerDesktop, 'image/jpeg')

  assert.equal(desktop.contentType, 'image/webp')
  assert.equal(desktop.metadata.width, 1920)
  assert.equal(desktop.metadata.height, 500)
  assert.equal(desktop.metadata.aspectRatio, 1920 / 500)

  await expectUploadError(
    processImage(
      'banner-desktop',
      Buffer.alloc(
        uploadAssetProfiles['banner-desktop'].maxFileSizeInBytes + 1
      ),
      'image/jpeg'
    ),
    'FILE_TOO_LARGE'
  )

  const bannerMobile =
    await createImage(1200, 900, 'webp', { noisy: true })
  const mobile =
    await processImage('banner-mobile', bannerMobile, 'image/webp')

  assert.equal(mobile.metadata.width, 1080)
  assert.equal(mobile.metadata.height, 600)
  assert.equal(mobile.metadata.format, 'webp')

  const socialImage =
    await createImage(1800, 1000, 'jpeg')
  const social =
    await processImage('social-image', socialImage, 'image/jpeg')

  assert.equal(social.metadata.width, 1200)
  assert.equal(social.metadata.height, 630)
  assert.equal(social.metadata.format, 'webp')

  const defaultProduct =
    await processImage(
      'default-product-image',
      productJpeg,
      'image/jpeg'
    )

  assert.equal(defaultProduct.metadata.width, 800)
  assert.equal(defaultProduct.metadata.height, 800)
  assert.equal(defaultProduct.metadata.format, 'webp')

  const faviconPng =
    await createImage(512, 512, 'png', { alpha: true })
  const favicon =
    await processImage('favicon', faviconPng, 'image/png')

  assert.equal(favicon.contentType, 'image/png')
  assert.equal(favicon.metadata.format, 'png')
  assert.equal(favicon.metadata.version, UPLOAD_PIPELINE_VERSION)

  await expectUploadError(
    processImage(
      'generic',
      Buffer.from('not an image'),
      'image/jpeg'
    ),
    'INVALID_IMAGE'
  )

  await expectUploadError(
    processImage(
      'generic',
      transparentLogo,
      'image/jpeg'
    ),
    'INVALID_IMAGE_TYPE'
  )

  const sentCommands: unknown[] = []
  const auditCalls: unknown[] = []

  const uploadService =
    new UploadImageService(
      {
        async send(command) {
          sentCommands.push(command)
          return {}
        }
      },
      {
        async execute(data) {
          auditCalls.push(data)
          return {}
        }
      }
    )

  const uploaded =
    await uploadService.execute({
      organizationId: 'org_test',
      userId: 'user_test',
      assetType: 'product',
      profile: uploadAssetProfiles.product,
      buffer: product.buffer,
      contentType: product.contentType,
      metadata: product.metadata,
      originalFilename: 'pizza.jpg',
      publicBaseUrl: 'https://cdn.example.com'
    })

  assert.match(
    uploaded.key,
    /^organizations\/org_test\/assets\/product\/v1\/[a-f0-9]{12}-.+\.webp$/
  )
  assert(
    uploaded.key.includes(`/${product.metadata.hash}-`),
    'key should contain processed buffer hash'
  )
  assert.equal(
    uploaded.imageUrl,
    `https://cdn.example.com/${uploaded.key}`
  )
  assert.equal(uploaded.metadata.assetType, 'product')
  assert.equal(uploaded.metadata.version, UPLOAD_PIPELINE_VERSION)
  assert.equal(uploaded.metadata.hash, product.metadata.hash)
  assert.equal(sentCommands.length, 1)
  assert.equal(auditCalls.length, 1)

  const auditMetadata =
    (auditCalls[0] as { metadata: Record<string, unknown> }).metadata

  assert.equal(auditMetadata.pipelineVersion, UPLOAD_PIPELINE_VERSION)
  assert.equal(auditMetadata.processedHash, product.metadata.hash)
  assert.equal(auditMetadata.assetType, 'product')
  assert.equal(auditMetadata.processedSizeInBytes, product.metadata.sizeInBytes)
  assert.equal(auditMetadata.width, product.metadata.width)
  assert.equal(auditMetadata.height, product.metadata.height)
  assert.equal(auditMetadata.contentType, product.contentType)
  assert.equal(auditMetadata.key, uploaded.key)

  const failingUploadService =
    new UploadImageService(
      {
        async send() {
          throw new Error('r2 down')
        }
      },
      {
        async execute() {
          assert.fail('audit should not run when R2 fails')
        }
      }
    )

  await expectUploadError(
    failingUploadService.execute({
      organizationId: 'org_test',
      userId: 'user_test',
      assetType: 'product',
      profile: uploadAssetProfiles.product,
      buffer: product.buffer,
      contentType: product.contentType,
      metadata: product.metadata,
      originalFilename: 'pizza.jpg',
      publicBaseUrl: 'https://cdn.example.com'
    }),
    'UPLOAD_FAILED'
  )

  console.log('Upload pipeline checks passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
