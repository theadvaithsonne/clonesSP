import { Router, Request, Response } from "express";
import { OpenClawMessage } from "../models/openclawMessage.model";
import { getSocketInstance } from "../services/socket";

const router = Router();

// POST /internal/chat/message
// Called by cronWebhook (and optionally the Next.js proxy) to inject an agent message
// into a user's OpenClaw chat session.
router.post("/message", async (req: Request, res: Response) => {
  try {
    // Validate internal API key
    const auth = req.headers["authorization"] ?? "";
    const expected = process.env.GARAGE_INTERNAL_API_KEY;
    if (!expected || auth !== `Bearer ${expected}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId, sessionId, agentId, message } = req.body;
    if (!userId || !agentId || !message) {
      return res.status(400).json({ error: "userId, agentId, and message are required" });
    }

    // Save to OpenClawMessage as an assistant message
    const doc = await OpenClawMessage.create({
      userId,
      agentId,
      sessionId: sessionId || `system_${Date.now()}`,
      role: "assistant",
      content: message,
    });

    // Emit real-time socket event so the chat UI updates instantly
    const io = getSocketInstance();
    if (io) {
      io.to(`user:${userId}`).emit("openclaw:new-message", {
        userId,
        agentId,
        sessionId: doc.sessionId,
        role: "assistant",
        content: message,
        createdAt: doc.createdAt,
        _id: doc._id,
      });
    }

    console.info("[internalChat] Injected message", { userId, agentId, sessionId });
    return res.status(200).json({ ok: true, messageId: doc._id });
  } catch (err: any) {
    console.error("[internalChat] Error", err?.stack || err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
