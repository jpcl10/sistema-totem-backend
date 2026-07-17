import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface CancelPrintJobServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
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
          OR: [
            {
              event: {
                organizationId
              }
            },
            {
              store: {
                organizationId
              }
            }
          ]
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
