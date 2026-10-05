import { Router, Request, Response } from "express";
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';

import { NoteTranscript, INoteTranscript } from '../models/note-transcript.model';
import { NoteSession } from '../models/note-session.model';

const router = Router();

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toTxt(transcript: INoteTranscript): string {
  return transcript.segments
    .map((seg) => {
      const timestamp = formatTime(seg.startTime);
      const speaker = seg.speakerName || seg.speaker;
      return `[${timestamp}] ${speaker}: ${seg.text}`;
    })
    .join('\n');
}

function toSrt(transcript: INoteTranscript): string {
  return transcript.segments
    .map((seg, i) => {
      const startMs = Math.round((seg.startTime % 1) * 1000);
      const endMs = Math.round((seg.endTime % 1) * 1000);
      const start = `${formatTime(seg.startTime)},${String(startMs).padStart(3, '0')}`;
      const end = `${formatTime(seg.endTime)},${String(endMs).padStart(3, '0')}`;
      const speaker = seg.speakerName || seg.speaker;
      return `${i + 1}\n${start} --> ${end}\n${speaker}: ${seg.text}`;
    })
    .join('\n\n');
}

function toVtt(transcript: INoteTranscript): string {
  const cues = transcript.segments
    .map((seg) => {
      const startMs = Math.round((seg.startTime % 1) * 1000);
      const endMs = Math.round((seg.endTime % 1) * 1000);
      const start = `${formatTime(seg.startTime)}.${String(startMs).padStart(3, '0')}`;
      const end = `${formatTime(seg.endTime)}.${String(endMs).padStart(3, '0')}`;
      const speaker = seg.speakerName || seg.speaker;
      return `${start} --> ${end}\n${speaker}: ${seg.text}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${cues}`;
}

/** GET /sessions/:id/transcript */
router.get('/sessions/:id/transcript', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    if (!Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    const session = await NoteSession.findOne({ _id: sessionId, orgId: (req as any).user.orgId });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const transcript = await NoteTranscript.findOne({ sessionId: session._id });
    if (!transcript) {
      res.status(404).json({ error: 'Transcript not found' });
      return;
    }

    res.json({ transcript });
  } catch (err) {
    console.error('Error fetching transcript:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /sessions/:id/transcript/download?format=txt|srt|vtt */
router.get('/sessions/:id/transcript/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const format = (req.query.format as string) || 'txt';

    if (!Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    if (!['txt', 'srt', 'vtt'].includes(format)) {
      res.status(400).json({ error: 'Invalid format. Supported: txt, srt, vtt' });
      return;
    }

    const session = await NoteSession.findOne({ _id: sessionId, orgId: (req as any).user.orgId });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const transcript = await NoteTranscript.findOne({ sessionId: session._id });
    if (!transcript) {
      res.status(404).json({ error: 'Transcript not found' });
      return;
    }

    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case 'srt':
        content = toSrt(transcript);
        contentType = 'application/x-subrip';
        extension = 'srt';
        break;
      case 'vtt':
        content = toVtt(transcript);
        contentType = 'text/vtt';
        extension = 'vtt';
        break;
      default:
        content = toTxt(transcript);
        contentType = 'text/plain';
        extension = 'txt';
        break;
    }

    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${sessionId}.${extension}"`);
    res.send(content);
  } catch (err) {
    console.error('Error downloading transcript:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /search?q=<query> — full-text search across transcripts */
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query?.trim()) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const orgId = (req as any).user.orgId;
    const sessions = await NoteSession.find({ orgId }).select('_id').lean();
    const sessionIds = sessions.map((s) => s._id);

    if (sessionIds.length === 0) {
      res.json({ results: [] });
      return;
    }

    const transcripts = await NoteTranscript.find(
      {
        sessionId: { $in: sessionIds },
        $text: { $search: query },
      },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .lean();

    const results = transcripts.map((t) => ({
      sessionId: t.sessionId,
      language: t.language,
      wordCount: t.wordCount,
      speakerCount: t.speakerCount,
      snippet: t.fullText.substring(0, 300),
      score: (t as any).score,
    }));

    res.json({ results });
  } catch (err) {
    console.error('Error searching transcripts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
