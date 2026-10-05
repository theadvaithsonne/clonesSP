# `server/note-taker/jobs/queue.ts`

> Defines the shared Redis connection and the two BullMQ queues (`notetaker-summarize`, `notetaker-distribute`) that drive the Note-Taker post-meeting pipeline, plus helpers to enqueue a job for a session.

**Kind:** Note-Taker module — BullMQ job/worker · **Lines:** 47

## Purpose
After the note-taker bot has transcribed a meeting or webinar, two slow steps follow: an LLM summary and an email to participants. Both run out of the request path as BullMQ jobs. This file is the single place where the Redis connection and the queues are created, so every producer (routes, realtime handlers, the transcript builder) and both workers share them.

## How it works
- `redisConnection` is an `ioredis` client built from `env.REDIS_URL` (default in `server/config/env.ts` is `redis://localhost:6379/3`). `maxRetriesPerRequest: null` is required by BullMQ for blocking commands.
- Both queues use the same default job options: 3 attempts, exponential backoff starting at 5 s, keep the last 100 completed and last 50 failed jobs.
- `enqueueSummarize(sessionId)` adds a `summarize` job with payload `{ sessionId }` and a deterministic `jobId` of `summarize-<sessionId>`.
- `enqueueDistribute(sessionId)` adds a `distribute` job with `{ sessionId }` and `jobId` `distribute-<sessionId>`.

The pipeline is: transcript saved -> `enqueueSummarize` -> `summarize.worker.ts` -> `enqueueDistribute` -> `distribute.worker.ts`.

## Exports
- `redisConnection` - shared `IORedis` instance; the workers pass it as their `connection`.
- `summarizeQueue` - BullMQ `Queue` named `notetaker-summarize`.
- `distributeQueue` - BullMQ `Queue` named `notetaker-distribute`.
- `enqueueSummarize(sessionId: string): Promise<void>` - queue an LLM summary for a `NoteSession`.
- `enqueueDistribute(sessionId: string): Promise<void>` - queue the summary/transcript email for a `NoteSession`.

## Interfaces
- **Environment variables:** `REDIS_URL` (via `env`) - Redis used by BullMQ.
- **Background work:** creates the `notetaker-summarize` and `notetaker-distribute` queues; the matching workers live in `summarize.worker.ts` and `distribute.worker.ts`.

## Dependencies
- **Internal:** `server/config/env.ts` - `REDIS_URL`.
- **Packages:** `bullmq` - `Queue`; `ioredis` - Redis client. (`Worker` is imported but unused here.)

## Used by
`server/note-taker/jobs/distribute.worker.ts`, `server/note-taker/jobs/summarize.worker.ts`, `server/note-taker/routes/sessions.ts` (manual resend), `server/note-taker/routes/summaries.ts` (regenerate), `server/note-taker/transcription/transcript-builder.ts` (after saving a transcript), `server/realtime/mediasoupHandlers.ts`, `server/realtime/socket.ts` (conference) and `server/routes/webinarRoutes.ts` (webinar end).

## Notes
- The Redis connection opens as soon as this module is imported, so any file that imports it (even only for `enqueueSummarize`) needs Redis reachable.
- Deterministic job IDs deduplicate: BullMQ ignores `add()` when a job with the same ID still exists in the queue, and completed jobs are retained (last 100). A second `enqueueSummarize`/`enqueueDistribute` for the same session can therefore be silently dropped while the previous job is still retained - this affects the "regenerate summary" and "resend email" endpoints, and the summarize worker's fallback distribution if a distribute job for that session already exists.
