// src/routes/invites.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireOrgAdmin } from "../middleware/roles";
import { storablePhone } from "../services/twoFactorSms";
import { Invite } from "../models/invite.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, inviteEmailTemplate, EMAIL_FROM_NOTIFICATION, EMAIL_FROM_RESEND_OTP, senderForOrg} from "../services/mailer";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { signJwt } from "../services/jwt";
import { Floor } from "../models/floor.model";
import { Types } from "mongoose";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { sendTeamforceOnboardingEmail } from "../services/teamforceOnboardingEmail";
import { generateAffiliateId } from "../utils/affiliateId";
import { autoJoinEmployeesChannel, autoJoinDefaultChannel } from "../services/channel";
import { canInviteStakeholders } from "../services/officeSubscription";
import { syncNewEnrollee } from "../services/downlineTree";

const router = Router();

/** Create or update invites (idempotent) + assign floor/department */
router.post("/create", requireAuth, requireOrgAdmin, async (req, res) => {
  const schema = z.object({
    members: z.array(
      z.object({
        email: z.string().email(),
        role: z
          .enum(["admin", "user", "founder", "stakeholder"])
          .default("stakeholder"),
        name: z.string().min(1).max(120).optional(),
        floorId: z.string().optional(), // floor _id
        department: z.string().optional(), // dept name in that floor
      })
    ),
  });

  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  const { members } = schema.parse(req.body);

  // Check if organization has Pro plan to invite stakeholders
  // Skip check for GARAGE HQ (parent organization) and for founder invites
  const org = await Organization.findById(orgId).select("parent").lean();
  const isGarageHQ = org?.parent === true;

  // Check if any members are stakeholders
  const hasStakeholderInvites = members.some(
    (m) => m.role === "stakeholder" || m.role === "user"
  );

  if (hasStakeholderInvites && !isGarageHQ) {
    const canInvite = await canInviteStakeholders(orgId);
    if (!canInvite) {
      return res.status(403).json({
        error: "Upgrade to Pro plan to invite team members",
        code: "PRO_PLAN_REQUIRED",
      });
    }
  }

  // Optional: validate floor/dept belong to org
  const floorMap = new Map<string, { depts: Set<string> }>();
  const floors = await Floor.find({ orgId: new Types.ObjectId(orgId) })
    .select("_id departments.name")
    .lean();
  for (const f of floors) {
    floorMap.set(String(f._id), {
      depts: new Set((f.departments || []).map((d: any) => d.name)),
    });
  }

  const ops = members.map((m) => {
    const patch: any = {
      role: m.role,
      name: m.name?.trim(),
      status: "pending", // Reset status to pending for re-invites
    };
    if (m.floorId && floorMap.has(m.floorId)) {
      patch.floorId = new Types.ObjectId(m.floorId);
      if (m.department && floorMap.get(m.floorId)!.depts.has(m.department)) {
        patch.department = m.department;
      } else {
        patch.department = undefined;
      }
    } else {
      patch.floorId = undefined;
      patch.department = undefined;
    }

    return {
      updateOne: {
        filter: {
          orgId: new Types.ObjectId(orgId),
          email: m.email.trim().toLowerCase(),
        },
        update: {
          $set: patch,
          $setOnInsert: {
            orgId: new Types.ObjectId(orgId),
            email: m.email.trim().toLowerCase(),
          },
        },
        upsert: true,
      },
    };
  });

  await Invite.bulkWrite(ops, { ordered: false });

  // Send/refresh OTP for each (don’t fail the whole call if an email fails)
  const created = await Invite.find({
    orgId: orgId,
    email: { $in: members.map((m) => m.email.trim().toLowerCase()) },
  });

  for (const inv of created) {
    try {
      if (inv.status === "revoked") continue;
      const code = await createOtp(inv.email, "invite", orgId);
      const { subject, html } = inviteEmailTemplate(inv.email, code, orgId);
      await sendMail(inv.email, subject, html, undefined, await senderForOrg(orgId));
    } catch {}
  }

  res.json({ ok: true, count: created.length });
});

