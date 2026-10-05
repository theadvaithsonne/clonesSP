import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { redisConnection } from './queue';
import { NoteSession } from '../models/note-session.model';
import { NoteSummary } from '../models/note-summary.model';
import { NoteTranscript } from '../models/note-transcript.model';
import { resolveParticipantEmails } from '../distribution/participant-resolver';
import { buildSummaryEmail, buildTranscriptFallbackEmail } from '../distribution/email-template';
import { sendEmail } from '../distribution/email-sender';

export function startDistributeWorker(): Worker {
  const worker = new Worker(
    'notetaker-distribute',
    async (job: Job) => {
      const { sessionId } = job.data;
      console.log(`[DistributeWorker] Processing session: ${sessionId}`);

      const session = await NoteSession.findById(sessionId);
      if (!session) {
        console.warn(`[DistributeWorker] Session not found: ${sessionId}`);
        return;
      }

      if (!session.settings.enableEmailDistribution) {
        console.log(`[DistributeWorker] Email distribution disabled for session: ${sessionId}`);
        return;
      }

      // Prefer summary; fall back to transcript when summarization failed
      // (e.g. LLM rate-limited). Recipients still get something usable.
      const summary = await NoteSummary.findOne({ sessionId: new Types.ObjectId(sessionId) });
      let transcript = null;
      if (!summary) {
        transcript = await NoteTranscript.findOne({ sessionId: new Types.ObjectId(sessionId) });
        if (!transcript) {
          console.warn(`[DistributeWorker] Neither summary nor transcript found for session: ${sessionId}`);
          return;
        }
        console.log(`[DistributeWorker] No summary for ${sessionId}, sending transcript fallback`);
      }

      // Resolve participant emails (pass roomName for MeetSession.createdBy fallback)
      const resolved = await resolveParticipantEmails(session.participants, session.roomName);
      const emailRecipients = resolved
        .filter((p) => p.email !== null)
        .map((p) => p.email as string);

      if (emailRecipients.length === 0) {
        console.log(`[DistributeWorker] No email recipients for session: ${sessionId}`);
        return;
      }

      // Build email
      const meetingTitle = session.title || `Meeting ${session.roomId}`;
      const meetingDate = session.startedAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const durationMinutes = Math.round((session.durationSeconds || 0) / 60);
      const participantNames = resolved.map((p) => p.name);

      const html = summary
        ? buildSummaryEmail(
            summary,
            sessionId,
            meetingTitle,
            meetingDate,
            durationMinutes,
            participantNames,
          )
        : buildTranscriptFallbackEmail(
            transcript!,
            sessionId,
            meetingTitle,
            meetingDate,
            durationMinutes,
            participantNames,
          );

      const subjectPrefix = summary ? 'Meeting Notes' : 'Meeting Transcript';

      // Send email
      const sent = await sendEmail({
        to: emailRecipients,
        subject: `${subjectPrefix}: ${meetingTitle}`,
        html,
      });

      // Update session
      session.emailsSentAt = new Date();
      session.emailRecipients = sent;
      await session.save();

      console.log(`[DistributeWorker] Distributed to ${sent.length} recipients for session: ${sessionId}`);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(`[DistributeWorker] Job ${job?.id} failed:`, error.message);
  });

  console.log('[DistributeWorker] Started');
  return worker;
}
