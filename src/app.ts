import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ProcessPrintJobsService } from './modules/print-jobs/services/process-print-jobs-service.js'
import { usersRoutes } from './modules/users/routes/users-routes.js'
import { authRoutes } from './modules/auth/routes/authenticate-routes.js'
import { eventsRoutes } from './modules/events/routes/events-routes.js'
import { ordersRoutes } from './modules/orders/routes/orders-routes.js'
import { catalogCategoriesRoutes } from './modules/catalog/categories/routes/catalog-categories-routes.js'
import { catalogProductsRoutes } from './modules/catalog/products/routes/catalog-products-routes.js'
import { eventProductsRoutes } from './modules/catalog/event-products/routes/event-products-routes.js'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { metricsRoutes } from './modules/metrics/routes/metrics-routes.js'
import { printJobsRoutes } from './modules/print-jobs/routes/print-jobs-routes.js'
import { printersRoutes } from './modules/printers/routes/printers-routes.js'
import { devicePrintJobsRoutes } from './modules/device-print-jobs/routes/device-print-jobs-routes.js'
import { paymentsRoutes } from './modules/payments/routes/payments-routes.js'
import { paymentProviderSettingsRoutes } from './modules/payment-provider-settings/routes/payment-provider-settings-routes.js'



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

app.register(catalogCategoriesRoutes)
app.register(metricsRoutes)
app.register(printJobsRoutes)
app.register(catalogProductsRoutes)
app.register(eventProductsRoutes)
app.register(ordersRoutes)
app.register(usersRoutes)
app.register(authRoutes)
app.register(eventsRoutes)
app.register(printersRoutes)
app.register(devicePrintJobsRoutes)
app.register(paymentsRoutes)
app.register(paymentProviderSettingsRoutes)



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