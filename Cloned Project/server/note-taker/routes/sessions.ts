import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';

import { NoteSession } from '../models/note-session.model';
import { NoteTranscript } from '../models/note-transcript.model';
import { NoteSummary } from '../models/note-summary.model';
import { BotManager } from '../agents/bot-manager';
import { enqueueDistribute } from '../jobs/queue';
import { Types } from 'mongoose';

const router = Router();

/** POST /sessions/join — manually trigger bot to join a room */
router.post('/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      res.status(400).json({ error: 'roomName is required' });
      return;
    }

    const botManager = BotManager.getInstance();
    if (botManager.hasBot(roomName)) {
      res.status(409).json({ error: 'Bot already in this room' });
      return;
    }

    const orgId = new Types.ObjectId((req as any).user.orgId);
    const language = 'en';

    // Create NoteSession first so we have an ID for the transcription manager
    const roomId = roomName.replace(/^(meet|office-room|call)-/, '');
    const noteSession = await NoteSession.create({
      roomName,
      roomId,
      orgId,
      botIdentity: 'notetaker-bot',
      botJoinedAt: new Date(),
      startedAt: new Date(),
      participants: [],
      status: 'recording',
      settings: {
        autoJoin: false,
        language,
        enableSummary: true,
        enableEmailDistribution: true,
      },
    });

    const session = await botManager.join({
      webinarId: roomName,
      sessionId: noteSession._id as Types.ObjectId,
      language,
    });

    res.status(201).json({
      sessionId: noteSession._id,
      roomName,
      botIdentity: session.botIdentity,
      status: 'recording',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Sessions] Join error:', message);
    res.status(500).json({ error: message });
  }
});

/** POST /sessions/leave — remove bot from a room */
router.post('/leave', requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      res.status(400).json({ error: 'roomName is required' });
      return;
    }

    const botManager = BotManager.getInstance();
    if (!botManager.hasBot(roomName)) {
      res.status(404).json({ error: 'No bot in this room' });
      return;
    }

    await botManager.leave(roomName);

    // Update NoteSession
    const noteSession = await NoteSession.findOne({
      roomName,
      status: 'recording',
    }).sort({ startedAt: -1 });

    if (noteSession) {
      const now = new Date();
      noteSession.botLeftAt = now;
      noteSession.endedAt = now;
      noteSession.durationSeconds = Math.round(
        (now.getTime() - noteSession.startedAt.getTime()) / 1000,
      );
      noteSession.status = 'transcribing';
      await noteSession.save();
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Sessions] Leave error:', message);
    res.status(500).json({ error: message });
  }
});

/** GET /sessions — list sessions for user's org (paginated) */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = new Types.ObjectId((req as any).user.orgId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = { orgId };
    if (status) filter.status = status;
    const roomName = req.query.roomName as string | undefined;
    if (roomName) filter.roomName = roomName;
    // Scope by surface (e.g. ?source=conference for conference-only notes).
    const source = req.query.source as string | undefined;
    if (source) filter.source = source;

    const [sessions, total] = await Promise.all([
      NoteSession.find(filter)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NoteSession.countDocuments(filter),
    ]);

    res.json({
      sessions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Sessions] List error:', message);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/** GET /sessions/:id — get a single session */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await NoteSession.findOne({
      _id: req.params.id,
      orgId: new Types.ObjectId((req as any).user.orgId),
    }).lean();

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/** DELETE /sessions/:id — delete a session and associated data */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await NoteSession.findOneAndDelete({
      _id: req.params.id,
      orgId: new Types.ObjectId((req as any).user.orgId),
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Clean up associated data
    if (session.transcriptId) {
      await NoteTranscript.findByIdAndDelete(session.transcriptId);
    }
    if (session.summaryId) {
      await NoteSummary.findByIdAndDelete(session.summaryId);
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/** POST /sessions/:id/send — send/resend email to participants */
router.post('/:id/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await NoteSession.findOne({
      _id: req.params.id,
      orgId: new Types.ObjectId((req as any).user.orgId),
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'ready') {
      res.status(400).json({ error: 'Session is not ready for distribution' });
      return;
    }

    await enqueueDistribute((session._id as Types.ObjectId).toString());
    res.json({ ok: true, message: 'Distribution queued' });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to queue distribution' });
  }
});

export default router;
