import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforceLeaveRequest,
  LEAVE_TYPES,
  type ApproverScope,
} from "../../models/teamforce/teamforceLeaveRequest.model";
import { TeamforceEmployeeProfile } from "../../models/teamforce/teamforceEmployeeProfile.model";
import { User } from "../../models/user.model";
import {
  getAuthUser,
  getOrgIdStrict,
  hasFullAccess,
} from "./_helpers";

/** Check if user is a manager */
async function isManager(
  userId: string,
  orgId: string
): Promise<boolean> {
  const profile = await TeamforceEmployeeProfile.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
  })
    .select("managesTeam")
    .lean();
  return !!profile?.managesTeam;
}

/** Decide where a newly-submitted leave should be routed.
 *  Founder → founder_only. Everyone else → admin_or_founder.
 *  See APPROVER_SCOPES on the model for definitions. */
function computeLeaveRouting(jwtRole: string): { scope: ApproverScope } {
  if (jwtRole === "founder") return { scope: "founder_only" };
  return { scope: "admin_or_founder" };
}

const router = Router();

const createSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isHalfDay: z.boolean().optional(),
  reason: z.string().min(1).max(2000).trim(),
  attachmentUrl: z.string().trim().optional(),
});

// Create leave request (employee self-submit)
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const body = createSchema.parse(req.body);
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "Invalid start or end date" });
  }
  if (end < start) {
    return res.status(400).json({ error: "End date cannot be before start date" });
  }
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  if (start < todayMidnight) {
    return res.status(400).json({ error: "Leave cannot be applied for past dates. Please select today or a future date." });
  }

  const routing = computeLeaveRouting(me.role);

  const leave = await TeamforceLeaveRequest.create({
    userId: new Types.ObjectId(me.userId),
    orgId: new Types.ObjectId(orgId),
    leaveType: body.leaveType,
    startDate: start,
    endDate: end,
    isHalfDay: !!body.isHalfDay,
    reason: body.reason,
    attachmentUrl: body.attachmentUrl,
    status: "Pending",
    approverScope: routing.scope,
  });

  res.status(201).json({ leave });
});

// My leave requests
router.get("/mine", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const leaves = await TeamforceLeaveRequest.find({
    userId: new Types.ObjectId(me.userId),
    orgId: new Types.ObjectId(orgId),
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ leaves });
});

// Org-wide leave queue for admin / founder. Returns only leaves the
// caller is allowed to decide:
//   - admin: scope=admin_or_founder, leaves assigned to me, legacy (no scope)
//   - founder: same + scope=founder_only
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const allowed = await hasFullAccess(req);
  if (!allowed) {
    return res
      .status(403)
      .json({ error: "Requires founder or Teamforce Admin role" });
  }

  const isFounderUser = me.role === "founder";
  const meId = new Types.ObjectId(me.userId);

  const visibility: any[] = [
    { approverScope: "admin_or_founder" },
    { approverScope: { $exists: false } },
    { approverScope: null },
    { assignedApproverUserId: meId },
  ];
  if (isFounderUser) visibility.push({ approverScope: "founder_only" });

  const query: any = {
    orgId: new Types.ObjectId(orgId),
    $or: visibility,
  };
  const statusParam = (req.query.status as string | undefined)?.trim();
  if (statusParam) query.status = statusParam;

  const leaves = await TeamforceLeaveRequest.find(query)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ leaves });
});

// Manager queue. Under the new routing, members' leaves go to admin/
// founder, not to the member's reporting manager — so a manager only
// sees leaves explicitly assigned to them (typically admins who picked
// this manager as their reporting manager).
router.get("/team", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const mgr = await isManager(me.userId, orgId);
  if (!mgr) {
    return res.status(403).json({ error: "Manager access required" });
  }

  const statusParam = (req.query.status as string | undefined)?.trim();
  const query: any = {
    orgId: new Types.ObjectId(orgId),
    assignedApproverUserId: new Types.ObjectId(me.userId),
  };
  if (statusParam) query.status = statusParam;

  const leaves = await TeamforceLeaveRequest.find(query)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ leaves });
});

async function decide(
  req: any,
  res: any,
  nextStatus: "Approved" | "Rejected"
) {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const leaveDoc = await TeamforceLeaveRequest.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
    status: "Pending",
  })
    .select("approverScope assignedApproverUserId userId endDate")
    .lean();

  if (!leaveDoc) {
    return res
      .status(404)
      .json({ error: "Leave request not found or not pending" });
  }

  const isAssigned =
    !!leaveDoc.assignedApproverUserId &&
    leaveDoc.assignedApproverUserId.toString() === me.userId;
  const isFounderUser = me.role === "founder";
  const isFullAccess = await hasFullAccess(req); // founder or teamforce admin

  let allowed = false;
  if (isAssigned) {
    allowed = true;
  } else if (!leaveDoc.approverScope) {
    // Legacy rows (predate routing) — admin/founder may decide.
    allowed = isFullAccess;
  } else if (leaveDoc.approverScope === "admin_or_founder") {
    allowed = isFullAccess;
  } else if (leaveDoc.approverScope === "founder_only") {
    allowed = isFounderUser;
  } else if (leaveDoc.approverScope === "user") {
    // Strict — only the assigned approver may decide.
    allowed = false;
  }

  if (!allowed) {
    return res
      .status(403)
      .json({ error: "Not authorized to decide this leave request" });
  }

  // Block approval of leaves whose entire period has already elapsed
  if (nextStatus === "Approved") {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const endDate = (leaveDoc as any).endDate;
    if (endDate && new Date(endDate) < todayMidnight) {
      return res.status(400).json({
        error: "Cannot approve leave: the leave period has already passed.",
      });
    }
  }

  const approver = await User.findById(me.userId).select("name").lean();

  const leave = await TeamforceLeaveRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
      status: "Pending",
    },
    {
      $set: {
        status: nextStatus,
        approverUserId: new Types.ObjectId(me.userId),
        approverName: approver?.name || "Manager",
        decisionNote: (req.body?.note as string | undefined)?.trim(),
        decidedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  if (!leave) {
    return res
      .status(404)
      .json({ error: "Leave request not found or not pending" });
  }
  res.json({ leave });
}

router.post("/:id/approve", requireAuth, (req, res) =>
  decide(req, res, "Approved")
);
router.post("/:id/reject", requireAuth, (req, res) =>
  decide(req, res, "Rejected")
);

// Employee cancels their own pending request
router.post("/:id/cancel", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const leave = await TeamforceLeaveRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      userId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId),
      status: "Pending",
    },
    { $set: { status: "Cancelled", decidedAt: new Date() } },
    { new: true }
  ).lean();

  if (!leave) {
    return res
      .status(404)
      .json({ error: "Leave request not found or already processed" });
  }
  res.json({ leave });
});

export default router;
