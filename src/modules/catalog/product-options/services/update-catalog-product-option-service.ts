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

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogProductOption',
      entityId: updatedOption.id,
      action: AuditAction.PRODUCT_UPDATED,
      description: 'Opção atualizada',
      metadata: {
        name: updatedOption.name,
        key: updatedOption.key
      }
    })

    return {
      option: updatedOption
    }
  }
}
