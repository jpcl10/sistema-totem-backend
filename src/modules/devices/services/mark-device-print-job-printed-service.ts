import { prisma } from '../../../lib/prisma.js'

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
          status: 'PRINTED',
          printedAt: new Date()
        }
      })

    return {
      printJob: updatedPrintJob
    }
  }
}