import 'dotenv/config'

import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function getPackageVersion(packageName: string) {
  try {
    return require(`${packageName}/package.json`).version as string
  } catch {
    return null
  }
}

async function main() {
  const endpoint =
    process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : null

  console.log(JSON.stringify({
    nodeVersion: process.version,
    versions: {
      '@aws-sdk/client-s3': getPackageVersion('@aws-sdk/client-s3'),
      '@smithy/node-http-handler': getPackageVersion('@smithy/node-http-handler'),
      '@smithy/protocol-http': getPackageVersion('@smithy/protocol-http'),
      '@smithy/smithy-client': getPackageVersion('@smithy/smithy-client'),
      '@smithy/signature-v4': getPackageVersion('@smithy/signature-v4'),
      '@aws-sdk/node-http-handler': getPackageVersion('@aws-sdk/node-http-handler')
    },
    config: {
      endpoint,
      region: 'auto',
      forcePathStyle: false,
      bucketConfigured: Boolean(process.env.R2_BUCKET_NAME),
      accountIdConfigured: Boolean(process.env.R2_ACCOUNT_ID),
      accessKeyConfigured: Boolean(process.env.R2_ACCESS_KEY_ID),
      secretKeyConfigured: Boolean(process.env.R2_SECRET_ACCESS_KEY)
    }
  }, null, 2))

  if (!endpoint) {
    throw new Error('R2_ACCOUNT_ID is not configured')
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? ''
    }
  })

  try {
    const result = await client.send(new ListBucketsCommand({}))

    console.log(JSON.stringify({
      ok: true,
      httpStatusCode: result.$metadata.httpStatusCode,
      requestId: result.$metadata.requestId,
      attempts: result.$metadata.attempts,
      totalRetryDelay: result.$metadata.totalRetryDelay,
      buckets: result.Buckets?.map(bucket => ({
        name: bucket.Name,
        creationDate: bucket.CreationDate?.toISOString() ?? null
      })) ?? []
    }, null, 2))
  } catch (error) {
    console.error('ListBucketsCommand failed')
    console.error(error)

    if (error instanceof Error) {
      console.error(JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack
      }, null, 2))
    }

    process.exitCode = 1
  }
}

void main()
