import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface CreateCatalogProductOptionServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  groupId: string
  name: string
  key: string
  description?: string
  priceDeltaInCents: number
  linkedProductId?: string
  sortOrder: number
}

export class CreateCatalogProductOptionService {
  async execute({
    organizationId,
    userId,
    groupId,
    name,
    key,
    description,
    priceDeltaInCents,
    linkedProductId,
    sortOrder
  }: CreateCatalogProductOptionServiceRequest) {
    const optionGroup = await prisma.catalogProductOptionGroup.findFirst({
      where: {
        id: groupId,
        organizationId
      }
    })

    if (!optionGroup) {
      throw new Error('Option group not found')
    }

    // Validate linked product if provided
    if (linkedProductId) {
      const linkedProduct = await prisma.catalogProduct.findFirst({
        where: {
          id: linkedProductId,
          organizationId,
          active: true
        }
      })

      if (!linkedProduct) {
        throw new Error('Linked product not found or inactive')
      }
    }

    const option = await prisma.catalogProductOption.create({
      data: {
        organizationId,
        optionGroupId: groupId,
        name,
        key,
        description,
        priceDeltaInCents,
        linkedProductId,
        sortOrder,
        active: true
      }
    })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogProductOption',
      entityId: option.id,
      action: AuditAction.PRODUCT_OPTION_CHANGED,
      description: 'Opção criada',
      metadata: {
        productId: optionGroup.productId,
        optionGroupId: option.optionGroupId,
        optionId: option.id,
        changedFields: [
          'name',
          'key',
          'description',
          'priceDeltaInCents',
          'linkedProductId',
          'sortOrder',
          'active'
        ],
        beforeData: null,
        afterData: {
          name: option.name,
          key: option.key,
          description: option.description,
          priceDeltaInCents: option.priceDeltaInCents,
          linkedProductId: option.linkedProductId,
          sortOrder: option.sortOrder,
          active: option.active
        }
      }
    })

    return {
      option
    }
  }
}
