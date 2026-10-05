/**
 * User-facing support tickets — file a ticket, view your own list,
 * reply in the thread, upload attachments. Admin replies + status
 * updates come through `/garage-admin/tickets/*` (OTP-gated panel)
 * so this router intentionally has no admin-allowlist logic.
 */
import { Router, Request, Response } from "express";
import { Types } from "mongoose";

import { requireAuth } from "../middleware/auth";
import { Ticket } from "../models/ticket.model";
import { User } from "../models/user.model";
import {
  presignTicketUpload,
  TicketUploadValidationError,
} from "../services/ticketAttachments.service";
import { sanitiseAttachments, withViewUrls } from "../services/ticketHelpers";

const router = Router();

// Garage attaches `{ userId, orgId, role }` to `req.user` in
// requireAuth, but the global Express.Request augmentation declares
// the field differently — so we cast where we read it (same pattern
// the rest of the codebase uses, e.g. routes/dm.ts).
function readUser(req: Request): { userId: string; orgId?: string } {
  return (req as unknown as { user: { userId: string; orgId?: string } }).user;
}

// ── Public (unauthenticated) routes ─────────────────────────────────
// Power the "Can't sign in?" flow. Same shape as NC's so the mobile
// app can hit either backend.

router.post("/public", async (req: Request, res: Response) => {
  try {
    const { name, email, title, description, attachments } = req.body || {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res
        .status(400)
        .json({ error: "name, email, title and description are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email" });
    }
    const ticket = await Ticket.create({
      userId: null,
      orgId: null,
      isGuest: true,
      userEmail: email.trim().toLowerCase().slice(0, 200),
      userName: name.trim().slice(0, 120),
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      priority: "medium",
      attachments: sanitiseAttachments(attachments),
      lastActivityAt: new Date(),
      hasUnreadForUser: false,
      hasUnreadForAdmin: true,
    });
    // Fire-and-forget: AI routes it to the best-fit admin.
    void import("../services/ticketAutoAssign").then((m) =>
      m.autoAssignTicket(String(ticket._id)),
    );
    return res.status(201).json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[tickets/public POST]", err);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.post("/upload-url-public", async (req: Request, res: Response) => {
  try {
    const { mimeType, filename, sizeBytes } = req.body || {};
    const out = await presignTicketUpload({
      userId: "guest",
      mimeType: String(mimeType || ""),
      filename: typeof filename === "string" ? filename : undefined,
      sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined,
    });
    return res.json(out);
  } catch (err) {
    if (err instanceof TicketUploadValidationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[tickets/upload-url-public]", err);
    return res.status(500).json({ error: "Failed to presign upload" });
  }
});

// ── Authenticated routes ────────────────────────────────────────────

router.post("/upload-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const { mimeType, filename, sizeBytes } = req.body || {};
    const out = await presignTicketUpload({
      userId: readUser(req).userId,
      mimeType: String(mimeType || ""),
      filename: typeof filename === "string" ? filename : undefined,
      sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined,
    });
    return res.json(out);
  } catch (err) {
    if (err instanceof TicketUploadValidationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[tickets/upload-url]", err);
    return res.status(500).json({ error: "Failed to presign upload" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, priority, category, attachments } = req.body || {};
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({ error: "title and description are required" });
    }
    const user = await User.findById(readUser(req).userId).select("name email").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const ticket = await Ticket.create({
      userId: new Types.ObjectId(readUser(req).userId),
      orgId: readUser(req).orgId ? new Types.ObjectId(readUser(req).orgId) : null,
      isGuest: false,
      userEmail: (user.email || "").toLowerCase(),
      userName: user.name || user.email || "User",
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      priority:
        priority === "low" ||
        priority === "high" ||
        priority === "urgent" ||
        priority === "medium"
          ? priority
          : "medium",
      category:
        typeof category === "string" && category.trim()
          ? category.trim().slice(0, 60)
          : undefined,
      attachments: sanitiseAttachments(attachments),
      lastActivityAt: new Date(),
      hasUnreadForUser: false,
      hasUnreadForAdmin: true,
    });
    // Fire-and-forget: AI routes it to the best-fit admin.
    void import("../services/ticketAutoAssign").then((m) =>
      m.autoAssignTicket(String(ticket._id)),
    );
    return res.status(201).json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[tickets POST]", err);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.get("/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const tickets = await Ticket.find({
      userId: new Types.ObjectId(readUser(req).userId),
      // Chat-raised tickets are internal support cases — admin-only, never
      // shown to the member whose chat they came from.
      source: { $ne: "chat" },
    })
      .sort({ lastActivityAt: -1 })
      .limit(200)
      .lean();
    return res.json({
      tickets: await Promise.all(tickets.map((t) => withViewUrls(t))),
    });
  } catch (err) {
    console.error("[tickets/mine]", err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.userId?.toString() !== readUser(req).userId) {
      return res.status(403).json({ error: "Not authorised" });
    }
    // Chat-raised tickets are internal/admin-only — hide from the member too.
    if ((ticket as any).source === "chat") {
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (ticket.hasUnreadForUser) {
      ticket.hasUnreadForUser = false;
      await ticket.save();
    }
    return res.json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[tickets/:id GET]", err);
    return res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.post(
  "/:id/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid ticket id" });
      }
      const { body, attachments } = req.body || {};
      if (typeof body !== "string" || !body.trim()) {
        return res.status(400).json({ error: "body is required" });
      }
      const ticket = await Ticket.findById(id);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.userId?.toString() !== readUser(req).userId) {
        return res.status(403).json({ error: "Not authorised" });
      }
      const user = await User.findById(readUser(req).userId)
        .select("name email")
        .lean();
      const now = new Date();
      ticket.messages.push({
        _id: new Types.ObjectId(),
        authorRole: "user",
        authorId: new Types.ObjectId(readUser(req).userId),
        authorName: user?.name || user?.email || "User",
        body: body.trim().slice(0, 5000),
        attachments: sanitiseAttachments(attachments),
        createdAt: now,
      });
      ticket.lastActivityAt = now;
      ticket.hasUnreadForAdmin = true;
      if (ticket.status === "resolved" || ticket.status === "closed") {
        ticket.status = "in_progress";
      }
      await ticket.save();
      return res.status(201).json(await withViewUrls(ticket.toObject()));
    } catch (err) {
      console.error("[tickets/:id/messages POST]", err);
      return res.status(500).json({ error: "Failed to add message" });
    }
  },
);

export default router;
