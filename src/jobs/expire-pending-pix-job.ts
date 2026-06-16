import { ExpirePendingPixPaymentsService } from '../modules/payments/services/expire-pending-pix-payments-service.js'

export function startExpirePendingPixJob() {
  const service = new ExpirePendingPixPaymentsService()

  setInterval(async () => {
    try {
      const result = await service.execute()

      if (result.expiredCount > 0) {
        console.log(
          `PIX expirados: ${result.expiredCount}`
        )
      }
    } catch (error) {
      console.error(error)
    }
  }, 30000)
}