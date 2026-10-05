# `server/note-taker/jobs/summarize.worker.ts`

> BullMQ worker for the `notetaker-summarize` queue: generates the AI summary for a note-taker session, then queues the participant email.

**Kind:** Note-Taker module — BullMQ job/worker · **Lines:** 55

## Purpose
Second stage of the Note-Taker pipeline. Once a transcript has been saved and `enqueueSummarize` called, this worker turns the transcript into a structured `NoteSummary` (via the summarizer, which calls OpenAI) and then hands off to the distribution stage. It is started once at boot from `server/index.ts`.

## How it works
- `startSummarizeWorker()` creates a `Worker('notetaker-summarize', ...)` on the shared `redisConnection` with concurrency 3.
- For each job it reads `sessionId` from `job.data` and calls `generateAndSaveSummary(new Types.ObjectId(sessionId))`. That function (in `summarization/summarizer.ts`) loads the `NoteSession` and `NoteTranscript`, produces the summary, creates the `NoteSummary` document and sets the session's `summaryId` and `status: 'ready'`.
- On success it calls `enqueueDistribute(sessionId)`.
- On error it logs, and when this is the final attempt (`job.attemptsMade >= (job.opts.attempts || 3) - 1`) it:
  - sets the session to `status: 'failed'` with the error message in `error`;
  - still calls `enqueueDistribute` so participants receive the raw transcript (the distribute worker notices there is no summary and uses the fallback template).
- The error is always re-thrown so BullMQ records the failure and retries (3 attempts, exponential backoff from `queue.ts`).
- A `failed` listener logs the job ID and message.

## Exports
- `startSummarizeWorker(): Worker` - start the worker and return it.

## Interfaces
- **Database:** `NoteSession` (collection `notesessions`) - write `status`/`error` on final failure; the summarizer reads `NoteTranscript` and writes `NoteSummary` and `NoteSession`.
- **Background work:** consumes `notetaker-summarize`; produces `notetaker-distribute` jobs.

## Dependencies
- **Internal:** `server/note-taker/jobs/queue.ts` - `redisConnection`, `enqueueDistribute`; `server/note-taker/summarization/summarizer.ts` - `generateAndSaveSummary`; `server/note-taker/models/note-session.model.ts` - failure status update.
- **Packages:** `bullmq` - `Worker`, `Job`; `mongoose` - `Types.ObjectId`.

## Used by
`server/index.ts` (`scheduleBackgroundJobs()` dynamically imports it and calls `startSummarizeWorker()` alongside `startDistributeWorker()`).

## Notes
- If the session has `settings.enableSummary: false`, nothing here checks it; whether that setting is honoured depends on the producers.
- Because the distribute job ID is `distribute-<sessionId>`, a fallback enqueue after an earlier successful distribution for the same session may be deduplicated by BullMQ (see `queue.ts.md`).
