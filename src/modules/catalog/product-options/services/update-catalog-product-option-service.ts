import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface UpdateCatalogProductOptionServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  optionId: string
  name?: string
  key?: string
  description?: string
  priceDeltaInCents?: number
  linkedProductId?: string | null
  sortOrder?: number
}

export class UpdateCatalogProductOptionService {
  async execute({
    organizationId,
    userId,
    optionId,
    name,
    key,
    description,
    priceDeltaInCents,
    linkedProductId,
    sortOrder
  }: UpdateCatalogProductOptionServiceRequest) {
    const option = await prisma.catalogProductOption.findFirst({
      where: {
        id: optionId,
        organizationId
      },
      include: {
        optionGroup: {
          select: {
            productId: true
          }
        }
      }
    })

    if (!option) {
      throw new Error('Option not found')
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

    const updatedOption = await prisma.catalogProductOption.update({
      where: {
        id: optionId
      },
      data: {
        name,
        key,
        description,
        priceDeltaInCents,
        linkedProductId,
        sortOrder
      }
    })

    const beforeData = {
      name: option.name,
      key: option.key,
      description: option.description,
      priceDeltaInCents: option.priceDeltaInCents,
      linkedProductId: option.linkedProductId,
      sortOrder: option.sortOrder,
      active: option.active
    }
    const afterData = {
      name: updatedOption.name,
      key: updatedOption.key,
      description: updatedOption.description,
      priceDeltaInCents: updatedOption.priceDeltaInCents,
      linkedProductId: updatedOption.linkedProductId,
      sortOrder: updatedOption.sortOrder,
      active: updatedOption.active
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
      entity: 'CatalogProductOption',
      entityId: updatedOption.id,
      action: AuditAction.PRODUCT_OPTION_CHANGED,
      description: 'Opção atualizada',
      metadata: {
        productId: option.optionGroup.productId,
        optionGroupId: updatedOption.optionGroupId,
        optionId: updatedOption.id,
        changedFields,
        beforeData,
        afterData
      }
    })

    return {
      option: updatedOption
    }
  }
}
