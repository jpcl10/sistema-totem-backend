import { prisma } from '../../../lib/prisma.js'

interface MarkDevicePrintJobErrorServiceRequest {
  organizationId: string
  printJobId: string
  errorMessage?: string
}

export class MarkDevicePrintJobErrorService {
  async execute({
    organizationId,
    printJobId,
    errorMessage
  }: MarkDevicePrintJobErrorServiceRequest) {
    const printJob =
      await prisma.eventPrintJob.findFirst({
        where: {
          id: printJobId,
          event: {
            organizationId
          }
        }
      })

    if (!printJob) {
      throw new Error('Print job not found')
    }

    const updatedPrintJob =
      await prisma.eventPrintJob.update({
        where: {
          id: printJobId
        },
        data: {
          status: 'ERROR',
          errorMessage:
            errorMessage ?? 'Device print error'
        }
      })

    return {
      printJob: updatedPrintJob
    }
  }
}