import { FastifyRequest } from 'fastify'

export function tenantDataLeakError(message = 'Tenant data leak detected') {
  const error = new Error(message) as Error & {
    statusCode: number
    code: string
  }
  error.statusCode = 500
  error.code = 'TENANT_DATA_LEAK_DETECTED'
  return error
}

export function catalogOperationError({
  code,
  message,
  statusCode = 400,
  details
}: {
  code: string
  message: string
  statusCode?: number
  details?: Record<string, unknown>
}) {
  const error = new Error(message) as Error & {
    statusCode: number
    code: string
    details?: Record<string, unknown>
  }
  error.statusCode = statusCode
  error.code = code
  error.details = details
  return error
}

export function logCatalogTenantContext(
  request: FastifyRequest,
  endpoint: string,
  effectiveOrganizationId: string
) {
  request.log.info(
    {
      endpoint,
      userId: request.user.sub,
      role: request.user.role,
      userOrganizationId: request.user.organizationId,
      tenantContextOrganizationId: request.tenantContext?.organizationId ?? null,
      effectiveOrganizationId,
      selectedOrganizationId:
        typeof request.headers['x-organization-id'] === 'string'
          ? request.headers['x-organization-id']
          : null
    },
    'Catalog tenant context resolved'
  )
}
