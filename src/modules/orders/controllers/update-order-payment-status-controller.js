import { updateOrderPaymentStatusSchema } from '../schemas/update-order-payment-status-schema.js';
import { UpdateOrderPaymentStatusService } from '../services/update-order-payment-status-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function updateOrderPaymentStatusController(request, reply) {
    const params = request.params;
    const body = updateOrderPaymentStatusSchema.parse(request.body);
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const service = new UpdateOrderPaymentStatusService();
    const { order } = await service.execute({
        organizationId,
        userRole: request.user.role,
        userId,
        orderId: params.orderId,
        paymentStatus: body.paymentStatus
    });
    return reply.send({
        order
    });
}
