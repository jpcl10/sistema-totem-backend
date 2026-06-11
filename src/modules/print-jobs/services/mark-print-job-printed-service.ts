import { prisma } from '../../../lib/prisma.js'

interface MarkPrintJobPrintedServiceRequest {
  organizationId: string
  printJobId: string
}

export class MarkPrintJobPrintedService {
  async execute({
    organizationId,
    printJobId
  }: MarkPrintJobPrintedServiceRequest) {
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
          status: 'PRINTED',
          printedAt: new Date(),
          errorMessage: null
        }
      })

    return {
      printJob: updatedPrintJob
    }
  }
}