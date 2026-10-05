import { Router, Request, Response } from "express";
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';

import { NoteSummary } from '../models/note-summary.model';
import { NoteSession } from '../models/note-session.model';
import { enqueueSummarize } from '../jobs/queue';

const router = Router();

/** GET /sessions/:id/summary */
router.get('/sessions/:id/summary', requireAuth, async (req: Request, res: Response) => {
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

    const summary = await NoteSummary.findOne({ sessionId: session._id });
    if (!summary) {
      res.status(404).json({ error: 'Summary not found' });
      return;
    }

    res.json({ summary });
  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /by-workshop/:workshopId/summary
 *
 * Convenience endpoint for the Recorded tab on my.garage.app: given a
 * workshop id, resolve the most recent NoteSession created when that
 * webinar went live (NoteSession.roomId is set to the workshop id by
 * webinarRoutes.ts /webinar/:workshopId/start) and return the summary +
 * processing status. Lets the frontend skip the "list sessions, find
 * the right one" round trip — every recorded webinar has at most one
 * canonical note-session per run.
 *
 * Returns 200 with { status, summary?, ... } so the modal can render a
 * `recording / transcribing / summarizing / failed / ready` banner
 * without separately polling the session document.
 */
router.get(
  '/by-workshop/:workshopId/summary',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { workshopId } = req.params;
      if (!workshopId || !Types.ObjectId.isValid(workshopId)) {
        res.status(400).json({ error: 'Invalid workshop ID' });
        return;
      }

      // Most recent session — re-running a webinar creates a new session,
      // and the host typically wants notes from the latest run.
      const session = await NoteSession.findOne({
        roomId: workshopId,
        orgId: (req as any).user.orgId,
      })
        .sort({ startedAt: -1 })
        .lean();

      if (!session) {
        res.status(404).json({
          status: 'not_found',
          message:
            'No note-taker session exists for this workshop. The bot likely was not in the room during the broadcast.',
        });
        return;
      }

      const summary = session.summaryId
        ? await NoteSummary.findById(session.summaryId).lean()
        : null;

      res.json({
        sessionId: String(session._id),
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
        summary,
        title: session.title,
      });
    } catch (err) {
      console.error('Error fetching by-workshop summary:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/** POST /sessions/:id/regenerate-summary */
router.post('/sessions/:id/regenerate-summary', requireAuth, async (req: Request, res: Response) => {
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

    if (!session.transcriptId) {
      res.status(400).json({ error: 'No transcript available for this session' });
      return;
    }

    // Delete old summary if exists
    if (session.summaryId) {
      await NoteSummary.findByIdAndDelete(session.summaryId);
    }

    // Update session status and enqueue
    session.status = 'summarizing';
    session.summaryId = undefined;
    await session.save();

    await enqueueSummarize(sessionId);

    res.json({ ok: true, message: 'Summary regeneration queued' });
  } catch (err) {
    console.error('Error regenerating summary:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
