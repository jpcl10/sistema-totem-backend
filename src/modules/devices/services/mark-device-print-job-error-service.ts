import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'

function printJobNotFoundError() {
  const error = new Error('Print job not found') as Error & {
    code: string
    statusCode: number
  }
  error.code = 'PRINT_JOB_NOT_FOUND'
  error.statusCode = 404
  return error
}

interface MarkDevicePrintJobErrorServiceRequest {
  printJobId: string
  deviceId: string
  errorMessage?: string | null
}

export class MarkDevicePrintJobErrorService {
  async execute({
    printJobId,
    deviceId,
    errorMessage
  }: MarkDevicePrintJobErrorServiceRequest) {
    const printJob =
      await prisma.eventPrintJob.findFirst({
        where: {
          id: printJobId,
          deviceId,
          status: {
            in: ['PENDING', 'PROCESSING']
          }
        }
      })

    if (!printJob) {
      logger.warn({
        printJobId,
        deviceId
      }, '[PRINT_QUEUE] error acknowledgement rejected')
      throw printJobNotFoundError()
    }

    const updatedPrintJob =
      await prisma.eventPrintJob.update({
        where: {
          id: printJobId
        },
        data: {
          status: 'ERROR',
          errorMessage:
            errorMessage ?? 'Erro nao informado pelo dispositivo',
          lockedAt: null,
          lockedBy: null
        }
      })

    logger.error({
      printJobId: updatedPrintJob.id,
      deviceId,
      orderId: updatedPrintJob.orderId,
      onlineOrderId: updatedPrintJob.onlineOrderId,
      status: updatedPrintJob.status,
      errorMessage: updatedPrintJob.errorMessage
    }, '[PRINT_QUEUE] job acknowledged with error')

    return {
      printJob: updatedPrintJob
    }
  }
}
