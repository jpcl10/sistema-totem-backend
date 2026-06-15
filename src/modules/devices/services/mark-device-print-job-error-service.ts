import { prisma } from '../../../lib/prisma.js'

interface MarkDevicePrintJobErrorServiceRequest {
  printJobId: string
  deviceId: string
}

export class MarkDevicePrintJobErrorService {
  async execute({
    printJobId,
    deviceId
  }: MarkDevicePrintJobErrorServiceRequest) {
    const printJob =
      await prisma.eventPrintJob.findFirst({
        where: {
          id: printJobId,
          deviceId
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
          status: 'ERROR'
        }
      })

    return {
      printJob: updatedPrintJob
    }
  }
}