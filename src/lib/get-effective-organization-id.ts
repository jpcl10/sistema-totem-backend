import { FastifyRequest } from 'fastify'
import { UserRole } from '@prisma/client'

export function getEffectiveOrganizationId(request: FastifyRequest): string {
  const userRole = request.user.role as UserRole
  const userOrgId = request.user.organizationId

  if (userRole === UserRole.SUPER_ADMIN) {
    const query = request.query as Record<string, string | undefined>
    const params = request.params as Record<string, string | undefined>

    // First try query parameter, then params (for nested routes)
    const selectedOrgId = query.organizationId || params.organizationId

    if (selectedOrgId) {
      return selectedOrgId
    }
  }

  // For ADMIN/OPERATOR, or if no org selected by SUPER_ADMIN, use token's org
  return userOrgId
}
