// Framework
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'

// Modules
import { uploadsRoutes } from './modules/uploads/routes/uploads-routes.js'
import { healthRoutes } from './modules/health/routes/health-routes.js'

import {
  allowedOrigins,
  corsAllowedHeaders,
  corsAllowedMethods,
  validateCorsOrigin
} from './lib/cors.js'

// Routes
import { authRoutes } from './modules/auth/routes/authenticate-routes.js'
import { usersRoutes } from './modules/users/routes/users-routes.js'

import { eventsRoutes } from './modules/events/routes/events-routes.js'

import { catalogCategoriesRoutes } from './modules/catalog/categories/routes/catalog-categories-routes.js'
import { catalogProductsRoutes } from './modules/catalog/products/routes/catalog-products-routes.js'
import { eventProductsRoutes } from './modules/catalog/event-products/routes/event-products-routes.js'
import { productOptionsRoutes } from './modules/catalog/product-options/routes/product-options-routes.js'
import { catalogImportRoutes } from './modules/catalog/import/routes/catalog-import-routes.js'

import { ordersRoutes } from './modules/orders/routes/orders-routes.js'

import { paymentsRoutes } from './modules/payments/routes/payments-routes.js'
import { paymentProviderSettingsRoutes } from './modules/payment-provider-settings/routes/payment-provider-settings-routes.js'
import { paymentSettingsRoutes } from './modules/payment-settings/payment-settings-routes.js'

import { metricsRoutes } from './modules/metrics/routes/metrics-routes.js'

import { printersRoutes } from './modules/printers/routes/printers-routes.js'
import { printJobsRoutes } from './modules/print-jobs/routes/print-jobs-routes.js'
import { devicePrintJobsRoutes } from './modules/device-print-jobs/routes/device-print-jobs-routes.js'

import { devicesRoutes } from './modules/devices/routes/devices-routes.js'
import { auditLogsRoutes } from './modules/audit-logs/routes/audit-logs-routes.js'
import { nfcCardsRoutes } from './modules/nfc-cards/routes/nfc-cards-routes.js'
import { onlineStoresRoutes } from './modules/online-stores/routes/online-stores-routes.js'
import { superAdminRoutes } from './modules/super-admin/routes/super-admin-routes.js'
import { customersRoutes } from './modules/customers/routes/customers-routes.js'
import { settingsRoutes } from './modules/settings/routes/settings-routes.js'
import {
  formatUploadLimitMessage,
  isFileTooLargeError,
  uploadMaxFileSizeInBytes,
  uploadMaxFileSizeInMB,
  uploadMultipartLimits
} from './modules/uploads/upload-config.js'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const app = Fastify({
  trustProxy: process.env.TRUST_PROXY === 'true',
  logger: {
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
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'accessToken',
        'webhookSecret',
        'jwt',
        'password',
        'secret',
        'secretAccessKey',
        'accessKeyId',
        'token',
        'redisUrl',
        'REDIS_URL',
        'connectionString'
      ],
      censor: '[REDACTED]'
    }
  }
})

app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      app.log.debug({ origin: null, status: 'allowed' }, 'CORS: Request without origin, allowed')
      return callback(null, true)
    }

    validateCorsOrigin(origin, (_error, allow) => {
      if (allow) {
        app.log.debug({ origin, status: 'allowed' }, 'CORS: Origin in whitelist, allowed')
        return callback(null, true)
      }

      app.log.warn({ origin, status: 'blocked' }, 'CORS: Origin not in whitelist, blocked')
      return callback(null, false)
    })
  },
  methods: corsAllowedMethods,
  allowedHeaders: corsAllowedHeaders,
  credentials: true
})

app.register(multipart, {
  limits: uploadMultipartLimits
})

app.setErrorHandler((error, request, reply) => {
  const typedError = error as Error & { code?: string }
  if (
    typedError.code === 'TENANT_DATA_LEAK_DETECTED'
  ) {
    request.log.error(
      {
        code: typedError.code,
        path: request.url,
        userId: request.user?.sub ?? null,
        role: request.user?.role ?? null,
        userOrganizationId: request.user?.organizationId ?? null,
        tenantContextOrganizationId:
          request.tenantContext?.organizationId ?? null
      },
      'TENANT_DATA_LEAK_DETECTED'
    )

    return reply.status(500).send({
      code: 'TENANT_DATA_LEAK_DETECTED',
      message: 'Tenant data isolation violation detected'
    })
  }

  if (isFileTooLargeError(error)) {
    const uploadError =
      error as {
        code?: string
        statusCode?: number
      }

    request.log.warn(
      {
        code: uploadError.code,
        statusCode: uploadError.statusCode,
        uploadMaxFileSizeInBytes
      },
      'Upload rejected because file is too large'
    )

    return reply.status(413).send({
      code: 'FILE_TOO_LARGE',
      message: formatUploadLimitMessage(),
      limit: {
        bytes: uploadMaxFileSizeInBytes,
        megabytes: uploadMaxFileSizeInMB
      }
    })
  }

  const operationalError = error as Error & {
    code?: string
    statusCode?: number
    details?: Record<string, unknown>
  }

  if (operationalError.code && operationalError.statusCode) {
    return reply.status(operationalError.statusCode).send({
      code: operationalError.code,
      message: operationalError.message,
      ...(operationalError.details ?? {})
    })
  }

  return reply.send(error)
})

// Registrar rate limiting global
await app.register(fastifyRateLimit, {
  global: false, // Não aplicar globalmente, vamos configurar por rota
  errorResponseBuilder: (req, context) => {
    return {
      message: 'Muitas requisições. Tente novamente em instantes.'
    }
  },
  keyGenerator: (req) => {
    // Para rotas autenticadas, usar o ID do usuário como chave
    if (req.user && 'sub' in req.user) {
      return `user:${req.user.sub}`
    }
    // Para rotas públicas, usar o IP
    return `ip:${req.ip}`
  }
})

// Auth
app.register(authRoutes)
app.register(usersRoutes)

// Health
app.register(healthRoutes)

// Events
app.register(eventsRoutes)

// Catalog
app.register(catalogCategoriesRoutes)
app.register(catalogProductsRoutes)
app.register(eventProductsRoutes)
app.register(productOptionsRoutes)
app.register(catalogImportRoutes)

// Orders
app.register(ordersRoutes)

// Payments
app.register(paymentsRoutes)
app.register(paymentProviderSettingsRoutes)
app.register(paymentSettingsRoutes)

// Metrics
app.register(metricsRoutes)

// Printing
app.register(printersRoutes)
app.register(printJobsRoutes)
app.register(devicePrintJobsRoutes)

// Uploads
app.register(uploadsRoutes)

// Devices
app.register(devicesRoutes)

// Audit Logs
app.register(auditLogsRoutes)

// NFC Cards
app.register(nfcCardsRoutes)

// Online Stores
app.register(onlineStoresRoutes)

// Customers
app.register(customersRoutes)

// Settings
app.register(settingsRoutes)

// Super Admin
app.register(superAdminRoutes)

app.get('/', async () => {
  return {
    status: 'ok',
    message: 'API Running 🚀'
  }
})

export { allowedOrigins }
