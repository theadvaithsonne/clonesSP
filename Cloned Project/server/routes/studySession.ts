// src/routes/studySession.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import * as studySessionService from "../services/studySession";

const router = Router();

/**
 * POST /study-sessions/start
 * Start a new study session (auto-closes any existing active session)
 */
router.post("/start", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    if (!me) return res.status(401).json({ error: "Not authenticated" });

    const orgId = (req.query.orgId as string) || me.orgId;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const { courseId, chapterId, sectionId, courseTitle, chapterTitle } = req.body;
    if (!courseId) return res.status(400).json({ error: "courseId is required" });

    const session = await studySessionService.startSession({
      userId: me.userId,
      organizationId: orgId,
      courseId,
      chapterId,
      sectionId,
      courseTitle: courseTitle || "",
      chapterTitle: chapterTitle || "",
    });

    return res.status(201).json(session);
  } catch (error: any) {
    console.error("Error starting study session:", error);
    return res.status(500).json({ error: error.message || "Failed to start session" });
  }
});

/**
 * POST /study-sessions/end
 * End the current active study session
 */
router.post("/end", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    if (!me) return res.status(401).json({ error: "Not authenticated" });

    const orgId = (req.query.orgId as string) || me.orgId;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const { sessionId } = req.body;

    const session = await studySessionService.endSession(me.userId, orgId, sessionId);

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    return res.json(session);
  } catch (error: any) {
    console.error("Error ending study session:", error);
    return res.status(500).json({ error: error.message || "Failed to end session" });
  }
});

/**
 * PATCH /study-sessions/heartbeat
 * Keep the session alive + optionally update current chapter
 */
router.patch("/heartbeat", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    if (!me) return res.status(401).json({ error: "Not authenticated" });

    const orgId = (req.query.orgId as string) || me.orgId;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const { chapterId, sectionId, chapterTitle } = req.body;

    const session = await studySessionService.heartbeat(me.userId, orgId, {
      chapterId,
      sectionId,
      chapterTitle,
    });

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    return res.json({ ok: true, sessionId: session._id });
  } catch (error: any) {
    console.error("Error sending heartbeat:", error);
    return res.status(500).json({ error: error.message || "Failed to send heartbeat" });
  }
});

/**
 * GET /study-sessions/stats
 * Get dashboard stats (weekly time, streak, recent, active session)
 */
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    if (!me) return res.status(401).json({ error: "Not authenticated" });

    const orgId = (req.query.orgId as string) || me.orgId;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const stats = await studySessionService.getStudyStats(me.userId, orgId);

    return res.json(stats);
  } catch (error: any) {
    console.error("Error getting study stats:", error);
    return res.status(500).json({ error: error.message || "Failed to get stats" });
  }
});

export default router;
