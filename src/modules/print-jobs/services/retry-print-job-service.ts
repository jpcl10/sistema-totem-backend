import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'
import { enqueuePrintJob } from '../../../infra/queues/index.js'

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

    if (printJob.status === 'PRINTED' || printJob.status === 'COMPLETED') {
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
          errorMessage: null,
          lockedAt: null,
          lockedBy: null,
          failedAt: null
        }
      })

    if (!updatedPrintJob.deviceId) {
      await enqueuePrintJob(updatedPrintJob.id)
    }

    return {
      printJob: updatedPrintJob
    }
  }
}
