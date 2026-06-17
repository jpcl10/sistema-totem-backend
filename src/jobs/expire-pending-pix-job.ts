import { ExpirePendingPixPaymentsService } from '../modules/payments/services/expire-pending-pix-payments-service.js'
import { logger } from '../lib/logger.js'

export let pixExpirationJobStatus: 'running' | 'stopped' = 'stopped'

export function startExpirePendingPixJob() {
  const service = new ExpirePendingPixPaymentsService()

  setInterval(async () => {
    try {
      const result = await service.execute()

      if (result.expiredCount > 0) {
        logger.info({ expiredCount: result.expiredCount }, 'PIX expirados')
      }
    } catch (error) {
      logger.error(error, 'Erro no job de expiração de PIX')
    }
  }, 30000)

  pixExpirationJobStatus = 'running'
}