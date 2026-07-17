import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface PatchCatalogProductOptionGroupStatusServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  groupId: string
  active: boolean
}

export class PatchCatalogProductOptionGroupStatusService {
  async execute({
    organizationId,
    userId,
    groupId,
    active
  }: PatchCatalogProductOptionGroupStatusServiceRequest) {
    const optionGroup = await prisma.catalogProductOptionGroup.findFirst({
      where: {
        id: groupId,
        organizationId
      }
    })

    if (!optionGroup) {
      throw new Error('Option group not found')
    }

    const updatedOptionGroup = await prisma.catalogProductOptionGroup.update({
      where: {
        id: groupId
      },
      data: {
        active
      }
    })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogProductOptionGroup',
      entityId: updatedOptionGroup.id,
      action: AuditAction.PRODUCT_UPDATED,
      description: active ? 'Grupo de opções ativado' : 'Grupo de opções desativado',
      metadata: {
        active
      }
    })

    return {
      optionGroup: updatedOptionGroup
    }
  }
}
