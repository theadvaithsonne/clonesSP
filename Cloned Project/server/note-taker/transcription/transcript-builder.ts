import { NoteTranscript } from '../models/note-transcript.model';
import { NoteSession } from '../models/note-session.model';
import { SegmentAccumulator } from './segment-accumulator';
import { enqueueSummarize } from '../jobs/queue';
import { Types } from 'mongoose';

/**
 * Build and save a finalized NoteTranscript document from accumulated segments.
 */
export async function buildAndSaveTranscript(
  sessionId: Types.ObjectId,
  accumulator: SegmentAccumulator,
  language = 'en',
): Promise<Types.ObjectId> {
  const segments = accumulator.getSegments();
  const fullText = accumulator.getFullText();

  const transcript = await NoteTranscript.create({
    sessionId,
    fullText,
    segments,
    language,
    wordCount: accumulator.getWordCount(),
    speakerCount: accumulator.getSpeakerCount(),
    sttProvider: 'deepgram',
  });

  // Update NoteSession with the transcript reference
  await NoteSession.findByIdAndUpdate(sessionId, {
    transcriptId: transcript._id,
    status: 'summarizing',
  });

  console.log(
    `[TranscriptBuilder] Saved transcript for session ${sessionId}: ${segments.length} segments, ${accumulator.getWordCount()} words`,
  );

  // Enqueue summarization job
  await enqueueSummarize(sessionId.toString());

  return transcript._id as Types.ObjectId;
}
