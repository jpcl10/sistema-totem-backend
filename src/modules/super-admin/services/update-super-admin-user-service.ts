import bcrypt from 'bcryptjs'
import { AuditAction, UserRole } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface UpdateSuperAdminUserRequest {
  actorUserId: string
  userId: string
  organizationId: string
  name: string
  email: string
  password?: string
  role: UserRole
  confirmOrganizationChange?: boolean
}

export class UpdateSuperAdminUserService {
  async execute(request: UpdateSuperAdminUserRequest) {
    const existing = await prisma.user.findUnique({
      where: { id: request.userId },
      include: { organization: true }
    })

    if (!existing) {
      throw new Error('User not found')
    }

    const targetOrganization = await prisma.organization.findUnique({
      where: { id: request.organizationId }
    })

    if (!targetOrganization) {
      throw new Error('Organization not found')
    }

    const organizationChanged = existing.organizationId !== request.organizationId

    if (organizationChanged && request.confirmOrganizationChange !== true) {
      throw new Error('Organization change confirmation required')
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email: request.email }
    })

    if (emailOwner && emailOwner.id !== existing.id) {
      throw new Error('User already exists.')
    }

    const passwordHash = request.password
      ? await bcrypt.hash(request.password, 6)
      : undefined

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        organizationId: request.organizationId,
        name: request.name,
        email: request.email,
        role: request.role,
        ...(passwordHash ? { password: passwordHash } : {}),
        ...(organizationChanged ? { sessionVersion: { increment: 1 } } : {})
      },
      include: { organization: true }
    })

    await new CreateAuditLogService().execute({
      organizationId: updated.organizationId,
      userId: request.actorUserId,
      entity: 'User',
      entityId: updated.id,
      action: AuditAction.USER_UPDATED,
      description: organizationChanged
        ? 'Organizacao do usuario alterada por SUPER_ADMIN'
        : 'Usuario atualizado por SUPER_ADMIN',
      metadata: {
        userId: updated.id,
        email: updated.email,
        previousOrganizationId: existing.organizationId,
        previousOrganizationName: existing.organization.name,
        newOrganizationId: updated.organizationId,
        newOrganizationName: updated.organization.name,
        sessionInvalidated: organizationChanged
      }
    })

    return updated
  }
}
