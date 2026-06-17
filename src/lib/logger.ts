import pino from 'pino'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined,
  redact: {
    paths: [
      'accessToken',
      'webhookSecret',
      'jwt',
      'password',
      'secret',
      'secretAccessKey',
      'accessKeyId',
      'token'
    ],
    censor: '[REDACTED]'
  }
})
