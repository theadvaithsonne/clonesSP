import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';

// Shared Redis connection for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Queue for summarization jobs
export const summarizeQueue = new Queue('notetaker-summarize', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Queue for distribution jobs (Phase 4)
export const distributeQueue = new Queue('notetaker-distribute', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** Add a summarization job for a session. */
export async function enqueueSummarize(sessionId: string): Promise<void> {
  await summarizeQueue.add('summarize', { sessionId }, {
    jobId: `summarize-${sessionId}`,
  });
  console.log(`[Queue] Enqueued summarize job for session: ${sessionId}`);
}

/** Add a distribution job for a session. */
export async function enqueueDistribute(sessionId: string): Promise<void> {
  await distributeQueue.add('distribute', { sessionId }, {
    jobId: `distribute-${sessionId}`,
  });
  console.log(`[Queue] Enqueued distribute job for session: ${sessionId}`);
}
