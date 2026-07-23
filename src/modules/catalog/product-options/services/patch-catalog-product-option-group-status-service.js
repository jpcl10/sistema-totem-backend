import { prisma } from '../../../../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js';
export class PatchCatalogProductOptionGroupStatusService {
    async execute({ organizationId, userId, groupId, active }) {
        const optionGroup = await prisma.catalogProductOptionGroup.findFirst({
            where: {
                id: groupId,
                organizationId
            }
        });
        if (!optionGroup) {
            throw new Error('Option group not found');
        }
        const updatedOptionGroup = await prisma.catalogProductOptionGroup.update({
            where: {
                id: groupId
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
            entity: 'CatalogProductOptionGroup',
            entityId: updatedOptionGroup.id,
            action: AuditAction.PRODUCT_OPTION_CHANGED,
            description: active ? 'Grupo de opções ativado' : 'Grupo de opções desativado',
            metadata: {
                productId: updatedOptionGroup.productId,
                optionGroupId: updatedOptionGroup.id,
                changedFields: ['active'],
                beforeData: {
                    active: optionGroup.active
                },
                afterData: {
                    active: updatedOptionGroup.active
                }
            }
        });
        return {
            optionGroup: updatedOptionGroup
        };
    }
}
