import { FastifyRequest } from 'fastify'

export function getEffectiveOrganizationId(request: FastifyRequest): string {
  if (request.tenantContext?.organizationId) {
    return request.tenantContext.organizationId
  }

  throw new Error('TENANT_CONTEXT_REQUIRED')
}
