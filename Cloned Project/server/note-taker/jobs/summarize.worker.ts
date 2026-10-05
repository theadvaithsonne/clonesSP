import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { redisConnection, enqueueDistribute } from './queue';
import { generateAndSaveSummary } from '../summarization/summarizer';
import { NoteSession } from '../models/note-session.model';

export function startSummarizeWorker(): Worker {
  const worker = new Worker(
    'notetaker-summarize',
    async (job: Job) => {
      const { sessionId } = job.data;
      console.log(`[SummarizeWorker] Processing session: ${sessionId}`);

      try {
        await generateAndSaveSummary(new Types.ObjectId(sessionId));

        // Enqueue distribution (Phase 4)
        await enqueueDistribute(sessionId);

        console.log(`[SummarizeWorker] Completed session: ${sessionId}`);
      } catch (error) {
        console.error(`[SummarizeWorker] Failed session ${sessionId}:`, error);

        // On final attempt failure, still enqueue distribution so recipients
        // get the raw transcript email instead of nothing. The distribute
        // worker detects a missing summary and uses the fallback template.
        if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
          await NoteSession.findByIdAndUpdate(sessionId, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
          try {
            await enqueueDistribute(sessionId);
            console.log(`[SummarizeWorker] Enqueued transcript-fallback distribution for ${sessionId}`);
          } catch (enqErr) {
            console.error(`[SummarizeWorker] Failed to enqueue fallback distribute:`, enqErr);
          }
        }
        throw error; // Re-throw for BullMQ retry / failure record
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(`[SummarizeWorker] Job ${job?.id} failed:`, error.message);
  });

  console.log('[SummarizeWorker] Started');
  return worker;
}
