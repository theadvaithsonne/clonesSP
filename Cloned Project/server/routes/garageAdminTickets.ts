/**
 * Garage-admin ticket endpoints — mirrors user-facing read/reply/status
 * but gated by the garage-admin JWT (`requireGarageAdminAuth`). Mounted
 * at `/garage-admin/tickets`.
 */
import { Router, Response } from "express";
import { Types } from "mongoose";

import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  type GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { Ticket, type TicketStatus } from "../models/ticket.model";
import { User } from "../models/user.model";
import { sanitiseAttachments, withViewUrls } from "../services/ticketHelpers";

const router = Router();

router.use(requireGarageAdminAuth);

/** GET /garage-admin/tickets?status=open — list all. */
router.get("/", async (req: GarageAdminRequest, res: Response) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (
      status === "open" ||
      status === "in_progress" ||
      status === "resolved" ||
      status === "closed"
    ) {
      filter.status = status;
    }
    // Header search (?q=) — case-insensitive match on the ticket's
    // searchable fields. userName/userEmail are denormalised onto the
    // ticket at creation, so no User join is needed. The query is escaped
    // so regex metacharacters in the search box are treated literally.
    const q = String(req.query.q ?? "").trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: re },
        { description: re },
        { userName: re },
        { userEmail: re },
      ];
    }
    // ?assignedTo=<adminId> | "me" | "unassigned" — powers the "my tickets"
    // view and the board's assignee filter.
    const assignedTo = String(req.query.assignedTo ?? "").trim();
    if (assignedTo === "unassigned") {
      filter.assignedToId = null;
    } else if (assignedTo === "me") {
      filter.assignedToId = req.garageAdmin?.id
        ? new Types.ObjectId(req.garageAdmin.id)
        : null;
    } else if (Types.ObjectId.isValid(assignedTo)) {
      filter.assignedToId = new Types.ObjectId(assignedTo);
    }
    const tickets = await Ticket.find(filter)
      .sort({ lastActivityAt: -1 })
      .limit(500)
      .lean();
    return res.json({
      tickets: await Promise.all(tickets.map((t) => withViewUrls(t))),
    });
  } catch (err) {
    console.error("[garage-admin/tickets GET]", err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * POST /garage-admin/tickets — raise a ticket by hand, outside any chat.
 *
 * For phone/email/walk-in issues an admin logs on a member's behalf. `forEmail`
 * is matched against Garage users: a hit links the ticket to that user (so it
 * shows in their own ticket list); a miss files it as a guest under the given
 * name. The AI then auto-assigns it, same as any other new ticket.
 */
router.post("/", async (req: GarageAdminRequest, res: Response) => {
  try {
    const {
      title,
      description,
      priority,
      category,
      forEmail,
      forName,
      attachments,
    } = req.body || {};
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    if (typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "description is required" });
    }
    const email = String(forEmail || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ error: "A valid email for the member is required" });
    }

    // Link to a real user when the email matches one; otherwise it's a guest.
    const user: any = await User.findOne({ email })
      .select("name email organizations")
      .lean();
    const orgId =
      user?.organizations?.[0]?.organization &&
      Types.ObjectId.isValid(String(user.organizations[0].organization))
        ? new Types.ObjectId(String(user.organizations[0].organization))
        : null;

    const validPriority = ["low", "medium", "high", "urgent"].includes(priority)
      ? priority
      : "medium";

    const ticket = await Ticket.create({
      userId: user?._id || null,
      orgId,
      isGuest: !user,
      userEmail: email,
      userName:
        (typeof forName === "string" && forName.trim()) ||
        user?.name ||
        email,
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      priority: validPriority,
      category:
        typeof category === "string" && category.trim()
          ? category.trim().slice(0, 60)
          : "General",
      source: "manual",
      attachments: sanitiseAttachments(attachments),
      lastActivityAt: new Date(),
      // The member didn't file this, so there's nothing "unread" for them; the
      // admin who raised it doesn't need to be pinged about their own ticket.
      hasUnreadForUser: false,
      hasUnreadForAdmin: false,
    });
    console.log(
      `[garage-admin/tickets POST] manual ticket ${ticket._id} for=${email} by=${req.garageAdmin?.email}`,
    );
    // Fire-and-forget: AI routes it to the best-fit admin (human can change).
    void import("../services/ticketAutoAssign").then((m) =>
      m.autoAssignTicket(String(ticket._id)),
    );
    return res.status(201).json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[garage-admin/tickets POST]", err);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

// ── Which Taskroom board support tasks go to ───────────────────────────────
// Declared before `/:id` so "support-board" is never read as a ticket id.

/** GET /garage-admin/tickets/support-board — the current destination board. */
router.get("/support-board", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const { getSupportBoardInfo } = await import("../services/supportTicketTaskroom");
    return res.json(await getSupportBoardInfo());
  } catch (err) {
    console.error("[garage-admin/tickets support-board GET]", err);
    return res.status(500).json({ error: "Failed to read the support board" });
  }
});

/** GET /garage-admin/tickets/support-board/options — boards that can be picked. */
router.get("/support-board/options", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const { listSupportBoardOptions } = await import("../services/supportTicketTaskroom");
    return res.json({ workspaces: await listSupportBoardOptions() });
  } catch (err: any) {
    console.error("[garage-admin/tickets support-board options]", err?.message || err);
    return res.status(502).json({ error: "Couldn't load Taskroom boards. Please try again." });
  }
});

