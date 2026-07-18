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

    const beforeData = {
      name: optionGroup.name,
      key: optionGroup.key,
      description: optionGroup.description,
      required: optionGroup.required,
      minSelections: optionGroup.minSelections,
      maxSelections: optionGroup.maxSelections,
      sortOrder: optionGroup.sortOrder,
      active: optionGroup.active
    }
    const afterData = {
      name: updatedOptionGroup.name,
      key: updatedOptionGroup.key,
      description: updatedOptionGroup.description,
      required: updatedOptionGroup.required,
      minSelections: updatedOptionGroup.minSelections,
      maxSelections: updatedOptionGroup.maxSelections,
      sortOrder: updatedOptionGroup.sortOrder,
      active: updatedOptionGroup.active
    }
    const changedFields = Object.keys(beforeData).filter(field =>
      beforeData[field as keyof typeof beforeData] !==
        afterData[field as keyof typeof afterData]
    )

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogProductOptionGroup',
      entityId: updatedOptionGroup.id,
      action: AuditAction.PRODUCT_OPTION_CHANGED,
      description: 'Grupo de opções atualizado',
      metadata: {
        productId: updatedOptionGroup.productId,
        optionGroupId: updatedOptionGroup.id,
        changedFields,
        beforeData,
        afterData
      }
    })

    return {
      optionGroup: updatedOptionGroup
    }
  }
}
