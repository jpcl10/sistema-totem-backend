import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface CreateCatalogProductOptionGroupServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  productId: string
  name: string
  key: string
  description?: string
  required: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
}

export class CreateCatalogProductOptionGroupService {
  async execute({
    organizationId,
    userId,
    productId,
    name,
    key,
    description,
    required,
    minSelections,
    maxSelections,
    sortOrder
  }: CreateCatalogProductOptionGroupServiceRequest) {
    const product = await prisma.catalogProduct.findFirst({
      where: {
        id: productId,
        organizationId
      }
    })

    if (!product) {
      throw new Error('Product not found')
    }

    // Validation logic
    if (maxSelections < minSelections) {
      throw new Error('maxSelections must be greater than or equal to minSelections')
    }

    if (required && minSelections < 1) {
      throw new Error('minSelections must be at least 1 when required is true')
    }

    const optionGroup = await prisma.catalogProductOptionGroup.create({
      data: {
        organizationId,
        productId,
        name,
        key,
        description,
        required,
        minSelections,
        maxSelections,
        sortOrder,
        active: true
      }
    })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogProductOptionGroup',
      entityId: optionGroup.id,
      action: AuditAction.PRODUCT_OPTION_CHANGED,
      description: 'Grupo de opções criado',
      metadata: {
        productId: optionGroup.productId,
        optionGroupId: optionGroup.id,
        changedFields: [
          'name',
          'key',
          'description',
          'required',
          'minSelections',
          'maxSelections',
          'sortOrder',
          'active'
        ],
        beforeData: null,
        afterData: {
          name: optionGroup.name,
          key: optionGroup.key,
          description: optionGroup.description,
          required: optionGroup.required,
          minSelections: optionGroup.minSelections,
          maxSelections: optionGroup.maxSelections,
          sortOrder: optionGroup.sortOrder,
          active: optionGroup.active
        }
      }
    })

    return {
      optionGroup
    }
  }
}
