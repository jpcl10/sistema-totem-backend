export type DashboardPeriod =
  | 'EVENT'
  | 'TODAY'
  | 'YESTERDAY'
  | '24H'
  | '7D'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'CUSTOM'

interface GetPeriodDateFilterRequest {
  period?: string
  startDate?: string
  endDate?: string
}

export function getPeriodDateFilter({
  period = 'EVENT',
  startDate,
  endDate
}: GetPeriodDateFilterRequest) {
  const now = new Date()

  switch (period) {
    case 'TODAY': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)

      const end = new Date(now)
      end.setHours(23, 59, 59, 999)

      return {
        gte: start,
        lte: end
      }
    }

    case '24H':
      return {
        gte: new Date(
          now.getTime() - 24 * 60 * 60 * 1000
        ),
        lte: now
      }

    case '7D':
      return {
        gte: new Date(
          now.getTime() - 7 * 24 * 60 * 60 * 1000
        ),
        lte: now
      }

    case 'CUSTOM': {
      if (!startDate || !endDate) {
        throw new Error(
          'startDate and endDate are required for CUSTOM period'
        )
      }

      const parsedStartDate = new Date(startDate)
      const parsedEndDate = new Date(endDate)

      if (
        Number.isNaN(parsedStartDate.getTime()) ||
        Number.isNaN(parsedEndDate.getTime())
      ) {
        throw new Error('Invalid custom date range')
      }

      return {
        gte: parsedStartDate,
        lte: parsedEndDate
      }
    }

    case 'EVENT':
    default:
      return undefined
  }
}
