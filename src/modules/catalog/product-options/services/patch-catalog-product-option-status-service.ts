import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface PatchCatalogProductOptionStatusServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  optionId: string
  active: boolean
}

export class PatchCatalogProductOptionStatusService {
  async execute({
    organizationId,
    userId,
    optionId,
    active
  }: PatchCatalogProductOptionStatusServiceRequest) {
    const option = await prisma.catalogProductOption.findFirst({
      where: {
        id: optionId,
        organizationId
      }
    })

    if (!option) {
      throw new Error('Option not found')
    }

    const updatedOption = await prisma.catalogProductOption.update({
      where: {
        id: optionId
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
      entity: 'CatalogProductOption',
      entityId: updatedOption.id,
      action: AuditAction.PRODUCT_UPDATED,
      description: active ? 'Opção ativada' : 'Opção desativada',
      metadata: {
        active
      }
    })

    return {
      option: updatedOption
    }
  }
}
