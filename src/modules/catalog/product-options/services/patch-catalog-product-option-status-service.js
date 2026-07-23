import { prisma } from '../../../../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js';
export class PatchCatalogProductOptionStatusService {
    async execute({ organizationId, userId, optionId, active }) {
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
        });
        if (!option) {
            throw new Error('Option not found');
        }
        const updatedOption = await prisma.catalogProductOption.update({
            where: {
                id: optionId
            },
            data: {
                active
            }
        });
        // Create audit log
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            userId,
            entity: 'CatalogProductOption',
            entityId: updatedOption.id,
            action: AuditAction.PRODUCT_OPTION_CHANGED,
            description: active ? 'Opção ativada' : 'Opção desativada',
            metadata: {
                productId: option.optionGroup.productId,
                optionGroupId: updatedOption.optionGroupId,
                optionId: updatedOption.id,
                changedFields: ['active'],
                beforeData: {
                    active: option.active
                },
                afterData: {
                    active: updatedOption.active
                }
            }
        });
        return {
            option: updatedOption
        };
    }
}
