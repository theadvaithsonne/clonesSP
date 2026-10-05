// src/routes/joinRequests.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { JoinRequest } from "../models/joinRequest.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Invite } from "../models/invite.model";
import { createOtp } from "../services/otp";
import {
  sendMail,
  guestApprovalEmailTemplate,
  guestRejectionEmailTemplate,
  EMAIL_FROM_NOTIFICATION,
  senderForOrg,
} from "../services/mailer";
import { Types } from "mongoose";
import { getActiveOfficeSubscription } from "../services/officeSubscription";
import { IOfficePlan } from "../models/officePlan.model";

const router = Router();

// Guest limit for Basic plan (₹799) - hardcoded for now
const GUEST_LIMIT = 25;

/**
 * Check if organization is on Basic plan
 * Returns true if on Basic plan, false otherwise (Pro, no subscription, or parent org)
 */
async function isOnBasicPlan(orgId: string): Promise<boolean> {
  // Check if organization is a parent (GARAGE HQ) - no limit applies
  const org = await Organization.findById(orgId).select("parent").lean();
  if (org?.parent === true) {
    return false;
  }

  // Get active subscription
  const subscription = await getActiveOfficeSubscription(orgId);
  if (!subscription) {
    // No subscription means no limit (they haven't paid yet, or trial)
    return false;
  }

  const plan = subscription.planId as unknown as IOfficePlan;
  return plan?.slug === "basic";
}

/**
 * Check if organization has reached guest limit
 * Only applies to Basic plan subscribers
 */
async function isGuestLimitReached(orgId: string): Promise<boolean> {
  // Only check limit for Basic plan subscribers
  const onBasicPlan = await isOnBasicPlan(orgId);
  if (!onBasicPlan) {
    return false; // Pro plan or no subscription = unlimited guests
  }

  const count = await User.countDocuments({
    "organizations.organization": new Types.ObjectId(orgId),
    "organizations.guest": true,
  });
  return count >= GUEST_LIMIT;
}

/**
 * Middleware to check if user is a founder of the organization
 */
async function requireFounder(req: any, res: any, next: any) {
  try {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is a founder (or has fullAccess) of this organization
    const membership = user.organizations?.find(
      (m: any) =>
        m.organization.toString() === orgId && hasFounderAccess(m)
    );

    if (!membership) {
      return res
        .status(403)
        .json({ error: "Only founders can manage join requests" });
    }

    next();
  } catch (error: any) {
    console.error("Error in requireFounder middleware:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

/**
 * GET /join-requests/pending
 * Get all pending join requests for an organization (founders only)
 */
router.get("/pending", requireAuth, requireFounder, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
    });
    const { orgId } = schema.parse(req.query);

    const requests = await JoinRequest.find({
      orgId: new Types.ObjectId(orgId),
      status: "pending",
    })
      .populate("guestUserId", "name email profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    const formattedRequests = requests.map((req) => ({
      id: req._id,
      guestUser: req.guestUserId,
      email: req.email,
      name: req.name,
      message: req.message,
      createdAt: req.createdAt,
    }));

    res.json({
      ok: true,
      requests: formattedRequests,
    });
  } catch (error: any) {
    console.error("Error in get pending requests:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to fetch pending requests" });
  }
});

/**
 * POST /join-requests/:id/approve
 * Approve a join request (founders only)
 * Creates an invite and sends approval email with OTP
 */
