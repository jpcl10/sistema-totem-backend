import { prisma } from '../../../lib/prisma.js'

interface CancelPrintJobServiceRequest {
  organizationId: string
  printJobId: string
}

export class CancelPrintJobService {
  async execute({
    organizationId,
    printJobId
  }: CancelPrintJobServiceRequest) {
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

    if (printJob.status === 'PRINTED') {
      throw new Error(
        'Printed job cannot be cancelled'
      )
    }

    const updatedPrintJob =
      await prisma.eventPrintJob.update({
        where: {
          id: printJobId
        },
        data: {
          status: 'CANCELLED',
          errorMessage:
            'Print job cancelled manually'
        }
      })

    return {
      printJob: updatedPrintJob
    }
  }
}