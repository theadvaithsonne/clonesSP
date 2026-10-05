import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { requireOrgFounder } from "../middleware/roles";
import { memberCleanupService } from "../services/memberCleanup.service";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, accountDeletionOtpTemplate, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";

const router = Router();

interface AuthUser {
  userId: string;
  orgId: string;
  role?: string;
}

/**
 * DELETE /org/:orgId/members/:memberId
 * Kick a member from an organization (founder only)
 */
router.delete(
  "/org/:orgId/members/:memberId",
  requireAuth,
  requireOrgFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, memberId } = req.params;
      const me = (req as any).user as AuthUser;

      // Validate memberId is a valid ObjectId
      if (!memberId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid member ID format",
        });
      }

      // Cannot kick yourself
      if (memberId === me.userId) {
        return res.status(400).json({
          success: false,
          error: "Cannot remove yourself from the organization",
        });
      }

      // Check if target user is a member of the organization
      const membership = await memberCleanupService.isMemberOfOrg(
        memberId,
        orgId
      );

      if (!membership.isMember) {
        return res.status(404).json({
          success: false,
          error: "Member not found in this organization",
        });
      }

      // Cannot kick another founder
      if (membership.role === "founder") {
        return res.status(403).json({
          success: false,
          error:
            "Cannot remove a founder from the organization. They must transfer ownership first.",
        });
      }

      // Perform the removal
      const result = await memberCleanupService.removeFromOrganization({
        userId: memberId,
        orgId,
        performedBy: me.userId,
        reason: "kicked",
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Failed to remove member",
          details: result.errors,
        });
      }

      return res.json({
        success: true,
        message: "Member removed from organization",
        cleanupSummary: result.cleanedResources,
      });
    } catch (error: any) {
      console.error("[Membership] Error kicking member:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);

/**
 * PATCH /org/:orgId/members/:memberId/access
 * Grant or revoke fullAccess for a stakeholder (founder only)
 */
router.patch(
  "/org/:orgId/members/:memberId/access",
  requireAuth,
  requireOrgFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, memberId } = req.params;
      const { fullAccess } = req.body;

      if (typeof fullAccess !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "fullAccess must be a boolean",
        });
      }

      // Validate memberId
      if (!memberId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid member ID format",
        });
      }

      // Find the target user
      const targetUser = await User.findById(memberId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Find the membership for this org
      const membership = targetUser.organizations?.find(
        (m: any) => m.organization.toString() === orgId
      );

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: "Member not found in this organization",
        });
      }

      // Cannot modify access for actual founders
      if (membership.role === "founder") {
        return res.status(400).json({
          success: false,
          error: "Founders already have full access",
        });
      }

      // Update fullAccess
      (membership as any).fullAccess = fullAccess;
      await targetUser.save();

      return res.json({
        success: true,
        message: fullAccess
          ? "Full access granted to member"
          : "Full access revoked from member",
        memberId,
        fullAccess,
      });
    } catch (error: any) {
      console.error("[Membership] Error updating member access:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);

/**
 * POST /org/:orgId/leave
 * Leave an organization (user self-service)
 */
router.post("/org/:orgId/leave", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const me = (req as any).user as AuthUser;

    // Check if user is a member of the organization
    const membership = await memberCleanupService.isMemberOfOrg(
      me.userId,
      orgId
    );

    if (!membership.isMember) {
      return res.status(404).json({
        success: false,
        error: "You are not a member of this organization",
      });
    }

    // Founders cannot leave - must transfer ownership first
    if (membership.role === "founder") {
      return res.status(403).json({
        success: false,
        error:
          "Founders cannot leave their organization. Transfer ownership first.",
      });
    }

    // Check remaining organizations
    const remainingOrgs = await memberCleanupService.getRemainingOrganizations(
      me.userId,
      orgId
    );

    // Perform the removal
    const result = await memberCleanupService.removeFromOrganization({
      userId: me.userId,
      orgId,
      performedBy: me.userId,
      reason: "left",
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to leave organization",
        details: result.errors,
      });
    }

    return res.json({
      success: true,
      message: "Successfully left organization",
      remainingOrganizations: remainingOrgs,
      cleanupSummary: result.cleanedResources,
    });
  } catch (error: any) {
    console.error("[Membership] Error leaving org:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * DELETE /org/:orgId/members/:memberId/permanent
 * Permanently delete a user account (founder only)
 */
router.delete(
  "/org/:orgId/members/:memberId/permanent",
  requireAuth,
  requireOrgFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, memberId } = req.params;
      const { confirmation } = req.body;
      const me = (req as any).user as AuthUser;

      // Validate confirmation
      if (confirmation !== "PERMANENTLY_DELETE") {
        return res.status(400).json({
          success: false,
          error:
            "Invalid confirmation. Send confirmation: 'PERMANENTLY_DELETE'",
        });
      }

      // Validate memberId
      if (!memberId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid member ID format",
        });
      }

      // Cannot delete yourself via this endpoint
      if (memberId === me.userId) {
        return res.status(400).json({
          success: false,
          error: "Use /auth/account to delete your own account",
        });
      }

      // Check if target user exists and is not a founder
      const founderCheck = await memberCleanupService.isFounderOfAnyOrg(memberId);

      if (founderCheck.isFounder) {
        return res.status(403).json({
          success: false,
          error:
            "Cannot permanently delete a founder. They must delete their own account.",
          founderOf: founderCheck.organizations,
        });
      }

      // Perform the permanent deletion
      const result = await memberCleanupService.deleteAccountPermanently(
        memberId,
        me.userId
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Failed to delete user account",
          details: result.errors,
        });
      }

      return res.json({
        success: true,
        message: "User account permanently deleted",
        cleanupSummary: result.cleanedResources,
      });
    } catch (error: any) {
      console.error("[Membership] Error permanently deleting member:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);

/**
 * POST /auth/account/deletion-request
 * Request account deletion (sends OTP to email)
 */
router.post(
  "/auth/account/deletion-request",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as AuthUser;

      // Get user details
      const user = await User.findById(me.userId).select("email organizations").lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Ensure user has an email
      if (!user.email) {
        return res.status(400).json({
          success: false,
          error: "User email not found",
        });
      }

      // Check if user is a founder of any organization
      const founderCheck = await memberCleanupService.isFounderOfAnyOrg(me.userId);

      if (founderCheck.isFounder) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete account while holding founder roles",
          blockers: founderCheck.organizations.map((org) => ({
            type: "founder_role",
            orgId: org.id,
            orgName: org.name,
            message: "You must transfer founder role before deleting account",
          })),
        });
      }

      // Generate and send OTP
      const userEmail = user.email;
      const code = await createOtp(userEmail, "account-deletion");
      const template = accountDeletionOtpTemplate(userEmail, code);
      await sendMail(userEmail, template.subject, template.html, template.text, await senderForHost(req, EMAIL_FROM_OTP));

      return res.json({
        success: true,
        message: "Verification code sent to your email",
      });
    } catch (error: any) {
      console.error("[Membership] Error requesting deletion:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);

/**
 * DELETE /auth/account
 * Permanently delete own account (user self-service)
 */
router.delete("/auth/account", requireAuth, async (req: Request, res: Response) => {
  try {
    const { confirmation, verificationCode } = req.body;
    const me = (req as any).user as AuthUser;

    // Validate confirmation
    if (confirmation !== "DELETE_MY_ACCOUNT") {
      return res.status(400).json({
        success: false,
        error: "Invalid confirmation. Send confirmation: 'DELETE_MY_ACCOUNT'",
      });
    }

    // Validate verification code is present
    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        error: "Verification code is required",
      });
    }

    // Get user email for OTP verification
    const user = await User.findById(me.userId).select("email").lean();

    if (!user || !user.email) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Verify OTP
    const userEmail = user.email;
    const otpResult = await verifyOtp(
      userEmail,
      verificationCode,
      "account-deletion"
    );

    if (otpResult === false) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired verification code",
      });
    }

    // Check if user is a founder (double check)
    const founderCheck = await memberCleanupService.isFounderOfAnyOrg(me.userId);

    if (founderCheck.isFounder) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete account while holding founder roles",
        founderOf: founderCheck.organizations,
      });
    }

    // Perform the permanent deletion
    const result = await memberCleanupService.deleteAccountPermanently(
      me.userId,
      me.userId
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to delete account",
        details: result.errors,
      });
    }

    return res.json({
      success: true,
      message: "Account permanently deleted",
      cleanupSummary: result.cleanedResources,
    });
  } catch (error: any) {
    console.error("[Membership] Error deleting own account:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * GET /auth/account/status
 * Get current user's account status (what actions are available)
 */
router.get("/auth/account/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as AuthUser;

    // Get user's organizations
    const user = await User.findById(me.userId)
      .select("organizations")
      .populate("organizations.organization", "name")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if user is a founder of any org
    const founderCheck = await memberCleanupService.isFounderOfAnyOrg(me.userId);

    // Check membership in current org (from JWT)
    const currentOrgMembership = await memberCleanupService.isMemberOfOrg(
      me.userId,
      me.orgId
    );

    // Build organizations list
    const organizations = (user.organizations || []).map((m: any) => ({
      id: m.organization._id?.toString() || m.organization.toString(),
      name: m.organization.name || "Unknown",
      role: m.role,
    }));

    return res.json({
      success: true,
      canDeleteAccount: !founderCheck.isFounder,
      canLeaveCurrentOrg:
        currentOrgMembership.isMember &&
        currentOrgMembership.role !== "founder",
      isFounderOfCurrentOrg: hasFounderAccess(currentOrgMembership),
      founderOf: founderCheck.organizations,
      organizations,
    });
  } catch (error: any) {
    console.error("[Membership] Error getting account status:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;
