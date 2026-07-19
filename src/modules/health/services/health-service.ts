import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { pixExpirationJobStatus } from '../../../jobs/expire-pending-pix-job.js'
import { pingRedis } from '../../../infra/redis/redis-client.js'
import { getPrintingQueueHealth } from '../../../infra/queues/index.js'
import {
  getPrintProcessingStatus
} from '../../../infra/print-processing/print-processing-coordinator.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const packageJsonPath = join(__dirname, '../../../../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

export class HealthService {
  async execute() {
    const databaseResult = await this.checkDatabase()
    const r2Result = this.checkR2()
    const mercadoPagoResult = this.checkMercadoPago()
    const socketResult = this.checkSocket()
    const redisResult = await pingRedis()
    const queuesResult = await this.checkQueues()
    const jobsResult = this.checkJobs()

    const status =
      databaseResult === 'ok' && redisResult.status !== 'unavailable'
        ? 'ok'
        : databaseResult === 'ok'
          ? 'degraded'
          : 'error'

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: databaseResult,
        r2: r2Result,
        mercadoPago: mercadoPagoResult,
        redis: redisResult
      },
      queues: queuesResult,
      socket: socketResult,
      jobs: jobsResult,
      environment: process.env.NODE_ENV || 'development',
      version: packageJson.version
    }
  }

  private async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`
      return 'ok'
    } catch {
      return 'error'
    }
  }

  private checkR2() {
    const {
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
      R2_PUBLIC_URL
    } = process.env

    if (
      R2_ACCOUNT_ID &&
      R2_ACCESS_KEY_ID &&
      R2_SECRET_ACCESS_KEY &&
      R2_BUCKET_NAME &&
      R2_PUBLIC_URL
    ) {
      return 'ok'
    }

    return 'not_configured'
  }

  private checkMercadoPago() {
    const { MERCADO_PAGO_ACCESS_TOKEN } = process.env
    return MERCADO_PAGO_ACCESS_TOKEN ? 'configured' : 'not_configured'
  }

  private checkSocket() {
    if (!io) {
      return { status: 'error' }
    }

    const sockets = io.sockets.sockets
    return {
      status: 'ok',
      connections: sockets.size
    }
  }

  private checkJobs() {
    return {
      pixExpiration: pixExpirationJobStatus,
      printProcessing: getPrintProcessingStatus()
    }
  }

  private async checkQueues() {
    return {
      printing: await getPrintingQueueHealth()
    }
  }
}
