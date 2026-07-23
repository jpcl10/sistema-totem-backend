import { OrderPrintOrchestratorService } from './order-print-orchestrator-service.js';
export class CreatePrintJobsForOrderService {
    async execute({ orderId }) {
        return new OrderPrintOrchestratorService().execute({
            domain: 'EVENT_ORDER',
            orderId
        });
    }
}
