import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface RetryPrintJobServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  printJobId: string
}

export class RetryPrintJobService {
  async execute({
    organizationId,
    printJobId
  }: RetryPrintJobServiceRequest) {
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
        'Printed job cannot be retried'
      )
    }

    const updatedPrintJob =
      await prisma.eventPrintJob.update({
        where: {
          id: printJobId
        },
        data: {
          status: 'PENDING',
          printedAt: null,
          errorMessage: null
        }
      })

    return {
      printJob: updatedPrintJob
    }
  }
}
