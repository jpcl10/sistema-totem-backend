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

interface MarkDevicePrintJobPrintedServiceRequest {
  printJobId: string
  deviceId: string
}

export class MarkDevicePrintJobPrintedService {
  async execute({
    printJobId,
    deviceId
  }: MarkDevicePrintJobPrintedServiceRequest) {
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
      }, '[PRINT_QUEUE] printed acknowledgement rejected')
      throw printJobNotFoundError()
    }

    const updatedPrintJob =
      await prisma.eventPrintJob.update({
        where: {
          id: printJobId
        },
        data: {
          status: 'PRINTED',
          printedAt: new Date(),
          lockedAt: null,
          lockedBy: null
        }
      })

    logger.info({
      printJobId: updatedPrintJob.id,
      deviceId,
      orderId: updatedPrintJob.orderId,
      onlineOrderId: updatedPrintJob.onlineOrderId,
      status: updatedPrintJob.status,
      printedAt: updatedPrintJob.printedAt
    }, '[PRINT_QUEUE] job acknowledged as printed')

    return {
      printJob: updatedPrintJob
    }
  }
}
