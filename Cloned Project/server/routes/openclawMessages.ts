import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { OpenClawMessage } from "../models/openclawMessage.model";

const router = Router();

// GET /openclaw-messages?agentId=X[&limit=N][&before=<ISO-date>]
// Returns messages for this user+agent pair, newest first, with cursor
// pagination. The frontend renders them reversed (oldest at top).
//
// - `limit` (default 30): how many to return in this page.
// - `before` (ISO 8601 datetime): cursor — return messages older than
//   this timestamp. Omit for the initial (most recent) page.
//
// Response: { messages: [...], hasMore: boolean }
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId, before } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 200);
    if (!agentId) return res.status(400).json({ error: "agentId required" });

    const filter: Record<string, any> = {
      userId: req.user.userId,
      agentId,
    };
    if (before) {
      filter.createdAt = { $lt: new Date(before as string) };
    }

    // Fetch limit+1 to detect whether there's another page.
    const rows = await OpenClawMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .select("role content sessionId createdAt")
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Reverse so the frontend gets oldest-first within this page
    // (same order as before, just paginated).
    page.reverse();

    return res.json({ messages: page, hasMore });
  } catch (err) {
    console.error("[OpenClawMessages] GET error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /openclaw-messages
// Saves a batch of messages (user turn + assistant reply) for a session
// Body: { agentId, sessionId, messages: [{ role, content }] }
router.post("/", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId, sessionId, messages } = req.body;
    if (!agentId || !sessionId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "agentId, sessionId, and messages[] are required" });
    }

    const docs = messages.map((m: { role: string; content: string }) => ({
      userId: req.user.userId,
      agentId,
      sessionId,
      role: m.role,
      content: m.content,
    }));

    await OpenClawMessage.insertMany(docs);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[OpenClawMessages] POST error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /openclaw-messages?agentId=X
// Clear all history for this user+agent (e.g. reset conversation)
router.delete("/", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId } = req.query;
    if (!agentId) return res.status(400).json({ error: "agentId required" });

    await OpenClawMessage.deleteMany({ userId: req.user.userId, agentId });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[OpenClawMessages] DELETE error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
