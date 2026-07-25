import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { verifyJWT } from '../auth/middlewares/verify-jwt.js'
import { requireTenantContext } from '../auth/middlewares/request-context.js'
import {
  listPrintTemplateQuerySchema,
  previewPrintTemplatePayloadSchema,
  printTemplatePayloadSchema,
  resolvePrintTemplateQuerySchema,
  updatePrintTemplatePayloadSchema
} from './print-template-schema.js'
import { PrintTemplateService } from './print-template-service.js'

const paramsSchema = z.object({
  id: z.string().min(1)
})

export async function printTemplateRoutes(app: FastifyInstance) {
  const preHandler = [verifyJWT, requireTenantContext]

  app.get('/print-templates', {
    preHandler,
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
  }, listPrintTemplatesController)

  app.post('/print-templates', {
    preHandler,
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, createPrintTemplateController)

  app.get('/print-templates/resolve', {
    preHandler,
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
  }, resolvePrintTemplateController)

  app.post('/print-templates/preview', {
    preHandler,
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
  }, previewTransientPrintTemplateController)

  app.patch('/print-templates/:id', {
    preHandler,
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, updatePrintTemplateController)

  app.post('/print-templates/:id/duplicate', {
    preHandler,
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, duplicatePrintTemplateController)

  app.post('/print-templates/:id/default', {
    preHandler,
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, setDefaultPrintTemplateController)

  app.post('/print-templates/:id/preview', {
    preHandler,
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
  }, previewPrintTemplateController)

  app.delete('/print-templates/:id', {
    preHandler,
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, deletePrintTemplateController)
}

async function listPrintTemplatesController(request: FastifyRequest) {
  const query = listPrintTemplateQuerySchema.parse(request.query)
  const service = new PrintTemplateService()
  const templates = await service.list({
    ...query,
    organizationId: query.organizationId ?? request.tenantContext?.organizationId
  })
  return { templates }
}

async function createPrintTemplateController(request: FastifyRequest) {
  const body = printTemplatePayloadSchema.parse(request.body)
  const service = new PrintTemplateService()
  const template = await service.create({
    ...body,
    organizationId: body.organizationId ?? request.tenantContext?.organizationId
  }, request.user?.sub)
  return { template }
}

async function updatePrintTemplateController(request: FastifyRequest) {
  const { id } = paramsSchema.parse(request.params)
  const body = updatePrintTemplatePayloadSchema.parse(request.body)
  const service = new PrintTemplateService()
  const template = await service.update(id, body, request.user?.sub)
  return { template }
}

async function duplicatePrintTemplateController(request: FastifyRequest) {
  const { id } = paramsSchema.parse(request.params)
  const service = new PrintTemplateService()
  const template = await service.duplicate(id, request.user?.sub)
  return { template }
}

async function setDefaultPrintTemplateController(request: FastifyRequest) {
  const { id } = paramsSchema.parse(request.params)
  const service = new PrintTemplateService()
  const template = await service.setDefault(id, request.user?.sub)
  return { template }
}

async function deletePrintTemplateController(request: FastifyRequest) {
  const { id } = paramsSchema.parse(request.params)
  const service = new PrintTemplateService()
  return service.remove(id, request.user?.sub)
}

async function resolvePrintTemplateController(request: FastifyRequest) {
  const query = resolvePrintTemplateQuerySchema.parse(request.query)
  const service = new PrintTemplateService()
  const template = await service.resolve({
    ...query,
    organizationId: query.organizationId ?? request.tenantContext?.organizationId
  })
  return { template }
}

async function previewPrintTemplateController(request: FastifyRequest) {
  const { id } = paramsSchema.parse(request.params)
  const body = previewPrintTemplatePayloadSchema.parse(request.body ?? {})
  const service = new PrintTemplateService()
  return service.preview(id, body.order)
}

async function previewTransientPrintTemplateController(request: FastifyRequest) {
  const body = z.object({
    template: printTemplatePayloadSchema.partial(),
    order: z.unknown().optional()
  }).parse(request.body)
  const service = new PrintTemplateService()
  return service.previewTemplate(body.template, body.order)
}
