import { TestPrinterService } from '../services/test-printer-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function testPrinterController(request, reply) {
    const { printerId } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new TestPrinterService();
    await service.execute({
        organizationId,
        userRole: request.user.role,
        printerId
    });
    return reply.send({
        success: true
    });
}
