import { OrderPrintOrchestratorService } from './order-print-orchestrator-service.js'

interface CreatePrintJobsForOrderServiceRequest {
  orderId: string
  domain?: 'EVENT_ORDER' | 'ONLINE_ORDER'
}

export class CreatePrintJobsForOrderService {
  async execute({ orderId, domain = 'EVENT_ORDER' }: CreatePrintJobsForOrderServiceRequest) {
    return new OrderPrintOrchestratorService().execute({
      domain,
      orderId
    })
  }
}
