import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface UpdateCatalogProductOptionGroupServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  groupId: string
  name?: string
  key?: string
  description?: string
  required?: boolean
  minSelections?: number
  maxSelections?: number
  sortOrder?: number
}

export class UpdateCatalogProductOptionGroupService {
  async execute({
    organizationId,
    userId,
    groupId,
    name,
    key,
    description,
    required,
    minSelections,
    maxSelections,
    sortOrder
  }: UpdateCatalogProductOptionGroupServiceRequest) {
    const optionGroup = await prisma.catalogProductOptionGroup.findFirst({
      where: {
        id: groupId,
        organizationId
      }
    })

    if (!optionGroup) {
      throw new Error('Option group not found')
    }

    const newMin = minSelections !== undefined ? minSelections : optionGroup.minSelections
    const newMax = maxSelections !== undefined ? maxSelections : optionGroup.maxSelections
    const newRequired = required !== undefined ? required : optionGroup.required

    // Validation logic
    if (newMax < newMin) {
      throw new Error('maxSelections must be >= minSelections')
    }
    if (newRequired && newMin < 1) {
      throw new Error('minSelections must be at least 1 when required is true')
    }

    const updatedOptionGroup = await prisma.catalogProductOptionGroup.update({
      where: {
        id: groupId
      },
      data: {
        name,
        key,
        description,
        required,
        minSelections,
        maxSelections,
        sortOrder
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
      description: 'Grupo de opções atualizado',
      metadata: {
        name: updatedOptionGroup.name,
        key: updatedOptionGroup.key
      }
    })

    return {
      optionGroup: updatedOptionGroup
    }
  }
}