/** List invites (admin) */
router.get("/list", requireAuth, requireOrgAdmin, async (req, res) => {
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  const rows = await Invite.find({ orgId: new Types.ObjectId(orgId) })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    items: rows.map((r) => ({
      id: String(r._id),
      email: r.email,
      name: r.name,
      role: r.role,
      floorId: r.floorId ? String(r.floorId) : null,
      department: r.department || null,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
});

/** Resend */
router.patch("/:id/resend", requireAuth, requireOrgAdmin, async (req, res) => {
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const inv = await Invite.findOne({ _id: id, orgId: orgId });
  if (!inv) return res.status(404).json({ error: "Invite not found" });
  if (inv.status === "revoked")
    return res.status(400).json({ error: "Invite revoked" });

  const code = await createOtp(inv.email, "invite", orgId);
  const { subject, html } = inviteEmailTemplate(inv.email, code, orgId);
  await sendMail(inv.email, subject, html, undefined, await senderForOrg(orgId, EMAIL_FROM_RESEND_OTP));

  res.json({ ok: true });
});

/** Revoke */
router.patch("/:id/revoke", requireAuth, requireOrgAdmin, async (req, res) => {
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const inv = await Invite.findOne({ _id: id, orgId: orgId });
  if (!inv) return res.status(404).json({ error: "Invite not found" });
  inv.status = "revoked";
  await inv.save();
  res.json({ ok: true });
});

/** Accept */
router.post("/accept", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
    phone: z.string().optional(),
  });
  const { email, code, phone } = schema.parse(req.body);
  const E = email.trim().toLowerCase();

  const orgId = await verifyOtp(E, code, "invite");
  if (!orgId) return res.status(400).json({ error: "Invalid or expired OTP" });

  let user = await User.findOne({ email: E });
  const wasGuest = user?.guest || false;

  console.log(`🔍 Initial user fetch - email: ${E}, guest status: ${user?.guest}, wasGuest: ${wasGuest}`);

  if (!user) {
    user = await User.create({
      email: E,
      organization: orgId,
      isVerified: true,
      // Normalized so a later phone login finds THIS row instead of
      // creating a duplicate account (see storablePhone).
      phone: storablePhone(phone) ?? "",
      guest: false, // New users are not guests
    });
    // Automatically add new user to GARAGE HQ as stakeholder
    await addUserToGarageHQ(user._id.toString());
    // Welcome email is sent later (after referredBy is set) so referrer notification includes affiliate links
  } else if (user.guest) {
    // Guest user accepting invite - convert to regular user
    console.log(`🔄 Converting guest user to regular user: ${user.email}`);

    // Check if they need to be added to GARAGE HQ
    const garageHQ = await Organization.findOne({ parent: true });
    if (garageHQ) {
      const hasGarageHQMembership = user.organizations?.some(
        (m: any) => m.organization.toString() === garageHQ._id.toString()
      );
      if (!hasGarageHQMembership) {
        console.log(`Adding former guest to GARAGE HQ: ${user.email}`);
        console.log(`🔍 Before addUserToGarageHQ - guest status: ${user.guest}`);
        await addUserToGarageHQ(user._id.toString());
        // Refresh user to include GARAGE HQ membership
        user = await User.findById(user._id);
        if (!user) {
          return res.status(500).json({ error: "Failed to refresh user data" });
        }
        console.log(`🔍 After refresh from DB - guest status: ${user.guest}`);
      }
    }
  }

  // attach metadata from invite
  const inv = await Invite.findOne({ email: E, orgId });
  if (inv?.status === "revoked")
    return res.status(400).json({ error: "Invite revoked" });

  user.organization = orgId;
  user.isVerified = true;
  if (phone) {
    user.phone = storablePhone(phone) ?? phone;
  }

  // Preserve guest status - guests remain guests even after accepting invite
  // They will be converted to regular users when they complete their profile
  console.log(`🔍 Preserving guest status - current value: ${user.guest}, wasGuest: ${wasGuest}`);
  if (wasGuest) {
    console.log(`✅ User remains as guest: ${user.email}`);
  } else {
    // For non-guest users accepting invites, ensure guest is explicitly false
    (user as any).guest = false;
    console.log(`✅ Ensured guest = false for non-guest user: ${user.email}`);
  }

  if (inv) {
    if (!user.name && inv.name) user.name = inv.name;
    if (inv.department) (user as any).department = inv.department;

    // Convert role to new system
    const role = inv.role === "admin" ? "founder" : "stakeholder";

    // Check if user is already a member of this organization
    const existingMembership = user.organizations?.find(
      (membership: any) => membership.organization.toString() === orgId
    );

    if (!existingMembership) {
      // Add organization membership
      user.organizations = user.organizations || [];
      user.organizations.push({
        organization: orgId,
        role: role,
        floorId: inv.floorId, // Store floorId in the organization membership
        joinedAt: new Date(),
        guest: wasGuest, // Save guest status in this org membership
      });
    } else {
      // Update existing membership with floorId and guest status
      existingMembership.floorId = inv.floorId;
      existingMembership.guest = wasGuest;
    }

    // Update legacy fields for backward compatibility
    (user as any).role = inv.role === "founder" ? "admin" : inv.role;

    inv.status = "accepted";
    await inv.save();
  }

  console.log(`🔍 Before final save - guest status: ${user.guest}`);
  await user.save();
  console.log(`🔍 After final save - guest status: ${user.guest}`);

  // Cryptobrand orgs: eager-mint the new member's currency wallets.
  // No-op on non-cryptobrand orgs. Fire-and-forget — invite acceptance
  // shouldn't block on wallet setup.
  try {
    const { ensureCryptobrandWalletsFireAndForget } = await import(
      "../services/cryptobrandWallets"
    );
    ensureCryptobrandWalletsFireAndForget(
      user._id.toString(),
      orgId,
      "invite-accept",
    );
  } catch (err) {
    console.error("[invites/accept] cryptobrand wallet ensure failed:", err);
  }

  // Set up affiliate and channel for stakeholders (replaces EarnGPT)
  if (inv?.role === "stakeholder" || inv?.role === "user") {
    try {
      console.log("🚀 Setting up affiliate and channel for stakeholder...");

      // Generate affiliate ID if not present
      if (!user.affiliateId) {
        user.affiliateId = await generateAffiliateId();
        console.log("✅ Generated affiliate ID for stakeholder:", user.affiliateId);
      }

      // Set referredBy to the founder of this organization if not already set
      if (!user.referredBy) {
        const founderUser = await User.findOne({
          $or: [
            { organization: orgId, role: { $in: ["admin", "founder"] } },
            {
              "organizations.organization": orgId,
              "organizations.role": "founder",
            },
          ],
        })
          .select("_id")
          .lean();

        if (founderUser?._id) {
          user.referredBy = founderUser._id;
          (user as any).referredBySource = "founder_default";
          console.log("✅ Set referredBy to founder:", user.referredBy);
        } else {
          console.log("⚠️ No founder found for organization:", orgId);
        }
      }

      const referredByAfterSave = user.referredBy;
      await user.save();
      // Slot into the denormalized downline tree when we just assigned a
      // founder_default referrer. Idempotent: if the user already had an
      // ancestor row, syncNewEnrollee re-writes it consistently.
      if (referredByAfterSave) void syncNewEnrollee(user._id.toString());

      // Auto-join default channel (Members for new orgs, Employees for existing)
      try {
        await autoJoinEmployeesChannel(user._id.toString(), orgId);
        await autoJoinDefaultChannel(user._id.toString(), orgId);
        console.log("✅ Added stakeholder to default channel");
      } catch (channelError) {
        console.log("⚠️ Could not auto-join default channel:", channelError);
      }
    } catch (error) {
      console.log("💥 Stakeholder affiliate setup failed:", error);
    }
  }

  // Send welcome email AFTER referredBy is set so referrer notification includes affiliate/workshop links
  // This runs for all roles (stakeholder, user, admin, founder)
  sendWelcomeEmail(user._id.toString(), orgId).catch((err) =>
    console.error("[WelcomeEmail] Failed:", err)
  );

  // Teamforce onboarding nudge — every non-founder joiner gets a TeamforceEmployeeProfile
  // gate the first time they open Teamforce, so prompt them to fill it in now.
  // Founders aren't gated by that form, so they don't need this email.
  if (inv?.role !== "admin") {
    sendTeamforceOnboardingEmail(user._id.toString(), orgId).catch((err) =>
      console.error("[TeamforceOnboarding] Failed:", err)
    );
  }

  const token = signJwt({
    userId: user.id,
    orgId: orgId,
    role:
      inv?.role === "admin" || inv?.role === "founder"
        ? "founder"
        : "stakeholder",
  });
  res.json({ ok: true, token, user: { id: user.id, email: user.email } });
});

export default router;
