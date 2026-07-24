import { prisma } from '../../../lib/prisma.js'

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

    return {
      printJob: updatedPrintJob
    }
  }
}
