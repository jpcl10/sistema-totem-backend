import { UploadAssetProfile } from '../upload-config.js'

export class UploadError extends Error {
  constructor(
    public code:
      | 'FILE_TOO_LARGE'
      | 'INVALID_IMAGE_TYPE'
      | 'INVALID_IMAGE'
      | 'IMAGE_PROCESSING_FAILED'
      | 'UPLOAD_FAILED'
      | 'INVALID_ASSET_TYPE',
    message: string,
    public statusCode = 400,
    public limit?: {
      bytes: number
      megabytes: number
    }
  ) {
    super(message)
  }
}

export function createFileTooLargeError(
  profile: UploadAssetProfile
) {
  return new UploadError(
    'FILE_TOO_LARGE',
    `O ${profile.label} excede o limite de ${profile.maxFileSizeInMB} MB.`,
    413,
    {
      bytes: profile.maxFileSizeInBytes,
      megabytes: profile.maxFileSizeInMB
    }
  )
}
