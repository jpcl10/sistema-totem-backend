// Framework
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'

// Node
import path from 'node:path'

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

export const app = Fastify()

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})

app.register(multipart)

app.register(fastifyStatic, {
  root: path.resolve('uploads'),
  prefix: '/uploads/'
})

// Auth
app.register(authRoutes)
app.register(usersRoutes)

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

// Devices
app.register(devicesRoutes)

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
    console.error(
      'Print worker error:',
      error
    )
  }
}, 3000)