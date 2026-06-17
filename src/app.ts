// Framework
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'

// Modules
import { uploadsRoutes } from './modules/uploads/routes/uploads-routes.js'
import { healthRoutes } from './modules/health/routes/health-routes.js'

// Services
import { ProcessPrintJobsService } from './modules/print-jobs/services/process-print-jobs-service.js'

// Routes
import { authRoutes } from './modules/auth/routes/authenticate-routes.js'
import { usersRoutes } from './modules/users/routes/users-routes.js'

import { eventsRoutes } from './modules/events/routes/events-routes.js'

import { catalogCategoriesRoutes } from './modules/catalog/categories/routes/catalog-categories-routes.js'
import { catalogProductsRoutes } from './modules/catalog/products/routes/catalog-products-routes.js'
import { eventProductsRoutes } from './modules/catalog/event-products/routes/event-products-routes.js'

import { ordersRoutes } from './modules/orders/routes/orders-routes.js'

import { paymentsRoutes } from './modules/payments/routes/payments-routes.js'
import { paymentProviderSettingsRoutes } from './modules/payment-provider-settings/routes/payment-provider-settings-routes.js'

import { metricsRoutes } from './modules/metrics/routes/metrics-routes.js'

import { printersRoutes } from './modules/printers/routes/printers-routes.js'
import { printJobsRoutes } from './modules/print-jobs/routes/print-jobs-routes.js'
import { devicePrintJobsRoutes } from './modules/device-print-jobs/routes/device-print-jobs-routes.js'

import { devicesRoutes } from './modules/devices/routes/devices-routes.js'
import { auditLogsRoutes } from './modules/audit-logs/routes/audit-logs-routes.js'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const app = Fastify({
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
        'token'
      ],
      censor: '[REDACTED]'
    }
  }
})

// Carregar ALLOWED_ORIGINS
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000'
const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim())

app.register(cors, {
  origin: (origin, callback) => {
    // Allow requests without origin (Insomnia/Postman/webhooks/server-to-server)
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error('Not allowed by CORS'), false)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})

app.register(multipart)

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

// Orders
app.register(ordersRoutes)

// Payments
app.register(paymentsRoutes)
app.register(paymentProviderSettingsRoutes)

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

app.get('/', async () => {
  return {
    status: 'ok',
    message: 'API Running 🚀'
  }
})

const processPrintJobsService =
  new ProcessPrintJobsService()

setInterval(async () => {
  try {
    await processPrintJobsService.execute()
  } catch (error) {
    app.log.error(error, 'Print worker error')
  }
}, 3000)

export { allowedOrigins }
