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

    return {
      printJob: updatedPrintJob
    }
  }
}
