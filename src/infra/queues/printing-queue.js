import { Queue } from 'bullmq';
import { createRedisConnection } from '../redis/redis-client.js';
import { logger } from '../../lib/logger.js';
import { redisConfig } from '../../shared/config/redis.js';
export const PRINTING_QUEUE_NAME = 'defumar:printing';
export const PROCESS_PRINT_JOB = 'PROCESS_PRINT_JOB';
let printingQueue = null;
export function getPrintingQueue() {
    if (!redisConfig.enabled) {
        return null;
    }
    if (printingQueue) {
        return printingQueue;
    }
    const connection = createRedisConnection('bullmq-producer');
    if (!connection) {
        return null;
    }
    printingQueue = new Queue(PRINTING_QUEUE_NAME, {
        connection,
        prefix: redisConfig.keyPrefix,
        defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: {
                age: 60 * 60,
                count: 500
            },
            removeOnFail: {
                age: 7 * 24 * 60 * 60,
                count: 2000
            }
        }
    });
    return printingQueue;
}
export async function enqueuePrintJob(printJobId) {
    if (!redisConfig.enabled) {
        return {
            enqueued: false,
            reason: 'redis_disabled'
        };
    }
    const queue = getPrintingQueue();
    if (!queue) {
        return {
            enqueued: false,
            reason: 'queue_unavailable'
        };
    }
    const job = await queue.add(PROCESS_PRINT_JOB, { printJobId }, {
        jobId: printJobId,
        delay: 0
    });
    logger.info({
        queueName: PRINTING_QUEUE_NAME,
        jobId: job.id,
        printJobId
    }, 'Print job enqueued');
    return {
        enqueued: true,
        job
    };
}
export async function getPrintingQueueHealth() {
    if (!redisConfig.enabled) {
        return {
            enabled: false,
            status: 'disabled'
        };
    }
    try {
        const queue = getPrintingQueue();
        if (!queue) {
            return {
                enabled: true,
                status: 'unavailable'
            };
        }
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        return {
            enabled: true,
            status: 'ok',
            counts
        };
    }
    catch {
        return {
            enabled: true,
            status: 'unavailable'
        };
    }
}
export async function closePrintingQueue() {
    if (!printingQueue) {
        return;
    }
    await printingQueue.close();
    printingQueue = null;
}
