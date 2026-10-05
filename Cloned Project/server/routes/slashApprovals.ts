import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { Approval } from "../models/approval.model";
import { getSocketInstance } from "../services/socket";

// Slash-command Approval routes. Three endpoints only:
//   POST  /                 create the request
//   POST  /:id/decide       approve or reject
//   GET   /:id              fallback for late-loading clients
//
// Cards render from the inline marker on send and update in-place on the
// socket events emitted by /decide. There is no polling and no per-card GET
// on mount.
const router = Router();

const DECISIONS = ["approved", "rejected"] as const;

// POST /slash/approvals — create approval + emit one notification per approver
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const body = z
    .object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      approverIds: z.array(z.string()).min(1).max(20),
      deadline: z.string().nullable().optional(),
      approvalType: z.enum(["parallel", "sequential"]).optional(),
    })
    .parse(req.body);

  // De-dupe + exclude the requester from their own approver list.
  const uniqueApprovers = Array.from(new Set(body.approverIds)).filter(
    (id) => id !== me.userId
  );
  if (uniqueApprovers.length === 0) {
    return res.status(400).json({ error: "Need at least one other approver" });
  }

  const approval = await Approval.create({
    orgId: new Types.ObjectId(me.orgId),
    requesterId: new Types.ObjectId(me.userId),
    title: body.title,
    description: body.description,
    deadline: body.deadline ? new Date(body.deadline) : undefined,
    approvalType: body.approvalType || "parallel",
    approvers: uniqueApprovers.map((id) => ({
      userId: new Types.ObjectId(id),
      status: "pending",
    })),
  });

  // Personal notification per approver so they see the request even if
  // their chat tab isn't open on the relevant message.
  const io = getSocketInstance();
  if (io) {
    for (const approverId of uniqueApprovers) {
      io.to(`user:${approverId}`).emit("slash:approval-created", {
        approvalId: String(approval._id),
        title: approval.title,
        requesterId: me.userId,
      });
    }
  }

  res.status(201).json({ approval });
});

// POST /slash/approvals/:id/decide
router.post("/:id/decide", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const { decision, comment } = z
    .object({
      decision: z.enum(DECISIONS),
      comment: z.string().max(500).optional(),
    })
    .parse(req.body);

  const approval = await Approval.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(me.orgId),
  });
  if (!approval) return res.status(404).json({ error: "Approval not found" });

  const approver = approval.approvers.find(
    (a) => String(a.userId) === me.userId
  );
  if (!approver) return res.status(403).json({ error: "Not an approver" });
  if (approver.status !== "pending") {
    return res.status(409).json({ error: "Already decided" });
  }

  approver.status = decision;
  approver.decidedAt = new Date();
  if (comment) approver.comment = comment;

  // Recompute overall status. Parallel: any reject => rejected, all approved
  // => approved, else pending. Sequential isn't implemented yet — falls back
  // to parallel rules so the model stays consistent.
  if (approval.approvers.some((a) => a.status === "rejected")) {
    approval.overallStatus = "rejected";
  } else if (approval.approvers.every((a) => a.status === "approved")) {
    approval.overallStatus = "approved";
  } else {
    approval.overallStatus = "pending";
  }

  await approval.save();

  // One org-scoped broadcast updates every open card. Plus a direct
  // notification to the requester so they get pinged even if not looking.
  const io = getSocketInstance();
  if (io) {
    const payload = {
      approvalId: String(approval._id),
      userId: me.userId,
      decision,
      overallStatus: approval.overallStatus,
    };
    io.to(`org:${me.orgId}`).emit("slash:approval-decided", payload);
    io.to(`user:${String(approval.requesterId)}`).emit(
      "slash:approval-decided",
      payload
    );
  }

  res.json({
    approvalId: String(approval._id),
    decision,
    overallStatus: approval.overallStatus,
  });
});

// GET /slash/approvals/:id — fallback for late-loading clients
router.get("/:id", requireAuth, async (req, res) => {
  const me = (req as any).user as { orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const approval = await Approval.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(me.orgId),
  })
    .select("title overallStatus approvers requesterId")
    .lean();

  if (!approval) return res.status(404).json({ error: "Approval not found" });

  res.json({
    approval: {
      _id: String(approval._id),
      title: approval.title,
      overallStatus: approval.overallStatus,
      requesterId: String(approval.requesterId),
      approvers: approval.approvers.map((a) => ({
        userId: String(a.userId),
        status: a.status,
        decidedAt: a.decidedAt,
      })),
    },
  });
});

export default router;
