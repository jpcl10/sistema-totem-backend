import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_VERSION = 'v1'

function getSecret() {
  const secret =
    process.env.PAYMENT_CREDENTIALS_SECRET ??
    process.env.JWT_SECRET

  if (!secret) {
    throw new Error('PAYMENT_CREDENTIALS_SECRET is not configured')
  }

  return crypto
    .createHash('sha256')
    .update(secret)
    .digest()
}

export function encryptPaymentCredentials(value: unknown) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv)
  const plaintext = JSON.stringify(value)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return {
    encryptedPayload: [
      KEY_VERSION,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url')
    ].join('.'),
    keyVersion: KEY_VERSION
  }
}

export function decryptPaymentCredentials<T = unknown>(
  encryptedPayload: string
): T {
  const [version, ivBase64, authTagBase64, encryptedBase64] =
    encryptedPayload.split('.')

  if (version !== KEY_VERSION || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted credentials payload')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getSecret(),
    Buffer.from(ivBase64, 'base64url')
  )

  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64url'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64url')),
    decipher.final()
  ])

  return JSON.parse(decrypted.toString('utf8')) as T
}