router.post("/:id/approve", requireAuth, requireFounder, async (req, res) => {
  try {
    const schema = z.object({
      id: z.string(),
    });
    const { id } = schema.parse(req.params);
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Optional fields from request body
    const bodySchema = z.object({
      floorId: z.string().optional(),
      department: z.string().optional(),
    });
    const { floorId, department } = bodySchema.parse(req.body);

    // Find the join request
    const joinRequest = await JoinRequest.findOne({
      _id: id,
      orgId: new Types.ObjectId(orgId),
    });

    if (!joinRequest) {
      return res.status(404).json({ error: "Join request not found" });
    }

    if (joinRequest.status !== "pending") {
      return res.status(400).json({
        error: `Request already ${joinRequest.status}`,
      });
    }

    // Get guest user
    const guestUser = await User.findById(joinRequest.guestUserId);
    if (!guestUser) {
      return res.status(404).json({ error: "Guest user not found" });
    }

    console.log(`🔍 Approving join request - Guest user: ${guestUser.email}, guest status BEFORE: ${guestUser.guest}`);

    // Get organization
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check guest limit (25 guests for Basic plan)
    if (await isGuestLimitReached(orgId)) {
      return res.status(403).json({
        error: "Guest limit reached. Your organization has reached the maximum of 25 guests. Upgrade to Pro for unlimited guests.",
        code: "GUEST_LIMIT_REACHED",
      });
    }

    // Ensure email exists
    if (!guestUser.email) {
      return res.status(400).json({ error: "Guest user has no email" });
    }

    // Create an invite record (similar to admin invite flow)
    const inviteData: any = {
      orgId: new Types.ObjectId(orgId),
      email: guestUser.email.trim().toLowerCase(),
      role: "stakeholder", // Guests always join as stakeholders
      name: joinRequest.name || guestUser.name,
      status: "pending",
    };

    if (floorId) {
      inviteData.floorId = new Types.ObjectId(floorId);
    }
    if (department) {
      inviteData.department = department;
    }

    // Upsert invite (in case one already exists)
    await Invite.findOneAndUpdate(
      { orgId: inviteData.orgId, email: inviteData.email },
      { $set: inviteData },
      { upsert: true, new: true }
    );

    console.log(`✅ Created invite for guest: ${guestUser.email}`);

    // Generate OTP for invite acceptance
    const code = await createOtp(guestUser.email, "invite", orgId);

    // Send approval email with OTP
    const { subject, html } = guestApprovalEmailTemplate(
      guestUser.email,
      code,
      orgId,
      org.name
    );
    // White-label orgs send from their own verified domain; everyone else
    // falls back to the Garage address.
    await sendMail(
      guestUser.email,
      subject,
      html,
      undefined,
      await senderForOrg(orgId)
    );

    console.log(`📧 Sent approval email to: ${guestUser.email}`);

    // Update join request status
    joinRequest.status = "approved";
    joinRequest.respondedBy = new Types.ObjectId((req as any).user.userId);
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    console.log(`✅ Approved join request: ${guestUser.email} → ${org.name}`);

    // Verify guest status hasn't changed
    const guestUserAfter = await User.findById(joinRequest.guestUserId);
    console.log(`🔍 Guest user status AFTER approval: ${guestUserAfter?.guest}`);

    res.json({
      ok: true,
      message: "Join request approved and invitation sent",
    });
  } catch (error: any) {
    console.error("Error in approve join request:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to approve request" });
  }
});

/**
 * POST /join-requests/:id/reject
 * Reject a join request (founders only)
 */
router.post("/:id/reject", requireAuth, requireFounder, async (req, res) => {
  try {
    const schema = z.object({
      id: z.string(),
    });
    const { id } = schema.parse(req.params);
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Optional reason from body
    const bodySchema = z.object({
      reason: z.string().optional(),
      sendEmail: z.boolean().optional().default(true),
    });
    const { reason, sendEmail } = bodySchema.parse(req.body);

    // Find the join request
    const joinRequest = await JoinRequest.findOne({
      _id: id,
      orgId: new Types.ObjectId(orgId),
    });

    if (!joinRequest) {
      return res.status(404).json({ error: "Join request not found" });
    }

    if (joinRequest.status !== "pending") {
      return res.status(400).json({
        error: `Request already ${joinRequest.status}`,
      });
    }

    // Get guest user
    const guestUser = await User.findById(joinRequest.guestUserId);
    if (!guestUser) {
      return res.status(404).json({ error: "Guest user not found" });
    }

    // Ensure email exists
    if (!guestUser.email) {
      return res.status(400).json({ error: "Guest user has no email" });
    }

    // Get organization
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Update join request status
    joinRequest.status = "rejected";
    joinRequest.respondedBy = new Types.ObjectId((req as any).user.userId);
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    console.log(`❌ Rejected join request: ${guestUser.email} → ${org.name}`);

    // Optionally send rejection email
    if (sendEmail) {
      try {
        const { subject, html } = guestRejectionEmailTemplate(
          guestUser.email,
          org.name
        );
        await sendMail(
          guestUser.email,
          subject,
          html,
          undefined,
          await senderForOrg(org._id)
        );
        console.log(`📧 Sent rejection email to: ${guestUser.email}`);
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      ok: true,
      message: "Join request rejected",
    });
  } catch (error: any) {
    console.error("Error in reject join request:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to reject request" });
  }
});

/**
 * GET /join-requests/all
 * Get all join requests for an organization (founders only)
 * Includes pending, approved, and rejected
 */
router.get("/all", requireAuth, requireFounder, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      status: z.enum(["pending", "approved", "rejected", "all"]).optional(),
    });
    const { orgId, status } = schema.parse(req.query);

    const query: any = { orgId: new Types.ObjectId(orgId) };
    if (status && status !== "all") {
      query.status = status;
    }

    const requests = await JoinRequest.find(query)
      .populate("guestUserId", "name email profilePicture")
      .populate("respondedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const formattedRequests = requests.map((req) => ({
      id: req._id,
      guestUser: req.guestUserId,
      email: req.email,
      name: req.name,
      message: req.message,
      status: req.status,
      createdAt: req.createdAt,
      respondedAt: req.respondedAt,
      respondedBy: req.respondedBy,
    }));

    res.json({
      ok: true,
      requests: formattedRequests,
    });
  } catch (error: any) {
    console.error("Error in get all requests:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to fetch requests" });
  }
});

export default router;