/** PUT /garage-admin/tickets/support-board { workspaceId, roomId } — super admin only. */
router.put(
  "/support-board",
  requireGarageSuperAdmin,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { workspaceId, roomId } = req.body || {};
      if (typeof workspaceId !== "string" || !workspaceId.trim()) {
        return res.status(400).json({ error: "Pick a Taskroom workspace" });
      }
      if (typeof roomId !== "string" || !roomId.trim()) {
        return res.status(400).json({ error: "Pick a Taskroom board" });
      }
      const { setSupportBoard } = await import("../services/supportTicketTaskroom");
      const info = await setSupportBoard({
        workspaceId: workspaceId.trim(),
        roomId: roomId.trim(),
        selectedBy: req.garageAdmin?.email || "admin",
      });
      return res.json(info);
    } catch (err: any) {
      console.error("[garage-admin/tickets support-board PUT]", err?.message || err);
      return res.status(400).json({ error: err?.message || "Couldn't set the board" });
    }
  }
);

/** GET /garage-admin/tickets/:id — detail; clears admin-side unread. */
router.get("/:id", async (req: GarageAdminRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.hasUnreadForAdmin) {
      ticket.hasUnreadForAdmin = false;
      await ticket.save();
    }
    return res.json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[garage-admin/tickets GET id]", err);
    return res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

/** POST /garage-admin/tickets/:id/messages — admin reply. Bumps user
 *  unread + re-opens resolved/closed tickets. */
router.post("/:id/messages", async (req: GarageAdminRequest, res: Response) => {
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

    const now = new Date();
    ticket.messages.push({
      _id: new Types.ObjectId(),
      authorRole: "admin",
      // Garage admins live in a separate collection; we don't have a
      // User row, so we mint a synthetic ObjectId for the audit trail.
      authorId: new Types.ObjectId(),
      authorName: req.garageAdmin?.email || "Admin",
      body: body.trim().slice(0, 5000),
      attachments: sanitiseAttachments(attachments),
      createdAt: now,
    });
    ticket.lastActivityAt = now;
    ticket.hasUnreadForUser = true;
    if (ticket.status === "resolved" || ticket.status === "closed") {
      ticket.status = "in_progress";
    }
    await ticket.save();
    return res.status(201).json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[garage-admin/tickets POST messages]", err);
    return res.status(500).json({ error: "Failed to add message" });
  }
});

/** PATCH /garage-admin/tickets/:id — change status / priority / category. */
router.patch("/:id", async (req: GarageAdminRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    const { status, priority, category } = req.body || {};
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const allowedStatus: TicketStatus[] = [
      "open",
      "in_progress",
      "resolved",
      "closed",
    ];
    let changed = false;
    if (
      typeof status === "string" &&
      allowedStatus.includes(status as TicketStatus) &&
      ticket.status !== status
    ) {
      ticket.status = status as TicketStatus;
      changed = true;
      if (status === "resolved" || status === "closed") {
        ticket.hasUnreadForUser = true;
      }
    }
    if (
      typeof priority === "string" &&
      ["low", "medium", "high", "urgent"].includes(priority) &&
      ticket.priority !== priority
    ) {
      ticket.priority = priority as "low" | "medium" | "high" | "urgent";
      changed = true;
    }
    if (typeof category === "string") {
      const trimmed = category.trim().slice(0, 60);
      if (ticket.category !== trimmed) {
        ticket.category = trimmed || undefined;
        changed = true;
      }
    }
    if (changed) {
      ticket.lastActivityAt = new Date();
      await ticket.save();
    }
    return res.json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[garage-admin/tickets PATCH]", err);
    return res.status(500).json({ error: "Failed to update ticket" });
  }
});

/**
 * PATCH /garage-admin/tickets/:id/assign — assign to a garage admin by hand.
 *
 * `adminId` must be an active admin (the same roster the AI auto-assigns from,
 * minus the exclusion — a human may deliberately hand a ticket to anyone
 * active, including the super admin). Sets assignedBy "admin" so the UI can
 * show it was a human choice, overriding any earlier AI routing.
 */
router.patch("/:id/assign", async (req: GarageAdminRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { adminId } = req.body || {};
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    if (!Types.ObjectId.isValid(String(adminId || ""))) {
      return res.status(400).json({ error: "adminId is required" });
    }
    const { GarageAdminModel } = await import("../models/garageAdmin.model");
    const admin: any = await GarageAdminModel.findById(adminId)
      .select("name email isActive")
      .lean();
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    if (admin.isActive === false) {
      return res.status(400).json({ error: "That admin is deactivated" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.assignedToId = new Types.ObjectId(String(adminId));
    ticket.assignedToName = admin.name || admin.email || "Admin";
    ticket.assignedToEmail = admin.email || null;
    ticket.assignedBy = "admin";
    ticket.assignedAt = new Date();
    ticket.assignReason = `Assigned by ${req.garageAdmin?.email || "an admin"}`;
    ticket.lastActivityAt = new Date();
    await ticket.save();
    return res.json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[garage-admin/tickets PATCH assign]", err);
    return res.status(500).json({ error: "Failed to assign ticket" });
  }
});

/** PATCH /garage-admin/tickets/:id/unassign — clear the assignment. */
router.patch("/:id/unassign", async (req: GarageAdminRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    ticket.assignedToId = null;
    ticket.assignedToName = null;
    ticket.assignedToEmail = null;
    ticket.assignedBy = null;
    ticket.assignedAt = null;
    ticket.assignReason = null;
    await ticket.save();
    return res.json(await withViewUrls(ticket.toObject()));
  } catch (err) {
    console.error("[garage-admin/tickets PATCH unassign]", err);
    return res.status(500).json({ error: "Failed to unassign ticket" });
  }
});

export default router;
