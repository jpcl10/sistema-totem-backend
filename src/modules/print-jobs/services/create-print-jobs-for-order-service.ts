import { OrderPrintOrchestratorService } from './order-print-orchestrator-service.js'

interface CreatePrintJobsForOrderServiceRequest {
  orderId: string
}

export class CreatePrintJobsForOrderService {
  async execute({ orderId }: CreatePrintJobsForOrderServiceRequest) {
    return new OrderPrintOrchestratorService().execute({
      domain: 'EVENT_ORDER',
      orderId
    })
  }
}
