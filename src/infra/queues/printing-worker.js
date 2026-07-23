import { Worker } from 'bullmq';
import { createRedisConnection } from '../redis/redis-client.js';
import { logger } from '../../lib/logger.js';
import { redisConfig, printProcessingConfig } from '../../shared/config/redis.js';
import { PRINTING_QUEUE_NAME, PROCESS_PRINT_JOB } from './printing-queue.js';
import { ProcessPrintJobsService } from '../../modules/print-jobs/services/process-print-jobs-service.js';
let worker = null;
const activeJobIds = new Set();
function getWorkerId() {
    return `bullmq:${process.pid}:${Date.now()}`;
}
async function withJobTimeout(task) {
    let timeout = null;
    try {
        return await Promise.race([
            task,
            new Promise((_, reject) => {
                timeout = setTimeout(() => {
                    reject(new Error('Print job timed out'));
                }, printProcessingConfig.jobTimeoutMs);
            })
        ]);
    }
    finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}
export function getPrintingWorkerStatus() {
    return {
        running: Boolean(worker),
        activeJobs: activeJobIds.size
    };
}
export async function startPrintingWorker() {
    if (!redisConfig.enabled) {
        return null;
    }
    if (worker) {
        return worker;
    }
    const connection = createRedisConnection('bullmq-worker');
    if (!connection) {
        return null;
    }
    worker = new Worker(PRINTING_QUEUE_NAME, async (job) => {
        if (job.name !== PROCESS_PRINT_JOB) {
            return;
        }
        const startedAt = Date.now();
        const printJobId = job.data.printJobId;
        const workerId = getWorkerId();
        activeJobIds.add(String(job.id));
        logger.info({
            queueName: PRINTING_QUEUE_NAME,
            jobId: job.id,
            printJobId,
            attemptsMade: job.attemptsMade
        }, 'Print job started');
        try {
            await withJobTimeout(new ProcessPrintJobsService().processOne({
                printJobId,
                workerId,
                attemptNumber: job.attemptsMade + 1,
                maxAttempts: job.opts.attempts ?? 5
            }));
            logger.info({
                queueName: PRINTING_QUEUE_NAME,
                jobId: job.id,
                printJobId,
                attemptsMade: job.attemptsMade,
                durationMs: Date.now() - startedAt
            }, 'Print job completed');
        }
        catch (error) {
            logger.error({
                queueName: PRINTING_QUEUE_NAME,
                jobId: job.id,
                printJobId,
                attemptsMade: job.attemptsMade,
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : 'Print job failed'
            }, 'Print job failed');
            throw error;
        }
        finally {
            activeJobIds.delete(String(job.id));
        }
    }, {
        connection,
        prefix: redisConfig.keyPrefix,
        concurrency: printProcessingConfig.concurrency,
        autorun: true
    });
    worker.on('failed', (job, error) => {
        logger.error({
            queueName: PRINTING_QUEUE_NAME,
            jobId: job?.id,
            printJobId: job?.data.printJobId,
            attemptsMade: job?.attemptsMade,
            error: error.message
        }, 'Print job retry/failure recorded by BullMQ');
    });
    worker.on('stalled', jobId => {
        logger.warn({
            queueName: PRINTING_QUEUE_NAME,
            jobId
        }, 'Print job stalled');
    });
    worker.on('error', error => {
        logger.error({
            queueName: PRINTING_QUEUE_NAME,
            error: error.message
        }, 'Print worker error');
    });
    logger.info({
        queueName: PRINTING_QUEUE_NAME,
        concurrency: printProcessingConfig.concurrency
    }, 'Print worker started');
    return worker;
}
export async function stopPrintingWorker() {
    if (!worker) {
        return;
    }
    const currentWorker = worker;
    worker = null;
    await currentWorker.close();
    logger.info({
        queueName: PRINTING_QUEUE_NAME
    }, 'Print worker stopped');
}
