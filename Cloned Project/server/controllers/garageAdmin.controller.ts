import { Request, Response } from "express";
import { Types } from "mongoose";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { GarageAdminRole } from "../models/garageAdminRole.model";
import { Organization } from "../models/organization.model";
import { Floor } from "../models/floor.model";
import { User } from "../models/user.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { ReserveLicense } from "../models/reserveLicense.model";
import { Invoice } from "../models/invoice.model";
import { minorToUsd, usdRates } from "../utils/invoiceMoney";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { OfficePlan } from "../models/officePlan.model";
import { ProductOrder } from "../models/productOrder.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { comboWindowFor, comboWindowStatus } from "../services/comboWindow";
import { Channel } from "../models/channel.model";
import { Workshop } from "../models/workshop.model";
import { Course } from "../models/course.model";
import { Product } from "../models/product.model";
import { CallOffering } from "../models/callOffering.model";
import { Service } from "../models/service.model";
import { z } from "zod";
import { ok, fail } from "../utils/http";
import {
  getUserStoreWallets,
  getAffiliateWalletBalance,
} from "../services/wallet";
import {
  getContentRewardsWalletBalance,
  listContentRewardsBalancesForUser,
} from "../services/contentRewardsWallet";
import { getAllWalletAccountsForUser } from "../services/walletAccount";
import { isInMyDownline, getReferrerInfo } from "../services/affiliate";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { NcWallet } from "../models/ncWallet.model";
import { OrgRewardsWallet } from "../models/orgRewardsWallet.model";
import { WalletAccount } from "../models/walletAccount.model";
import { CampaignWalletTransaction } from "../models/campaignWalletTransaction.model";
import {
  initiateWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  getWithdrawableBalanceCents,
  notifyAdminOnWithdrawalInitiated,
  notifyUserOnWithdrawalInitiated,
  notifyUserOnWithdrawalCompleted,
  notifyUserOnWithdrawalRejected,
} from "../services/withdrawal";
import { Withdrawal, WITHDRAWAL_WALLET_TYPES } from "../models/withdrawal.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP, EMAIL_FROM_RESEND_OTP, EMAIL_FROM_NOTIFICATION } from "../services/mailer";
import { signJwt } from "../services/jwt";
import {
  ADMIN_PAGES,
  ADMIN_PAGE_GROUP_LABELS,
  ADMIN_PAGE_LEVELS,
  ADMIN_ROLE_PRESETS,
  isReservedRoleName,
  resolvePagePermissions,
  sanitizePagePermissions,
} from "../config/adminPages";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  // Free-text role label. Absent → the default "garage-admin".
  role: z.string().trim().min(2).max(40).optional(),
  // Per-page levels; unknown keys and bad values are dropped by
  // sanitizePagePermissions, so a client can't invent a page.
  permissions: z.record(z.string(), z.string()).optional(),
});

const updateAdminAccessSchema = z.object({
  role: z.string().trim().min(2).max(40).optional(),
  permissions: z.record(z.string(), z.string()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

const requestOtpSchema = z.object({
  email: z.string().email(),
  isResend: z.boolean().optional().default(false),
});

export async function inviteGarageAdmin(req: Request, res: Response) {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("Invalid input"));
  }
  const { email, name } = parsed.data;

  // Check if user is super admin
  const currentAdmin = (req as any).garageAdmin;
  if (currentAdmin.role !== "garage-super-admin") {
    return res.status(403).json(fail("Only super admins can invite"));
  }

  // Role is a free-text label the super admin picks or types. The one
  // name it may never be is the super-admin role itself — that would mint
  // a second unrestricted account through the invite form.
  const role = parsed.data.role?.trim() || "garage-admin";
  if (isReservedRoleName(role)) {
    return res
      .status(400)
      .json(fail("That role name is reserved. Pick another."));
  }
  const permissions = sanitizePagePermissions(parsed.data.permissions);
  const roleLabel = role === "garage-admin" ? "Garage Admin" : role;

  // Existing GarageAdmin row → treat as a re-invite: don't fail with 409,
  // just mint a fresh OTP + resend the invitation email.
  //
  // Motivation: this endpoint used to hard-reject any email already in
  // the collection, which blocked (a) super admins inviting themselves
  // to test the flow (screenshot: shorupan@gmail.com invited by
  // shorupan@gmail.com), (b) resending an invite that expired before
  // the invitee opened it, (c) any legitimate re-invite scenario. The
  // schema already carries an `isResend` flag that was never wired up
  // in the handler — this closes that gap by making every subsequent
  // invite behave as a resend without requiring the client to set the
  // flag. Role + name are preserved (only invitedBy is refreshed so
  // audit reflects the latest sender).
  let doc = await GarageAdminModel.findOne({ email });
  if (doc) {
    doc.invitedBy = currentAdmin.id;
    if (name && !doc.name) doc.name = name;
    // A re-invite carries the role + access the super admin just chose.
    // Never touch a super admin's row this way — their access isn't
    // expressible as a permission map and must not be downgraded by
    // someone re-sending them an invite.
    if (doc.role !== "garage-super-admin") {
      doc.role = role;
      doc.set("pagePermissions", permissions);
      doc.pagePermissionsSet = true;
    }
    await doc.save();
  } else {
    doc = await GarageAdminModel.create({
      email,
      name,
      role,
      pagePermissions: permissions,
      pagePermissionsSet: true,
      invitedBy: currentAdmin.id,
    });
  }

  // Every active admin sits in every support chat — a new one joins them all
  // now (via their User account on this email, if they have one yet).
  void import("../services/supportChat").then(({ syncAdminSupportMembership }) =>
    syncAdminSupportMembership({ email: doc!.email, isActive: doc!.isActive })
  );

  // Send invitation email with OTP
  const code = await createOtp(email, "garage-admin-invite");
  const acceptInviteUrl = `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/garage-admin/accept-invite?email=${encodeURIComponent(email)}&code=${code}`;

  // The account and its OTP already exist by this point, so a mail
  // failure must not read as "the invite failed" — it isn't recoverable by
  // retrying the whole call and it would leave the super admin thinking
  // nothing happened. Report it as a partial success instead: the row is
  // there, the code is valid, and re-inviting the same address resends.
  let emailSent = true;
  let emailError: string | null = null;
  try {
    await sendMail(
      email,
      "Garage Admin Invitation",
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3B82F6, #1E40AF); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🛡️ Garage Admin Invitation</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You've been invited to join our admin team</p>
        </div>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${name}!</h2>
          <p style="color: #475569; line-height: 1.6;">
            You've been invited to join as a <strong>${roleLabel}</strong> by <strong>${
      currentAdmin.name || "a super admin"
    }</strong>.
            Your access is scoped to the sections that role has been given.
          </p>
        </div>

        <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #92400e; margin-top: 0;">Your Verification Code</h3>
          <div style="background: white; padding: 15px; border-radius: 6px; text-align: center; margin: 10px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #f59e0b; letter-spacing: 4px;">${code}</span>
          </div>
          <p style="color: #92400e; margin: 0; font-size: 14px;">This code will expire in 10 minutes.</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${acceptInviteUrl}" 
             style="background: #3B82F6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
            🚀 Complete Admin Setup
          </a>
        </div>

        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
          <p style="color: #065f46; margin: 0; font-size: 14px;">
            <strong>What's next?</strong> Click the button above or visit the link to complete your admin account setup. 
            You'll need to enter your email and the verification code above.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Best regards,<br>
            <strong>Garage Admin Team</strong>
          </p>
        </div>
      </div>
    `,
      `You've been invited to join as a ${roleLabel}. Your OTP is ${code}. Complete your setup at: ${acceptInviteUrl}`,
      EMAIL_FROM_NOTIFICATION
    );
  } catch (err: any) {
    emailSent = false;
    emailError = err?.message || "Failed to send invitation email";
    console.error(
      `[GarageAdmin] Invite row created for ${email} but the email failed:`,
      emailError
    );
  }

  return res.status(201).json(
    ok({
      id: doc._id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
      permissions: resolvePagePermissions(doc.pagePermissions, doc.pagePermissionsSet),
      invitedAt: doc.invitedAt,
      // False means: account created, OTP valid, message never left the
      // building. The FE tells the super admin to pass the code on or
      // re-invite once mail is working again.
      emailSent,
      emailError,
    })
  );
}

/**
 * GET /garage-admin/admin-pages
 *
 * The permission catalogue the invite/edit UI renders: every delegatable
 * page, its group, and the presets. Deliberately readable by any
 * authenticated admin — it's a list of page names, not data.
 */
export async function getAdminPageCatalogue(_req: Request, res: Response) {
  return res.json(
    ok({
      levels: ADMIN_PAGE_LEVELS,
      groupLabels: ADMIN_PAGE_GROUP_LABELS,
      pages: ADMIN_PAGES,
      presets: ADMIN_ROLE_PRESETS,
    })
  );
}

/**
 * GET /garage-admin/admin-roles
 *
 * Roles already in use, so the invite dialog can offer "reuse an existing
 * role" alongside the presets. Roles are labels on the admin documents,
 * not their own collection, so this is a group-by rather than a lookup —
 * the permission map returned is the most recently updated admin holding
 * that label.
 *
 * Super-admin only: it enumerates the shape of everyone's access.
 */
/**
 * Create (or update) a standalone role.
 *
 * Upsert rather than insert: re-saving a role the super admin already
 * defined is the same intent as defining it, and a duplicate-key error
 * would be a confusing way to say "that already exists".
 */
export async function createGarageAdminRole(req: Request, res: Response) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(40),
      permissions: z.record(z.string(), z.string()).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail("Invalid input"));

  const name = parsed.data.name.trim();
  if (isReservedRoleName(name)) {
    return res.status(400).json(fail("That role name is reserved. Pick another."));
  }

  const permissions = sanitizePagePermissions(parsed.data.permissions);
  const doc = await GarageAdminRole.findOneAndUpdate(
    { nameLower: name.toLowerCase() },
    {
      $set: { name, nameLower: name.toLowerCase(), permissions },
      $setOnInsert: { createdBy: (req as any).garageAdmin?.id },
    },
    { new: true, upsert: true },
  );

  return res.json(ok({ role: doc.name, permissions: doc.permissions }));
}

/**
 * Delete a standalone role. Admins already holding the label keep it —
 * their access lives on their own document, so removing the definition
 * takes nothing away from anyone.
 */
/**
 * Edit a role: rename it, retemplate its access, or both.
 *
 * The template is a starting point copied into an admin at assignment, not a
 * live link — so editing a role deliberately does NOT re-permission admins
 * already holding the label, and a rename does NOT rewrite their stored role
 * string. Both are consistent with how access is read everywhere (off the
 * admin's own document). Renaming is therefore a rename of the DEFINITION,
 * not a bulk migration; existing admins keep the old label until reassigned.
 */
export async function updateGarageAdminRole(req: Request, res: Response) {
  const current = String(req.params.name || "").trim();
  if (!current) return res.status(400).json(fail("Role name required"));

  const parsed = z
    .object({
      newName: z.string().trim().min(2).max(40).optional(),
      permissions: z.record(z.string(), z.string()).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail("Invalid input"));

  const doc = await GarageAdminRole.findOne({ nameLower: current.toLowerCase() });
  if (!doc) return res.status(404).json(fail("Role not found"));

  if (parsed.data.newName !== undefined) {
    const newName = parsed.data.newName.trim();
    if (isReservedRoleName(newName)) {
      return res.status(400).json(fail("That role name is reserved. Pick another."));
    }
    // Collision only counts against a DIFFERENT role; renaming to a different
    // casing of the same name is allowed (and just restyles the label).
    if (newName.toLowerCase() !== doc.nameLower) {
      const clash = await GarageAdminRole.findOne({
        nameLower: newName.toLowerCase(),
      });
      if (clash) {
        return res.status(409).json(fail("A role with that name already exists."));
      }
    }
    doc.name = newName;
    doc.nameLower = newName.toLowerCase();
  }

  if (parsed.data.permissions !== undefined) {
    doc.permissions = sanitizePagePermissions(parsed.data.permissions) as any;
  }

  await doc.save();
  return res.json(ok({ role: doc.name, permissions: doc.permissions }));
}

export async function deleteGarageAdminRole(req: Request, res: Response) {
  const name = String(req.params.name || "").trim();
  if (!name) return res.status(400).json(fail("Role name required"));
  await GarageAdminRole.deleteOne({ nameLower: name.toLowerCase() });
  return res.json(ok({ deleted: name }));
}

export async function listGarageAdminRoles(_req: Request, res: Response) {
  const admins = await GarageAdminModel.find({
    role: { $ne: "garage-super-admin" },
  })
    .select("role pagePermissions updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  const byRole = new Map<
    string,
    { role: string; adminCount: number; permissions: Record<string, string> }
  >();

  for (const admin of admins) {
    const role = String(admin.role || "garage-admin");
    const existing = byRole.get(role);
    if (existing) {
      existing.adminCount += 1;
      continue;
    }
    byRole.set(role, {
      role,
      adminCount: 1,
      // First seen wins — the sort above makes that the most recently
      // updated admin holding the label.
      permissions: resolvePagePermissions(admin.pagePermissions, admin.pagePermissionsSet),
    });
  }

  // Roles defined up front but not yet held by anyone. Merged in so a
  // freshly created role survives a refresh — the bug that motivated
  // giving roles their own collection at all.
  const defined = await GarageAdminRole.find().sort({ name: 1 }).lean();
  for (const d of defined) {
    const existing = byRole.get(String(d.name));
    if (existing) continue;
    byRole.set(String(d.name), {
      role: String(d.name),
      adminCount: 0,
      permissions: resolvePagePermissions(d.permissions as any, true),
    });
  }

  return res.json(ok(Array.from(byRole.values())));
}

/**
 * PATCH /garage-admin/admins/:id/access
 *
 * Re-label a role and/or rewrite its permission map for one admin.
 * Super-admin only (enforced by the route + the gate, since
 * /garage-admin/admins is in SUPER_ONLY_PATTERNS).
 *
 * Takes effect immediately — the gate reads permissions off the document
 * per request, so nobody has to log out and back in.
 */
export async function updateGarageAdminAccess(req: Request, res: Response) {
  const parsed = updateAdminAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("Invalid input"));
  }

  const doc = await GarageAdminModel.findById(req.params.id);
  if (!doc) return res.status(404).json(fail("Admin not found"));

  // A super admin's access isn't a permission map and can't be edited
  // into one — that's the whole boundary this feature rests on.
  if (doc.role === "garage-super-admin") {
    return res
      .status(400)
      .json(fail("Super admin access can't be edited from here"));
  }

  if (parsed.data.role !== undefined) {
    const role = parsed.data.role.trim();
    if (isReservedRoleName(role)) {
      return res
        .status(400)
        .json(fail("That role name is reserved. Pick another."));
    }
    doc.role = role;
  }

  if (parsed.data.permissions !== undefined) {
    doc.set("pagePermissions", sanitizePagePermissions(parsed.data.permissions));
    // From here on this admin's access is exactly what was saved — the
    // legacy fallback no longer applies to them.
    doc.pagePermissionsSet = true;
  }

  await doc.save();

  return res.json(
    ok({
      id: doc._id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
      permissions: resolvePagePermissions(doc.pagePermissions, doc.pagePermissionsSet),
    })
  );
}

/**
 * Apple App Store review account. Apple's reviewers need a working login that
 * doesn't depend on receiving an email/SMS OTP, and must never see real user
 * data. So this one email logs in with a FIXED code, and the frontend puts the
 * whole admin into a demo mode that renders dummy data and never fetches real
 * records (see the demo-mode checks in the web app). The account is a plain
 * delegated admin limited to the Users + Companies sections.
 */
const DEMO_ADMIN_EMAIL = "applereview@yopmail.com";

/** Create the review admin on demand so no manual seeding/deploy step is needed. */
async function ensureDemoAdmin() {
  let admin = await GarageAdminModel.findOne({ email: DEMO_ADMIN_EMAIL });
  if (!admin) {
    admin = await GarageAdminModel.create({
      email: DEMO_ADMIN_EMAIL,
      name: "App Review",
      role: "garage-admin",
      isActive: true,
      // Limited to the Users section the demo page fakes — every other page
      // stays 403 on the API, so even a URL guess can't reach real data.
      pagePermissions: { users: "view" },
      pagePermissionsSet: true,
    } as any);
  }
  return admin;
}

export async function requestGarageAdminOtp(req: Request, res: Response) {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("Invalid input"));
  }
  const { email, isResend } = parsed.data;

  // Apple review account: no real OTP is sent — the fixed code is used.
  if (email === DEMO_ADMIN_EMAIL) {
    await ensureDemoAdmin();
    return res.json(ok({ message: "OTP sent successfully" }));
  }

  const admin = await GarageAdminModel.findOne({ email });
  if (!admin) {
    return res.status(401).json(fail("Invalid credentials"));
  }

  if (!admin.isActive) {
    return res
      .status(403)
      .json(
        fail("Account has been deactivated. Please contact your administrator.")
      );
  }

  console.log("🔍 Creating OTP...");
  const code = await createOtp(email, "garage-admin-login");
  console.log("✅ OTP created:", code);

  console.log("📧 Sending email...");
  await sendMail(
    email,
    "Garage Admin Login OTP",
    `Your Garage Admin login OTP is ${code}`,
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Garage Admin Login</h2>
        <p>Hello ${admin.name},</p>
        <p>Your one-time password is: <strong style="font-size: 18px; color: #FBA70A;">${code}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <br>
        <p>Best regards,<br>Garage Admin Team</p>
      </div>
    `,
    isResend ? EMAIL_FROM_RESEND_OTP : EMAIL_FROM_OTP
  );
  console.log("✅ Email sent");

  return res.json(ok({ message: "OTP sent successfully" }));
}

export async function loginGarageAdmin(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log("❌ Invalid input:", parsed.error);
    return res.status(400).json(fail("Invalid input"));
  }
  const { email, code } = parsed.data;

  console.log("=== GARAGE ADMIN LOGIN DEBUG ===");
  console.log("Email:", email);
  console.log("Code:", code);

  // Apple review account: make sure its admin row exists so the normal login
  // below resolves. The fixed OTP is handled by verifyOtp's STATIC_OTP_ACCOUNTS
  // (services/otp.ts), so no special OTP branch is needed here.
  if (email === DEMO_ADMIN_EMAIL) {
    await ensureDemoAdmin();
  }

  const admin = await GarageAdminModel.findOne({ email });
  console.log("Admin found:", admin ? "Yes" : "No");
  if (admin) {
    console.log("Admin active:", admin.isActive);
    console.log("Admin role:", admin.role);
  }

  if (!admin) {
    console.log("❌ Admin not found");
    return res.status(401).json(fail("Invalid credentials"));
  }

  if (!admin.isActive) {
    console.log("❌ Admin account deactivated");
    return res
      .status(403)
      .json(
        fail("Account has been deactivated. Please contact your administrator.")
      );
  }

  console.log("🔍 Verifying OTP...");
  // Try both garage-admin-login and garage-admin-invite purposes
  let isValidOtp = await verifyOtp(email, code, "garage-admin-login");
  if (isValidOtp === false) {
    isValidOtp = await verifyOtp(email, code, "garage-admin-invite");
  }
  console.log("OTP verification result:", isValidOtp);

  if (isValidOtp === false) {
    console.log("❌ Invalid OTP");
    return res.status(401).json(fail("Invalid OTP"));
  }

  console.log("✅ OTP verified successfully");

  // Update last login
  admin.lastLoginAt = new Date();
  // Step-up attempts are per login: a typo last week must not count
  // against the session starting now. (Set directly rather than through
  // the document, which was loaded without the select:false subtree.)
  // Scoped to admins who actually have questions seeded, so this never
  // conjures a verification subtree onto everyone else.
  await GarageAdminModel.updateOne(
    { _id: admin._id, "verification.questions.0": { $exists: true } },
    { $set: { "verification.failedAttempts": 0 } }
  );
  await admin.save();

  // Safety net for support-chat membership: an admin whose User account was
  // created after their invite (or who missed a sync) is brought in here.
  // Idempotent — two cheap updateManys when there's nothing to do.
  void import("../services/supportChat").then(({ syncAdminSupportMembership }) =>
    syncAdminSupportMembership({ email: admin.email, isActive: admin.isActive })
  );

  const token = signJwt({
    garageAdminId: admin._id.toString(),
    role: admin.role,
    email: admin.email,
  });

  return res.json(
    ok({
      token,
      role: admin.role,
      name: admin.name,
      email: admin.email,
      id: admin._id,
      isSuperAdmin: admin.role === "garage-super-admin",
      // The dashboard shell builds its sidebar off this. It's cached in
      // localStorage with the rest of the admin info, and refreshed from
      // /garage-admin/profile on every layout mount so a revoked page
      // disappears without waiting for the next login.
      permissions: resolvePagePermissions(admin.pagePermissions, admin.pagePermissionsSet),
    })
  );
}

export async function getGarageAdminProfile(req: Request, res: Response) {
  const admin = (req as any).garageAdmin;

  const adminData = await GarageAdminModel.findById(admin.id)
    .populate("invitedBy", "name email")
    .lean();

  if (!adminData) return res.status(404).json(fail("Admin not found"));

  return res.json(
    ok({
      id: adminData._id,
      email: adminData.email,
      name: adminData.name,
      role: adminData.role,
      isSuperAdmin: adminData.role === "garage-super-admin",
      permissions: resolvePagePermissions(adminData.pagePermissions, adminData.pagePermissionsSet),
      isActive: adminData.isActive,
      invitedBy: adminData.invitedBy,
      invitedAt: adminData.invitedAt,
      lastLoginAt: adminData.lastLoginAt,
      createdAt: adminData.createdAt,
    })
  );
}

export async function listGarageAdmins(req: Request, res: Response) {
  // ?activeOnly=true trims out deactivated admins — useful for the
  // Assign-Admin dropdown on the companies table where an inactive
  // admin shouldn't be a valid pick. Default keeps the full list
  // (existing Admin Management surface reads that).
  const activeOnly =
    String(req.query.activeOnly || "").toLowerCase() === "true";
  const filter = activeOnly ? { isActive: true } : {};

  const admins = await GarageAdminModel.find(filter)
    .populate("invitedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  // Fall back to the matching User's photo when the GarageAdmin row has
  // none — which is almost all of them, since a garage admin is a separate
  // record from a person's User account and few ever upload a photo here.
  // Matched by email (both lowercased) in one batched lookup. Admins with
  // no User, or a User with no photo, keep the initials fallback.
  const emails = admins
    .map((a) => String(a.email || "").toLowerCase())
    .filter(Boolean);
  const userPicByEmail = new Map<string, string>();
  if (emails.length) {
    const users = await User.find(
      { email: { $in: emails } },
      { email: 1, profilePicture: 1 },
    ).lean<any[]>();
    for (const u of users) {
      const key = String(u.email || "").toLowerCase();
      if (u.profilePicture) userPicByEmail.set(key, u.profilePicture);
    }
  }

  // `isMe` lets the FE flag the current admin's own row (e.g. show
  // "You" chip next to their name in the Assign dropdown). Pulled off
  // the requireGarageAdminAuth payload the middleware attaches, which
  // keys the id as `id` — not `garageAdminId`, which is the JWT claim.
  const meId = String((req as any).garageAdmin?.id || "");

  return res.json(
    ok(
      admins.map((admin) => ({
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        // Super-admin (shorupan) surfaces here too — same collection,
        // just role="garage-super-admin". FE can filter/label off role.
        isSuperAdmin: admin.role === "garage-super-admin",
        // Drives the "Edit access" sheet on the Admins table. Always a
        // full map, even for rows written before a page key existed.
        permissions: resolvePagePermissions(admin.pagePermissions, admin.pagePermissionsSet),
        isMe: String(admin._id) === meId,
        profilePicture:
          (admin as any).profilePicture ||
          userPicByEmail.get(String(admin.email || "").toLowerCase()) ||
          null,
        isActive: admin.isActive,
        invitedBy: admin.invitedBy,
        invitedAt: admin.invitedAt,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
      }))
    )
  );
}

export async function toggleGarageAdminActive(req: Request, res: Response) {
  const { id } = req.params;

  const doc = await GarageAdminModel.findByIdAndUpdate(
    id,
    [{ $set: { isActive: { $not: "$isActive" } } }],
    { new: true }
  ).lean();

  if (!doc) return res.status(404).json(fail("Admin not found"));

  // Deactivated → out of the support chats; re-activated → back into them.
  void import("../services/supportChat").then(({ syncAdminSupportMembership }) =>
    syncAdminSupportMembership({ email: doc.email, isActive: doc.isActive })
  );

  return res.json(
    ok({
      id: doc._id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
      isActive: doc.isActive,
    })
  );
}

export async function getAllOrganizations(req: Request, res: Response) {
  try {
    const organizations = await Organization.find({})
      .sort({ createdAt: -1 })
      .lean();

    const orgIds = organizations.map((o) => o._id);
    const orgIdStrs = orgIds.map((id) => String(id));

    // ─── Enrichment queries — one round-trip per data source, all
    // keyed off the page's org IDs. Total round-trips: 9 constant.
    // Everything below scales with page size, not org count in the DB
    // (though this endpoint currently returns all orgs, no pagination).
    const [
      founderUsers,
      assignedAdmins,
      proPlan,
      allSubs,
      officeInvoices,
      productCounts,
      productOrderStats,
      commissionStats,
      commissionAffiliates,
      memberCounts,
    ] = await Promise.all([
      // Founders with a founder-role membership in any of these orgs.
      // `phone` added so the Founder Details cell can render the number.
      User.find({
        "organizations.role": "founder",
        "organizations.organization": { $in: orgIds },
      })
        // `referredBy` powers the "Founder's Upline" column — who brought this
        // founder into the network. Resolved to a person below.
        .select("name email phone profilePicture organizations referredBy")
        .lean(),
      // Assigned garage admins (nullable per-org). One query for every
      // admin referenced across the page.
      GarageAdminModel.find({
        _id: {
          $in: organizations
            .map((o) => (o as any).assignedAdminId)
            .filter(Boolean),
        },
      })
        .select("name email profilePicture")
        .lean(),
      // Resolve the Pro plan _id once so we can tell "Paid" orgs from
      // Starter/Basic orgs by checking OfficeSubscription.planId.
      OfficePlan.findOne({ slug: "pro" }).select("_id").lean(),
      // Every OfficeSubscription for these orgs. We hydrate the plan
      // here so status derivation and subscription lifecycle read the
      // slug directly.
      OfficeSubscription.find({ orgId: { $in: orgIds } })
        .populate("planId", "slug name")
        .lean(),
      // Every paid office invoice for these orgs — powers subscription
      // lifecycle (start/last/next payment, cycle, total collected).
      Invoice.find({
        organizationId: { $in: orgIds },
        "metadata.type": {
          $in: ["office_subscription", "office_upgrade", "office_trial"],
        },
        "metadata.planSlug": { $ne: "starter" },
        "metadata.kind": { $ne: "office_free_plan" },
      })
        .select(
          "organizationId totalAmount paymentCurrency itemCurrency invoiceNumber paidAt createdAt status parentInvoiceId nextDueDate metadata",
        )
        .sort({ createdAt: 1 })
        .lean(),
      // Active-product count per org — drives the "Active" status
      // (registered + has products listed).
      Product.aggregate([
        { $match: { organizationId: { $in: orgIds }, status: "active" } },
        { $group: { _id: "$organizationId", count: { $sum: 1 } } },
      ]),
      // Paid product-order totals per org — total sold + total orders +
      // distinct customer count. Handles ecomm + digital via the same
      // ProductOrder collection.
      ProductOrder.aggregate([
        {
          $match: {
            organizationId: { $in: orgIds },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: "$organizationId",
            totalOrders: { $sum: 1 },
            totalSoldMinor: { $sum: "$total" },
            customers: { $addToSet: "$userId" },
          },
        },
        {
          $project: {
            totalOrders: 1,
            totalSoldMinor: 1,
            customersCount: { $size: "$customers" },
          },
        },
      ]),
      // Commission totals per org — platform-fee take + total commissions
      // paid out to affiliates. Both come from the same distribution row
      // so one aggregation covers both revenue columns.
      CommissionDistribution.aggregate([
        {
          $match: {
            orgId: { $in: orgIds },
            status: "completed",
          },
        },
        {
          $group: {
            _id: "$orgId",
            totalCommissionsMinor: { $sum: "$totalCommissionAmount" },
            totalPlatformFeeMinor: { $sum: "$platformFeeAmount" },
          },
        },
      ]),
      // Distinct affiliate userIds per org — unwind the commissions
      // array (one distribution row → N recipients). "Affiliates" =
      // people who earned commission from this org's sales at least
      // once, per the founder's spec.
      CommissionDistribution.aggregate([
        {
          $match: {
            orgId: { $in: orgIds },
            status: "completed",
          },
        },
        { $unwind: "$commissions" },
        {
          $group: {
            _id: "$orgId",
            affiliates: { $addToSet: "$commissions.userId" },
          },
        },
        {
          $project: {
            affiliatesCount: { $size: "$affiliates" },
          },
        },
      ]),
      // Members per org — every user with ANY membership in the org
      // (any role). Uses the modern `organizations[]` array; users who
      // only have the deprecated legacy `organization` field aren't
      // included.
      User.aggregate([
        { $match: { "organizations.organization": { $in: orgIds } } },
        { $unwind: "$organizations" },
        {
          $match: {
            "organizations.organization": { $in: orgIds },
          },
        },
        {
          $group: {
            _id: "$organizations.organization",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Who referred each founder — the "Founder's Upline" column. One query for
    // every founder's sponsor rather than a lookup per row; a founder with no
    // referrer (the global root, or an account created before attribution)
    // simply has none, which the column renders as a dash.
    const uplineIds = Array.from(
      new Set(
        founderUsers
          .map((u: any) => (u.referredBy ? String(u.referredBy) : null))
          .filter((id): id is string => !!id),
      ),
    ).map((id) => new Types.ObjectId(id));
    const uplineUsers = uplineIds.length
      ? await User.find({ _id: { $in: uplineIds } })
          .select("name email profilePicture affiliateId")
          .lean()
      : [];
    const uplineById = new Map(uplineUsers.map((u: any) => [String(u._id), u]));

    // ─── Index everything by orgId string for O(1) lookup in the map.
    const orgFounderMap = new Map<
      string,
      Array<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        profilePicture: string | null;
        upline: {
          id: string;
          name: string;
          email: string | null;
          profilePicture: string | null;
          affiliateId: string | null;
        } | null;
      }>
    >();
    for (const u of founderUsers) {
      for (const m of (u.organizations as any[]) || []) {
        if (m.role !== "founder") continue;
        const orgId = m.organization?.toString();
        if (!orgId || !orgIdStrs.includes(orgId)) continue;
        const list = orgFounderMap.get(orgId) || [];
        const up = (u as any).referredBy
          ? uplineById.get(String((u as any).referredBy))
          : null;
        list.push({
          id: (u._id as any).toString(),
          name: (u as any).name || "",
          email: (u as any).email,
          phone: (u as any).phone || null,
          profilePicture: (u as any).profilePicture || null,
          upline: up
            ? {
                id: String(up._id),
                name: up.name || "",
                email: up.email ?? null,
                profilePicture: up.profilePicture ?? null,
                affiliateId: up.affiliateId ?? null,
              }
            : null,
        });
        orgFounderMap.set(orgId, list);
      }
    }

    const assignedAdminById = new Map(
      assignedAdmins.map((a: any) => [String(a._id), a]),
    );

    const subsByOrg = new Map<string, any[]>();
    for (const s of allSubs) {
      const key = String((s as any).orgId);
      const arr = subsByOrg.get(key) || [];
      arr.push(s);
      subsByOrg.set(key, arr);
    }

    const invoicesByOrg = new Map<string, any[]>();
    for (const inv of officeInvoices) {
      const key = String((inv as any).organizationId);
      const arr = invoicesByOrg.get(key) || [];
      arr.push(inv);
      invoicesByOrg.set(key, arr);
    }

    const productCountByOrg = new Map<string, number>(
      productCounts.map((r: any) => [String(r._id), r.count]),
    );
    const orderStatsByOrg = new Map<string, any>(
      productOrderStats.map((r: any) => [String(r._id), r]),
    );
    const commissionStatsByOrg = new Map<string, any>(
      commissionStats.map((r: any) => [String(r._id), r]),
    );
    const affiliatesByOrg = new Map<string, number>(
      commissionAffiliates.map((r: any) => [String(r._id), r.affiliatesCount]),
    );
    const membersByOrg = new Map<string, number>(
      memberCounts.map((r: any) => [String(r._id), r.count]),
    );

    const proPlanId = proPlan ? String(proPlan._id) : null;

    // ?plan=paid|free — the Paid Companies / Free Companies tables.
    //
    // "Paid" = has at least one PAID invoice on a paid office plan. It is the
    // exact test `paymentsCount` below uses (paid-plan invoices, status paid),
    // so a company's table and its Payments column can never disagree.
    //
    // Everything else is "free": the $0 Starter plan, no invoice at all, or a
    // paid-plan invoice that was never paid (draft / expired / pending). A
    // company that paid once and has since lapsed stays in PAID — its revenue
    // and overdue renewal belong there, and the status / Next Payment columns
    // already show it is no longer current.
    //
    // Every company lands in exactly one of the two. No param = all, unchanged.
    const planParam = String(req.query.plan || "").toLowerCase();
    const hasPaidPlanPayment = (orgId: string) =>
      (invoicesByOrg.get(orgId) || []).some(
        (i: any) => String(i.status).toLowerCase() === "paid",
      );
    const scopedOrganizations =
      planParam === "paid"
        ? organizations.filter((o) => hasPaidPlanPayment(String(o._id)))
        : planParam === "free"
          ? organizations.filter((o) => !hasPaidPlanPayment(String(o._id)))
          : organizations;

    return res.json(
      ok(
        scopedOrganizations.map((org) => {
          const orgId = String(org._id);
          const orgAny = org as any;

          // ─── Company status: paid / active / registered ───────────
          // Founder's rule:
          //   paid       — has an active Pro OfficeSubscription
          //   active     — no Pro sub, but has ≥1 active product listed
          //   registered — no Pro sub and no products
          const subs = subsByOrg.get(orgId) || [];
          const activePaidProSub = subs.find(
            (s: any) =>
              proPlanId &&
              String(s.planId?._id ?? s.planId) === proPlanId &&
              ["active", "authenticated"].includes(s.status) &&
              !s.isTrial,
          );
          const hasProducts = (productCountByOrg.get(orgId) || 0) > 0;
          const status: "paid" | "active" | "registered" = activePaidProSub
            ? "paid"
            : hasProducts
              ? "active"
              : "registered";

          // ─── Subscription lifecycle (Pro invoices only) ───────────
          // Chain root = the recurring parent (parentInvoiceId unset),
          // children = all cycle invoices. Ordered by createdAt ASC
          // (per the query) so [0] is the first invoice.
          const orgInvoices = invoicesByOrg.get(orgId) || [];
          const paidOrgInvoices = orgInvoices.filter(
            (i: any) => String(i.status).toLowerCase() === "paid",
          );
          const parentInvoice =
            orgInvoices.find(
              (i: any) => !i.parentInvoiceId,
            ) || null;
          const lastPaid = paidOrgInvoices[paidOrgInvoices.length - 1] || null;
          const totalCollectedUsd = paidOrgInvoices.reduce(
            (sum: number, i: any) => sum + (i.totalAmount || 0) / 100,
            0,
          );
          const paymentsCount = paidOrgInvoices.length;

          // Subscription's current cycle end — used for "next payment
          // date". Comes from the active sub if present, else from the
          // parent invoice's nextDueDate.
          const nextDueDate =
            activePaidProSub?.currentEnd ||
            (parentInvoice ? (parentInvoice as any).nextDueDate : null) ||
            null;

          // ─── Revenue aggregations ─────────────────────────────────
          const orderStats = orderStatsByOrg.get(orgId);
          const commissionStat = commissionStatsByOrg.get(orgId);
          const totalSoldUsd = orderStats
            ? (orderStats.totalSoldMinor || 0) / 100
            : 0;
          const totalOrders = orderStats?.totalOrders || 0;
          const commissionsPaidUsd = commissionStat
            ? (commissionStat.totalCommissionsMinor || 0) / 100
            : 0;
          const totalCollectedFromFeesUsd = commissionStat
            ? (commissionStat.totalPlatformFeeMinor || 0) / 100
            : 0;

          // ─── Counts ───────────────────────────────────────────────
          const membersCount = membersByOrg.get(orgId) || 0;
          const customersCount = orderStats?.customersCount || 0;
          const affiliatesCount = affiliatesByOrg.get(orgId) || 0;

          // ─── Assigned admin ───────────────────────────────────────
          const assignedAdmin = orgAny.assignedAdminId
            ? assignedAdminById.get(String(orgAny.assignedAdminId))
            : null;

          return {
            id: org._id,
            name: org.name,
            size: org.size,
            location: org.location,
            city: org.city,
            state: org.state,
            country: org.country,
            latitude: org.latitude,
            longitude: org.longitude,
            parent: org.parent,
            description: org.description,
            headingText: org.headingText,
            subHeadingText: org.subHeadingText,
            icon: org.icon,
            coverPhoto: org.coverPhoto,
            promoVideoLink: org.promoVideoLink,
            founders: orgFounderMap.get(orgId) || [],
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
            // KYC state, mirrored onto the Organization by
            // services/orgKyc.service.ts. Absent on offices nobody has asked
            // anything of yet — the table renders that as "—".
            kycStatus: orgAny.kycStatus || "not_requested",
            kycVerifiedAt: orgAny.kycVerifiedAt || null,

            // ── New fields (companies-table columns) ────────────────
            status, // "paid" | "active" | "registered"
            assignedTo: assignedAdmin
              ? {
                  id: assignedAdmin._id,
                  name: (assignedAdmin as any).name || null,
                  email: (assignedAdmin as any).email || null,
                  profilePicture:
                    (assignedAdmin as any).profilePicture || null,
                  assignedAt: orgAny.assignedAt || null,
                }
              : null,
            subscription: {
              planSlug: activePaidProSub
                ? "pro"
                : subs[0]?.planId?.slug || null,
              startedAt: parentInvoice
                ? (parentInvoice as any).paidAt ||
                  (parentInvoice as any).createdAt
                : null,
              startInvoice: parentInvoice
                ? {
                    invoiceNumber: (parentInvoice as any).invoiceNumber,
                    paidAt: (parentInvoice as any).paidAt || null,
                  }
                : null,
              lastPayment: lastPaid
                ? {
                    invoiceNumber: (lastPaid as any).invoiceNumber,
                    paidAt:
                      (lastPaid as any).paidAt || (lastPaid as any).createdAt,
                  }
                : null,
              nextPaymentDate: nextDueDate,
              paymentsCount,
              // Cycle = # of payments made (matches networkchain-subs).
              cycle: paymentsCount,
              totalCollectedUsd,
            },
            counts: {
              members: membersCount,
              customers: customersCount,
              affiliates: affiliatesCount,
              totalOrders,
            },
            revenue: {
              totalSoldUsd,
              // Platform fee % from paymentConfig (default 5 when unset,
              // 10 for Starter orgs). Surfaced as-is so the FE can
              // render "5%" / "10%" + a Change button.
              platformFeePercentage:
                orgAny.paymentConfig?.platformFeePercentage ?? null,
              totalCollectedFromFeesUsd,
              commissionsPaidUsd,
              // Franchise payouts driven by TerritoryWalletTransaction.
              // Attribution back to the SELLER org isn't stored on the
              // transaction row (only franchiseOfficeId, which is the
              // FOUNDER-program office, not the seller). Leaving this at
              // 0 until a seller-org link is added — mis-reporting the
              // number would be worse than reporting 0.
              franchisePayoutsUsd: 0,
            },
          };
        }),
      ),
    );
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json(fail("Failed to fetch organizations"));
  }
}

export async function getOrganizationById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const organization = await Organization.findById(id).lean();

    if (!organization) {
      return res.status(404).json(fail("Organization not found"));
    }

    // Fetch floors for this organization
    const floors = await Floor.find({ orgId: id }).sort({ level: 1 }).lean();

    // Fetch users for this organization
    const users = await User.find({
      $or: [
        { organization: id }, // Legacy field
        { "organizations.organization": id }, // New field
      ],
    })
      .select(
        "name email role organizations floorId department isVerified createdAt"
      )
      .lean();

    return res.json(
      ok({
        id: organization._id,
        name: organization.name,
        size: organization.size,
        location: organization.location,
        city: organization.city,
        state: organization.state,
        country: organization.country,
        latitude: organization.latitude,
        longitude: organization.longitude,
        parent: organization.parent,
        description: organization.description,
        headingText: organization.headingText,
        subHeadingText: organization.subHeadingText,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        promoVideoLink: organization.promoVideoLink,
        floors: floors.map((floor) => ({
          id: floor._id,
          level: floor.level,
          name: floor.name,
          departments: floor.departments,
          createdAt: floor.createdAt,
          updatedAt: floor.updatedAt,
        })),
        users: users.map((user) => {
          // Determine floorId for this specific org: prefer membership's floorId, fallback to legacy
          let userFloorId: any = (user as any).floorId || null;
          if (Array.isArray((user as any).organizations)) {
            const membership = (user as any).organizations.find(
              (m: any) => m.organization?.toString() === id
            );
            if (membership?.floorId) userFloorId = membership.floorId;
          }

          return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            floorId: userFloorId,
            department: user.department,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
          };
        }),
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      })
    );
  } catch (error) {
    console.error("Error fetching organization:", error);
    return res.status(500).json(fail("Failed to fetch organization"));
  }
}

/**
 * POST /garage-admin/organizations/:id/assign-admin
 * Assigns (or reassigns) a garage admin to an organization. Powers the
 * "Assigned To" column's Assign/Change button on the companies table.
 *
 * Body: { adminId: string | null }
 *   - adminId set  → assigns that admin (validates the id exists)
 *   - adminId null → clears the assignment (unassign)
 *
 * Super-admin only — enforced at the route layer.
 */
export async function assignAdminToOrganization(
  req: Request,
  res: Response,
) {
  try {
    const { id: orgId } = req.params;
    const { adminId } = z
      .object({ adminId: z.string().nullable() })
      .parse(req.body);

    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json(fail("Invalid org id"));
    }

    const org = await Organization.findById(orgId).select("_id name").lean();
    if (!org) {
      return res.status(404).json(fail("Organization not found"));
    }

    // The garage admin performing the action (from requireGarageAdminAuth).
    const actingAdminId = (req as any).garageAdmin?.garageAdminId;

    if (adminId === null) {
      // Unassign — clear the three assignment fields together.
      await Organization.updateOne(
        { _id: orgId },
        {
          $unset: {
            assignedAdminId: 1,
            assignedAt: 1,
            assignedBy: 1,
          },
        },
      );
      return res.json(
        ok({
          orgId,
          assignedTo: null,
        }),
      );
    }

    if (!Types.ObjectId.isValid(adminId)) {
      return res.status(400).json(fail("Invalid admin id"));
    }
    const admin = await GarageAdminModel.findById(adminId)
      .select("_id name email profilePicture isActive")
      .lean();
    if (!admin) {
      return res.status(404).json(fail("Garage admin not found"));
    }
    if ((admin as any).isActive === false) {
      return res
        .status(400)
        .json(fail("Cannot assign an inactive garage admin"));
    }

    const now = new Date();
    await Organization.updateOne(
      { _id: orgId },
      {
        $set: {
          assignedAdminId: new Types.ObjectId(adminId),
          assignedAt: now,
          ...(actingAdminId
            ? { assignedBy: new Types.ObjectId(String(actingAdminId)) }
            : {}),
        },
      },
    );

    return res.json(
      ok({
        orgId,
        assignedTo: {
          id: admin._id,
          name: (admin as any).name || null,
          email: (admin as any).email || null,
          profilePicture: (admin as any).profilePicture || null,
          assignedAt: now,
        },
      }),
    );
  } catch (error) {
    console.error("Error assigning admin to organization:", error);
    return res.status(500).json(fail("Failed to assign admin"));
  }
}

export async function getAllFounders(req: Request, res: Response) {
  try {
    // Fetch all users with founder role across all organizations.
    // `profilePicture` + `referredBy` added to the projection so the
    // header cell can render an avatar and the upline column can be
    // filled without a second round-trip per row.
    // Organization populate now also pulls `icon` so the FE can render
    // the little org-logo chip in the joining-date cell.
    const founders = await User.find({
      $or: [
        { role: "founder" }, // Legacy field
        { "organizations.role": "founder" }, // New field
      ],
    })
      .populate("organization", "name icon")
      .populate("organizations.organization", "name icon")
      .select(
        "name email role organizations floorId department isVerified createdAt country state city phone latitude longitude profileComplete affiliateId profilePicture referredBy"
      )
      .lean();

    // Batch enrichment — three parallel queries keyed off the founder
    // IDs we just fetched. Doing this once per page (vs. per row) keeps
    // the endpoint constant-time in the # of founders.
    const founderIds = founders.map((f) => f._id).filter(Boolean);
    const uplineIds = Array.from(
      new Set(
        founders
          .map((f) => (f as any).referredBy)
          .filter((id: any) => !!id)
          .map((id: any) => String(id))
      )
    );

    const [uplineDocs, proPlan, activeProSubs, paidOfficeInvoices] =
      await Promise.all([
        uplineIds.length
          ? User.find({ _id: { $in: uplineIds } })
              .select("name email phone profilePicture country")
              .lean()
          : Promise.resolve([]),
        OfficePlan.findOne({ slug: "pro" }).select("_id").lean(),
        // Active Pro office subscriptions per founder. `founderId` on
        // OfficeSubscription is the Pro payer — matches this endpoint's
        // definition of "premium subscriptions" (paid Pro office subs).
        OfficeSubscription.find({
          founderId: { $in: founderIds },
          status: { $in: ["active", "authenticated"] },
          isTrial: { $ne: true },
        })
          .select("founderId planId")
          .lean(),
        // Every paid office-subscription invoice this founder paid for
        // (Pro plan + Pro upgrades). Free-plan invoices excluded via
        // metadata.planSlug so a Starter founder's $0 rows don't inflate
        // the "commercials" total.
        Invoice.find({
          userId: { $in: founderIds },
          status: "paid",
          "metadata.type": {
            $in: ["office_subscription", "office_upgrade"],
          },
          "metadata.planSlug": { $ne: "starter" },
          "metadata.kind": { $ne: "office_free_plan" },
        })
          .select("userId totalAmount paymentCurrency itemCurrency invoiceNumber paidAt")
          .lean(),
      ]);

    const uplinesById = new Map(
      uplineDocs.map((u: any) => [String(u._id), u])
    );
    const proPlanId = proPlan ? String(proPlan._id) : null;

    // Group Pro subs by founder — only count those actually pointed at
    // the Pro plan doc, so a legacy Basic sub in the same status set
    // doesn't sneak in.
    const proSubsByFounder = new Map<string, number>();
    for (const sub of activeProSubs) {
      if (!proPlanId) break;
      if (String((sub as any).planId) !== proPlanId) continue;
      const key = String((sub as any).founderId);
      proSubsByFounder.set(key, (proSubsByFounder.get(key) || 0) + 1);
    }

    // Group invoices by founder. `totalAmount` on Invoice is stored in
    // MINOR units (cents/paise) — divide by 100 for the display USD amt.
    const invoicesByFounder = new Map<string, any[]>();
    for (const inv of paidOfficeInvoices) {
      const key = String((inv as any).userId);
      const arr = invoicesByFounder.get(key) || [];
      arr.push({
        amount: ((inv as any).totalAmount || 0) / 100,
        currency:
          (inv as any).paymentCurrency ||
          (inv as any).itemCurrency ||
          "USD",
        invoiceNumber: (inv as any).invoiceNumber,
        paidAt: (inv as any).paidAt || null,
      });
      invoicesByFounder.set(key, arr);
    }

    return res.json(
      ok(
        founders.map((founder) => {
          const founderKey = String(founder._id);
          const uplineDoc = (founder as any).referredBy
            ? uplinesById.get(String((founder as any).referredBy))
            : null;
          const commercialsList = invoicesByFounder.get(founderKey) || [];
          const totalUsd = commercialsList.reduce(
            (sum: number, c: any) => sum + (c.amount || 0),
            0,
          );

          return {
            id: founder._id,
            name: founder.name,
            email: founder.email,
            profilePicture: (founder as any).profilePicture || null,
            role: founder.role,
            // Deprecated root floorId; organization-specific floorId is returned per membership below
            floorId: undefined,
            department: founder.department,
            isVerified: founder.isVerified,
            country: founder.country,
            state: founder.state,
            city: founder.city,
            phone: founder.phone,
            latitude: founder.latitude,
            longitude: founder.longitude,
            profileComplete: founder.profileComplete,
            affiliateId: founder.affiliateId,
            // Upline (who referred this founder) — null when the founder
            // signed up without a referral. Same shape as buyer/upline
            // used elsewhere in garage-admin for consistency.
            upline: uplineDoc
              ? {
                  userId: uplineDoc._id,
                  name: uplineDoc.name || null,
                  email: uplineDoc.email || null,
                  phone: uplineDoc.phone || null,
                  profilePicture: uplineDoc.profilePicture || null,
                  country: uplineDoc.country || null,
                }
              : null,
            // Count of ACTIVE paid Pro office subscriptions this founder
            // holds. Excludes trials + Starter free plan.
            premiumSubscriptionsCount: proSubsByFounder.get(founderKey) || 0,
            // What this founder has actually paid Garage for their
            // office subscription(s). `totalUsd` backs the summary
            // number in the Commercials column; the array is the
            // drill-down (each row = one paid office invoice).
            commercials: {
              totalUsd,
              items: commercialsList,
            },
            // Only surface orgs where THIS user actually holds a founder
            // membership — matches the page title's intent. Without this
            // filter the list also included orgs where the founder is a
            // stakeholder or guest (e.g. onboarded as a customer via
            // checkout), which made the page misleading.
            organizations: founder.organizations
              ?.filter((org: any) => org.role === "founder")
              .map((org: any) => ({
                id: org.organization?._id || null,
                name: org.organization?.name || "Unknown Organization",
                icon: org.organization?.icon || null,
                role: org.role,
                joinedAt: org.joinedAt,
                floorId: org.floorId || null,
              }))
              .filter((org: any) => org.id !== null),
            legacyOrganization: founder.organization,
            createdAt: founder.createdAt,
          };
        })
      )
    );
  } catch (error) {
    console.error("Error fetching founders:", error);
    return res.status(500).json(fail("Failed to fetch founders"));
  }
}

export async function getAllStakeholders(req: Request, res: Response) {
  try {
    // Fetch all users with stakeholder role across all organizations
    const stakeholders = await User.find({
      $or: [
        { role: "stakeholder" }, // Legacy field
        { "organizations.role": "stakeholder" }, // New field
      ],
    })
      .populate("organization", "name")
      .populate("organizations.organization", "name")
      .select(
        "name email role organizations floorId department isVerified createdAt country state city phone latitude longitude profileComplete affiliateId"
      )
      .lean();

    return res.json(
      ok(
        stakeholders.map((stakeholder) => ({
          id: stakeholder._id,
          name: stakeholder.name,
          email: stakeholder.email,
          role: stakeholder.role,
          // Deprecated root floorId; organization-specific floorId is returned per membership below
          floorId: undefined,
          department: stakeholder.department,
          isVerified: stakeholder.isVerified,
          country: stakeholder.country,
          state: stakeholder.state,
          city: stakeholder.city,
          phone: stakeholder.phone,
          latitude: stakeholder.latitude,
          longitude: stakeholder.longitude,
          profileComplete: stakeholder.profileComplete,
          affiliateId: stakeholder.affiliateId,
          organizations: stakeholder.organizations
            ?.map((org: any) => ({
              id: org.organization?._id || null,
              name: org.organization?.name || "Unknown Organization",
              role: org.role,
              joinedAt: org.joinedAt,
              floorId: org.floorId || null,
            }))
            .filter((org: any) => org.id !== null),
          legacyOrganization: stakeholder.organization,
          createdAt: stakeholder.createdAt,
        }))
      )
    );
  } catch (error) {
    console.error("Error fetching stakeholders:", error);
    return res.status(500).json(fail("Failed to fetch stakeholders"));
  }
}

// ── Users → wallets → payout accounts (super-admin, view-only) ──────────────

/**
 * GET /garage-admin/users?search=&skip=&limit=
 * Paginated list of all users with their offices (org memberships).
 */
export async function listAllUsers(req: Request, res: Response) {
  try {
    const search = (req.query.search as string)?.trim() || "";
    const skip = Math.max(0, parseInt((req.query.skip as string) || "0", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "30", 10)));
    // Default: hide users who have already activated the $25 UnilevelPlus
    // sub. Founder's ask is a prospecting view — "only the people who have
    // not taken the $25 sub". Escape hatch for future admin views:
    // `?includeActivated=true` widens to everyone.
    const includeActivated =
      req.query.includeActivated === "true" ||
      req.query.includeActivated === "1";

    const filter: any = {};
    if (!includeActivated) {
      filter["typeFlags.oneNetworkActivated"] = { $ne: true };
    }
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    /**
     * Per-column filters from the admin table.
     *
     * Applied HERE rather than in the browser because this endpoint paginates:
     * the client only ever holds one page, so filtering there would search
     * ~30 of 1,900 users and look broken the moment a match sat on page 2.
     *
     * Only columns backed by a stored field are supported. The computed ones
     * (purchase volume, commissions, downline counts) are assembled per row
     * after this query, so filtering them would need a different pipeline
     * entirely — the table hides their filter affix instead of offering one
     * that does nothing.
     */
    const rxOf = (v: string) =>
      new RegExp(v.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const fName = (req.query.fName as string)?.trim();
    if (fName) {
      const rx = rxOf(fName);
      // AND-ed with `search` above rather than overwriting its $or.
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ name: rx }, { email: rx }, { phone: rx }] },
      ];
    }

    const fLocation = (req.query.fLocation as string)?.trim();
    if (fLocation) {
      const rx = rxOf(fLocation);
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ country: rx }, { state: rx }, { city: rx }] },
      ];
    }

    const fActivated = (req.query.fActivated as string)?.trim().toLowerCase();
    if (fActivated) {
      // Matches the words the column renders, so typing what you see works.
      if ("activated".startsWith(fActivated) || fActivated === "yes") {
        filter["typeFlags.oneNetworkActivated"] = true;
      } else if (
        "not activated".startsWith(fActivated) ||
        fActivated === "no" ||
        fActivated === "inactive"
      ) {
        filter["typeFlags.oneNetworkActivated"] = { $ne: true };
      }
    }

    // Open View / "view as" (?rootUserId=) — narrow to that user's DOWNLINE
    // (their referral sub-tree), so the admin can see the users table from that
    // person's perspective. `ancestors` is the materialized, indexed upline
    // path — everyone with rootUserId in their ancestors is in that user's
    // downline.
    const rootUserId = (req.query.rootUserId as string)?.trim();
    if (rootUserId && Types.ObjectId.isValid(rootUserId)) {
      filter.ancestors = new Types.ObjectId(rootUserId);
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate("organizations.organization", "name slug icon colored_icon")
        .select(
          "name email phone profilePicture affiliateId organizations createdAt " +
            "country state city typeFlags profileCompletedAt referredBy " +
            "directsCount downlineCount " +
            // Verification + profile state. The admin table's delete action
            // distinguishes verified from unverified accounts, so the
            // operator has to be able to tell them apart before selecting.
            "isVerified phoneVerified profileComplete " +
            "offerExpiresAtOverride offerExtendedAt offerExtendedByAdminId",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // ── Batched enrichment for the page (six queries total, page-sized) ──
    const pageIds = users.map((u: any) => u._id);
    const uplineIds = users
      .map((u: any) => u.referredBy)
      .filter((id: any) => !!id);

    const [upDocs, upPurchases, invoiceAgg, productAgg, commissionAgg] =
      await Promise.all([
        uplineIds.length
          ? User.find({ _id: { $in: uplineIds } })
              .select("_id name email phone profilePicture")
              .lean<any[]>()
          : Promise.resolve([] as any[]),
        pageIds.length
          ? UnilevelPlusPurchase.find({
              userId: { $in: pageIds },
              status: "active",
            })
              .select("userId purchasedAt")
              .lean<Array<{ userId: any; purchasedAt: Date }>>()
          : Promise.resolve([]),
        pageIds.length
          ? Invoice.aggregate([
              {
                $match: {
                  userId: { $in: pageIds },
                  status: "paid",
                  cancelledAt: { $in: [null, undefined] },
                  // Onboarding records ("Welcome To Garage", "For Affiliates")
                  // are paid $0 invoices — 85% of all paid invoices. Counting
                  // them made a member who bought one item read as
                  // "3 Purchases".
                  totalAmount: { $gt: 0 },
                },
              },
              {
                // Currency is part of the key: `totalAmount` is minor units of
                // `itemCurrency`, so paise and cents must not be summed
                // together. See utils/invoiceMoney.ts.
                $group: {
                  _id: { u: "$userId", c: "$itemCurrency" },
                  minor: { $sum: "$totalAmount" },
                  purchaseCount: { $sum: 1 },
                },
              },
            ])
          : Promise.resolve([] as any[]),
        pageIds.length
          ? ProductOrder.aggregate([
              {
                $match: {
                  userId: { $in: pageIds },
                  paymentStatus: "paid",
                },
              },
              { $group: { _id: "$userId", productCount: { $sum: 1 } } },
            ])
          : Promise.resolve([] as any[]),
        pageIds.length
          ? CommissionDistribution.aggregate([
              { $match: { customerId: { $in: pageIds } } },
              {
                $group: {
                  _id: "$customerId",
                  totalUsd: { $sum: "$totalCommissionAmount" },
                  count: { $sum: 1 },
                },
              },
            ])
          : Promise.resolve([] as any[]),
      ]);

    const upMap = new Map<string, any>();
    for (const u of upDocs) upMap.set(String(u._id), u);
    const upByUserId = new Map<string, any>();
    for (const p of upPurchases as any[]) upByUserId.set(String(p.userId), p);
    // Fold the per-currency rows into one USD figure per user. Converting
    // BEFORE adding is the whole point — summing paise onto cents and dividing
    // by 100 afterwards is what showed a ₹234.82 bottle of chilli sauce as
    // $234.82. See utils/invoiceMoney.ts.
    const fxRates = await usdRates();
    const invByUserId = new Map<string, { volumeUsd: number; purchaseCount: number }>();
    for (const a of invoiceAgg as any[]) {
      const uid = String(a._id?.u ?? a._id);
      const prev = invByUserId.get(uid) || { volumeUsd: 0, purchaseCount: 0 };
      prev.volumeUsd += minorToUsd(a.minor || 0, a._id?.c, fxRates);
      prev.purchaseCount += a.purchaseCount || 0;
      invByUserId.set(uid, prev);
    }
    for (const v of invByUserId.values()) v.volumeUsd = Math.round(v.volumeUsd * 100) / 100;
    const prodByUserId = new Map<string, any>();
    for (const a of productAgg as any[]) prodByUserId.set(String(a._id), a);
    const commByUserId = new Map<string, any>();
    for (const a of commissionAgg as any[]) commByUserId.set(String(a._id), a);

    const now = new Date();

    const items = users.map((u: any) => {
      const uid = String(u._id);
      const upline = u.referredBy
        ? upMap.get(String(u.referredBy)) || null
        : null;

      // 24-hour welcome-offer status. `comboWindowFor` handles the fail-safe
      // "no profileCompletedAt → closed" case internally, and honors an admin
      // extension via `offerExpiresAtOverride`. `completed` = the user
      // activated UP inside their effective window.
      const w = comboWindowFor(
        {
          profileCompletedAt: u.profileCompletedAt,
          offerExpiresAtOverride: u.offerExpiresAtOverride,
        },
        now,
      );
      // "Extended" = the admin-set override is what's driving the current
      // expiry (either extended into the future OR extended a lapsed window
      // back open). Absent when only the natural rule is in play.
      const extendedByAdmin =
        !!u.offerExpiresAtOverride &&
        !!w.expiresAt &&
        new Date(u.offerExpiresAtOverride).getTime() >= w.expiresAt.getTime();
      const upPurchase = upByUserId.get(uid);
      const activatedInsideWindow =
        !!upPurchase &&
        !!w.startsAt &&
        !!w.expiresAt &&
        new Date(upPurchase.purchasedAt).getTime() <= w.expiresAt.getTime();
      // Shared with the downline surface via `comboWindowStatus` so the two
      // can never drift; the admin response keeps its pre-existing "pending"
      // label for an open window (the new shared enum calls it "open").
      const status =
        comboWindowStatus(w, { upPurchasedAt: upPurchase?.purchasedAt }) === "open"
          ? "pending"
          : comboWindowStatus(w, { upPurchasedAt: upPurchase?.purchasedAt });

      const inv = invByUserId.get(uid);
      const prod = prodByUserId.get(uid);
      const comm = commByUserId.get(uid);

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        profilePicture: u.profilePicture || null,
        affiliateId: u.affiliateId || null,
        isVerified: !!u.isVerified,
        phoneVerified: !!u.phoneVerified,
        profileComplete: !!u.profileComplete,
        location: {
          country: u.country || null,
          state: u.state || null,
          city: u.city || null,
        },
        upline: upline
          ? {
              userId: String(upline._id),
              name: upline.name || null,
              email: upline.email || null,
              phone: upline.phone || null,
              profilePicture: upline.profilePicture || null,
            }
          : null,
        offices: (u.organizations || [])
          .map((m: any) => ({
            id: m.organization?._id || null,
            name: m.organization?.name || "Unknown",
            role: m.role,
            // Org logo for the admin table's office chips (icon = square logo).
            logo: m.organization?.icon || m.organization?.colored_icon || null,
          }))
          .filter((o: any) => o.id !== null),
        createdAt: u.createdAt,
        typeFlags: u.typeFlags || {},
        directsCount: u.directsCount ?? 0,
        downlineCount: u.downlineCount ?? 0,
        twentyFourHourOffer: {
          windowStartsAt: w.startsAt,
          windowExpiresAt: w.expiresAt,
          windowOpen: w.open,
          secondsRemaining: w.secondsRemaining,
          completed: activatedInsideWindow,
          status,
          extendedByAdmin,
          extendedAt: u.offerExtendedAt || null,
          extendedByAdminId: u.offerExtendedByAdminId
            ? String(u.offerExtendedByAdminId)
            : null,
        },
        purchases: {
          volumeUsd: inv ? inv.volumeUsd : 0,
          purchaseCount: inv ? inv.purchaseCount || 0 : 0,
          productCount: prod ? prod.productCount || 0 : 0,
        },
        commissionsGenerated: {
          totalUsd: comm ? comm.totalUsd || 0 : 0,
          count: comm ? comm.count || 0 : 0,
        },
      };
    });

    return res.json(
      ok({ items, total, skip, limit, hasMore: skip + items.length < total })
    );
  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json(fail("Failed to list users"));
  }
}

/**
 * GET /garage-admin/users/:userId/purchases
 *
 * Drill-down for the "N Purchases →" column on `/garage-admin/users`. Lists
 * every paid invoice this user (as buyer) has settled EXCEPT the ones
 * primarily selling a product — those live on the sibling
 * `/products` endpoint. Paginated, newest paid first.
 */
export async function listUserPurchases(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json(fail("Invalid user id"));
    }
    const uid = new Types.ObjectId(userId);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || "25", 10)),
    );

    const filter: any = {
      userId: uid,
      status: "paid",
      cancelledAt: { $in: [null, undefined] },
      // Exclude invoices whose primary line item is a product — those are
      // surfaced by `listUserPurchasedProducts` (drives the "N Products →"
      // drill-down instead). Same product invoice would otherwise appear
      // twice across the two admin drawers.
      "lineItems.0.itemType": { $ne: "product" },
    };

    const [rows, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ paidAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "_id invoiceNumber lineItems totalAmount itemCurrency paidAt organizationId",
        )
        .lean<any[]>(),
      Invoice.countDocuments(filter),
    ]);

    // Batch-populate org info for the page.
    const orgIds = Array.from(
      new Set(rows.map((r: any) => String(r.organizationId)).filter(Boolean)),
    );
    const orgs = orgIds.length
      ? await Organization.find({
          _id: { $in: orgIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id name icon slug")
          .lean<any[]>()
      : [];
    const orgMap = new Map<string, any>();
    for (const o of orgs) orgMap.set(String(o._id), o);

    const items = rows.map((r: any) => {
      const primary = r.lineItems?.[0] || {};
      const org = orgMap.get(String(r.organizationId));
      return {
        invoiceId: String(r._id),
        invoiceNumber: r.invoiceNumber,
        itemType: primary.itemType || null,
        itemId: primary.itemId ? String(primary.itemId) : null,
        itemName: primary.itemName || null,
        itemImage: primary.itemImage || null,
        unitPrice: primary.unitPrice ?? null,
        quantity: primary.quantity ?? null,
        totalPrice: primary.totalPrice ?? null,
        amountUsd:
          typeof r.totalAmount === "number" ? r.totalAmount / 100 : null,
        currency: r.itemCurrency || "USD",
        orgId: org ? String(org._id) : null,
        orgName: org?.name || null,
        orgIcon: org?.icon || null,
        orgSlug: org?.slug || null,
        paidAt: r.paidAt || null,
      };
    });

    return res.json(
      ok({
        items,
        page,
        limit,
        total,
        hasMore: page * limit < total,
      }),
    );
  } catch (error) {
    console.error("Error listing user purchases:", error);
    return res.status(500).json(fail("Failed to list purchases"));
  }
}

/**
 * GET /garage-admin/users/:userId/products
 *
 * Drill-down for the "N Products →" column on `/garage-admin/users`. Lists
 * every paid ProductOrder this user has placed (their bought products —
 * NOT products they created / sell). Paginated, newest first.
 */
export async function listUserPurchasedProducts(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json(fail("Invalid user id"));
    }
    const uid = new Types.ObjectId(userId);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || "25", 10)),
    );

    const filter: any = { userId: uid, paymentStatus: "paid" };

    const [orders, total] = await Promise.all([
      ProductOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "_id orderNumber organizationId items total currency status paymentStatus createdAt",
        )
        .lean<any[]>(),
      ProductOrder.countDocuments(filter),
    ]);

    const orgIds = Array.from(
      new Set(orders.map((o: any) => String(o.organizationId)).filter(Boolean)),
    );
    const orgs = orgIds.length
      ? await Organization.find({
          _id: { $in: orgIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("_id name icon slug")
          .lean<any[]>()
      : [];
    const orgMap = new Map<string, any>();
    for (const o of orgs) orgMap.set(String(o._id), o);

    // Flatten line items into rows so admin sees per-product entries
    // (matches the "each product is a row" affordance of the drawer).
    // Multiple line-items on the same order still share `orderId /
    // orderNumber` so the UI can group visually if desired.
    const items: any[] = [];
    for (const o of orders) {
      const org = orgMap.get(String(o.organizationId));
      for (const line of o.items || []) {
        items.push({
          orderId: String(o._id),
          orderNumber: o.orderNumber,
          orderStatus: o.status,
          paymentStatus: o.paymentStatus,
          productId: line.productId ? String(line.productId) : null,
          variantId: line.variantId ? String(line.variantId) : null,
          productName: line.productName,
          productImage: line.productImage || null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
          isDigital: !!line.isDigital,
          digitalAssets: line.digitalAssets || undefined,
          digitalLinks: line.digitalLinks || undefined,
          currency: o.currency,
          orgId: org ? String(org._id) : null,
          orgName: org?.name || null,
          orgIcon: org?.icon || null,
          orgSlug: org?.slug || null,
          purchasedAt: o.createdAt,
        });
      }
    }

    return res.json(
      ok({
        items,
        page,
        limit,
        total,
        hasMore: page * limit < total,
      }),
    );
  } catch (error) {
    console.error("Error listing user purchased products:", error);
    return res.status(500).json(fail("Failed to list products"));
  }
}

/**
 * POST /garage-admin/users/:userId/extend-offer
 *
 * Set the 24-hour welcome-offer expiry to `now + hours`, regardless of the
 * user's current window state. Works whether the offer is still open,
 * already expired, or the user never even completed their profile — the
 * override alone can drive the window (see `services/comboWindow.ts`).
 *
 * Body: `{ hours: 1..720 }` (integer; 30-day ceiling).
 *
 * Never shortens the window: `comboWindowFor` picks the LATER of the
 * natural expiry and the override, so if the user still has more than
 * `hours` naturally remaining, the override sits dormant until the
 * natural expiry passes it.
 */
export async function extendUserOffer(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json(fail("Invalid user id"));
    }

    const raw = (req.body || {}).hours;
    const hours = Number(raw);
    if (
      !Number.isFinite(hours) ||
      !Number.isInteger(hours) ||
      hours < 1 ||
      hours > 720
    ) {
      return res
        .status(400)
        .json(fail("hours must be an integer between 1 and 720"));
    }

    const user = await User.findById(userId)
      .select(
        "_id profileCompletedAt offerExpiresAtOverride offerExtendedAt offerExtendedByAdminId",
      )
      .lean<any>();
    if (!user) return res.status(404).json(fail("User not found"));

    const now = new Date();
    const newExpiry = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const adminId = (req as any).garageAdmin?._id || null;

    await User.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          offerExpiresAtOverride: newExpiry,
          offerExtendedAt: now,
          ...(adminId ? { offerExtendedByAdminId: adminId } : {}),
        },
      },
    );

    console.log(
      `[admin][extend-offer] admin=${adminId ? String(adminId) : "?"} user=${userId} hours=${hours} newExpiry=${newExpiry.toISOString()}`,
    );

    // Recompute the window with the fresh override so the FE can update
    // the row in place without a listing refetch.
    const w = comboWindowFor(
      {
        profileCompletedAt: user.profileCompletedAt,
        offerExpiresAtOverride: newExpiry,
      },
      now,
    );
    const extendedByAdmin =
      !!w.expiresAt && newExpiry.getTime() >= w.expiresAt.getTime();

    return res.json(
      ok({
        user: {
          userId: String(user._id),
          profileCompletedAt: user.profileCompletedAt || null,
          offerExpiresAtOverride: newExpiry,
          offerExtendedAt: now,
          offerExtendedByAdminId: adminId ? String(adminId) : null,
        },
        twentyFourHourOffer: {
          windowStartsAt: w.startsAt,
          windowExpiresAt: w.expiresAt,
          windowOpen: w.open,
          secondsRemaining: w.secondsRemaining,
          extendedByAdmin,
          extendedAt: now,
          extendedByAdminId: adminId ? String(adminId) : null,
        },
      }),
    );
  } catch (error) {
    console.error("Error extending user offer:", error);
    return res.status(500).json(fail("Failed to extend offer"));
  }
}

/**
 * GET /garage-admin/users/:userId/wallets
 * All of a user's wallets (store per office + affiliate + content rewards)
 * with the payout accounts connected to each. Read-only.
 */
export async function getUserWalletsForAdmin(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json(fail("Invalid user id"));
    }

    const user = await User.findById(userId)
      .populate("organizations.organization", "name slug")
      .populate("referredBy", "name email profilePicture affiliateId")
      .select("name email profilePicture affiliateId organizations referredBy")
      .lean();
    if (!user) {
      return res.status(404).json(fail("User not found"));
    }

    // Current upline + how many people sit directly under this user — context
    // for the "move upline" admin action.
    const upRef = (user as any).referredBy;
    const upline =
      upRef && typeof upRef === "object"
        ? {
            id: upRef._id,
            name: upRef.name || "",
            email: upRef.email || "",
            profilePicture: upRef.profilePicture || null,
            affiliateId: upRef.affiliateId || null,
          }
        : null;
    const directReferrals = await User.countDocuments({ referredBy: userId });

    const [storeWallets, affiliate, contentRewards, accounts] =
      await Promise.all([
        getUserStoreWallets(userId),
        getAffiliateWalletBalance(userId),
        getContentRewardsWalletBalance(userId),
        getAllWalletAccountsForUser(userId),
      ]);

    // Index accounts by their wallet slot for quick attach.
    const accountsFor = (walletType: string, orgId?: string | null) =>
      accounts.filter(
        (a: any) =>
          a.walletType === walletType &&
          String(a.orgId || "") === String(orgId || "")
      );

    const wallets: any[] = [];

    for (const sw of storeWallets as any[]) {
      const orgId = sw.orgId?._id || sw.orgId;
      const orgIdStr = orgId ? String(orgId) : null;
      wallets.push({
        walletType: "store",
        orgId: orgId || null,
        orgName: sw.orgId?.name || null,
        balance: sw.balance,
        // Matured (withdrawable) amount in cents — applies the Sunday-night cutoff.
        withdrawableBalance: await getWithdrawableBalanceCents(userId, "store", orgIdStr),
        currency: sw.currency || "USD",
        accounts: accountsFor("store", orgIdStr),
      });
    }

    wallets.push({
      walletType: "affiliate",
      orgId: null,
      orgName: null,
      balance: affiliate?.balance || 0,
      // Matured + Unilevel-Plus redeemable (stacked) — see getWithdrawableBalanceCents.
      withdrawableBalance: await getWithdrawableBalanceCents(userId, "affiliate", null),
      currency: affiliate?.currency || "USD",
      accounts: accountsFor("affiliate", null),
    });

    // Content Rewards is now genuinely per-org (OrgRewardsWallet). Surface
    // one row per org the user has a balance in. Each row's balance and
    // withdrawableBalance reflect that org's bucket in cents. No more
    // synthetic "pooled" row — each org is its own real wallet.
    const perOrgCr = await listContentRewardsBalancesForUser(userId);

    if (perOrgCr.length === 0) {
      // No per-org rows yet → keep a single empty row so the section
      // header renders. Balance comes from the legacy `getContentRewardsWalletBalance`
      // pre-migration fallback (NcWallet) so existing dashboards don't go
      // blank until the migration script runs.
      wallets.push({
        walletType: "content_rewards",
        orgId: null,
        orgName: null,
        balance: contentRewards?.balance || 0,
        withdrawableBalance: await getWithdrawableBalanceCents(
          userId,
          "content_rewards",
          null
        ),
        currency: contentRewards?.currency || "USD",
        accounts: accountsFor("content_rewards", null),
      });
    } else {
      for (const row of perOrgCr) {
        wallets.push({
          walletType: "content_rewards",
          orgId: row.orgId,
          orgName: row.orgName,
          balance: row.balance,
          // Now genuinely per-org — applies the Sunday-night cutoff per org.
          withdrawableBalance: await getWithdrawableBalanceCents(
            userId,
            "content_rewards",
            row.orgId
          ),
          currency: row.currency || "USD",
          // Payout accounts for CR remain GLOBAL (one bank/crypto destination
          // per user, regardless of which org the funds came from). All
          // per-org CR rows share the same WalletAccount keyed by
          // { userId, walletType: "content_rewards", orgId: null }.
          accounts: accountsFor("content_rewards", null),
        });
      }
    }

    return res.json(
      ok({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: (user as any).profilePicture || null,
          affiliateId: (user as any).affiliateId || null,
          offices: ((user as any).organizations || [])
            .map((m: any) => ({
              id: m.organization?._id || null,
              name: m.organization?.name || "Unknown",
              role: m.role,
            }))
            .filter((o: any) => o.id !== null),
          upline,
          directReferrals,
        },
        wallets,
      })
    );
  } catch (error) {
    console.error("Error fetching user wallets for admin:", error);
    return res.status(500).json(fail("Failed to fetch user wallets"));
  }
}

/**
 * POST /garage-admin/users/:userId/move-upline
 * Body: { newReferrerId: string }
 *
 * Admin-only re-parenting of a member in the referral tree. This is the
 * privileged equivalent of the self-service `POST /affiliate/change-referrer`
 * — same underlying write (`User.referredBy = newReferrer`) but WITHOUT the
 * `profileComplete === false` gate, so an admin can move anyone at any time.
 *
 * IMPORTANT — commission semantics: commissions are booked as an immutable
 * historical ledger (CommissionDistribution / UnilevelPlusDistribution) at
 * the moment of each sale. Re-pointing `referredBy` does NOT retroactively
 * move already-paid commissions; it only changes which uplines earn on the
 * member's FUTURE sales. This mirrors exactly what happens today when the
 * referrer is changed manually.
 *
 * Validations, in order:
 *   1. both ids are valid ObjectIds
 *   2. member exists
 *   3. new upline exists
 *   4. new upline is not the member themselves (self-referral)
 *   5. new upline is not already the member's current upline (no-op)
 *   6. new upline is not inside the member's own downline (would create a
 *      cycle) — enforced transitively via `isInMyDownline`
 */
export async function adminMoveUpline(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { newReferrerId, moveCommissions } = z
      .object({
        newReferrerId: z.string().trim().min(1),
        /**
         * Opt-in: also re-point the member's ALREADY-PAID Unilevel Plus
         * commission at the new upline.
         *
         * Defaults false, which is the historical behaviour — a move only
         * affects FUTURE earnings and the past ledger stands. Turning it on
         * reverses the original distribution and re-runs it against the new
         * tree, which moves real money between real wallets. Opt-in precisely
         * because it is not reversible from the UI.
         */
        moveCommissions: z.boolean().optional().default(false),
      })
      .parse(req.body);

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json(fail("Invalid user id"));
    }
    if (!Types.ObjectId.isValid(newReferrerId)) {
      return res.status(400).json(fail("Invalid new upline id"));
    }

    const member = await User.findById(userId)
      .select("_id name email profilePicture affiliateId referredBy")
      .lean<{
        _id: Types.ObjectId;
        name?: string;
        email?: string;
        referredBy?: Types.ObjectId;
      }>();
    if (!member) {
      return res.status(404).json(fail("Member not found"));
    }

    const target = await User.findById(newReferrerId)
      .select("_id name email profilePicture affiliateId")
      .lean<{
        _id: Types.ObjectId;
        name?: string;
        email?: string;
        profilePicture?: string;
        affiliateId?: string;
      }>();
    if (!target) {
      return res.status(404).json(fail("The selected new upline doesn't exist."));
    }

    if (String(target._id) === String(member._id)) {
      return res
        .status(400)
        .json(fail("A member can't be their own upline."));
    }

    if (
      member.referredBy &&
      String(member.referredBy) === String(target._id)
    ) {
      return res
        .status(400)
        .json(fail(`${target.name || target.email} is already the upline.`));
    }

    // Cycle guard: the new upline must not sit anywhere in the member's own
    // downline, or moving them would orphan a whole subtree into a loop.
    const wouldCycle = await isInMyDownline(
      String(member._id),
      String(target._id),
    );
    if (wouldCycle) {
      return res
        .status(400)
        .json(
          fail(
            "That user is in this member's own downline — moving them there would create a loop.",
          ),
        );
    }

    const previousUpline = member.referredBy
      ? await getReferrerInfo(member.referredBy)
      : null;

    await User.findByIdAndUpdate(member._id, { referredBy: target._id });

    // Swap the upline in the member's support chat.
    void import("../services/supportChat").then(({ syncSupportUpline }) =>
      syncSupportUpline(member._id),
    );

    /**
     * Optional commission sweep.
     *
     * Runs AFTER the referredBy write, never before: the re-distribution walks
     * the live referral chain, so it has to see the new upline. It reads
     * `referredBy` directly (services/unilevelPlusCommission.ts#getLegNumber
     * queries it rather than the denormalised legNumber/ancestors), so it is
     * correct the instant the line above lands.
     *
     * Failure here must NOT fail the request — the move itself already
     * succeeded and is the thing the admin asked for. The outcome is reported
     * back in `commissionMove` so the UI can show exactly what happened rather
     * than implying money moved when it didn't.
     */
    let commissionMove: any = null;
    if (moveCommissions) {
      try {
        const { applyUnilevelCommissionMove } = await import(
          "../services/uplineCommissionMove"
        );
        commissionMove = await applyUnilevelCommissionMove(String(member._id), {
          actor: `garage-admin:${(req as any).garageAdmin?.email ?? "unknown"}`,
        });
      } catch (err: any) {
        console.error("[adminMoveUpline] commission sweep threw:", err);
        commissionMove = {
          status: "failed",
          reason: err?.message ?? String(err),
        };
      }
    }

    const directReferrals = await User.countDocuments({
      referredBy: member._id,
    });

    return res.json(
      ok({
        member: {
          id: String(member._id),
          name: member.name || "",
          email: member.email || "",
        },
        previousUpline,
        newUpline: {
          id: String(target._id),
          name: target.name || "",
          email: target.email || "",
          profilePicture: target.profilePicture || null,
          affiliateId: target.affiliateId || null,
        },
        // Members directly under the moved member — they travel with them, so
        // the admin can sanity-check the size of the subtree that just moved.
        directReferralsMoved: directReferrals,
        // Null when the toggle was off. Otherwise the sweep's outcome —
        // `status` is one of applied | skipped | blocked | failed, so the UI
        // reports what actually happened instead of assuming success.
        commissionMove,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(fail("newReferrerId is required"));
    }
    console.error("Error moving upline:", error);
    return res.status(500).json(fail("Failed to move upline"));
  }
}

// ── Withdrawals (super-admin) ───────────────────────────────────────────────

const WALLET_LABELS: Record<string, string> = {
  store: "Store Wallet",
  affiliate: "Affiliate Wallet",
  content_rewards: "Content Rewards Wallet",
};

/** Shape a Withdrawal doc (with populated user) for admin display. */
function shapeWithdrawal(w: any) {
  const snap = w.accountSnapshot || {};
  const user = w.userId && typeof w.userId === "object" ? w.userId : null;
  return {
    id: w._id,
    user: user
      ? {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture || null,
        }
      : { id: w.userId },
    walletType: w.walletType,
    walletLabel: WALLET_LABELS[w.walletType] || w.walletType,
    orgId: w.orgId
      ? typeof w.orgId === "object"
        ? w.orgId._id || null
        : w.orgId
      : null,
    orgName:
      w.orgId && typeof w.orgId === "object" ? w.orgId.name || null : null,
    accountType: w.accountType,
    account: {
      type: snap.accountType,
      label: snap.label || "",
      bankName: snap.bankName || "",
      accountNumber: snap.accountNumber || "",
      cryptoNetwork: snap.cryptoNetwork || "",
      cryptoAddress: snap.cryptoAddress || "",
    },
    grossAmount: w.grossAmount,
    feeAmount: w.feeAmount,
    feePercent: w.feePercent,
    // Present only when a super admin departed from the rules at initiate
    // time. The completing admin needs to see it before releasing money.
    adminOverride: w.adminOverride
      ? {
          tierFeePercent: w.adminOverride.tierFeePercent ?? null,
          appliedFeePercent: w.adminOverride.appliedFeePercent ?? null,
          gatedCapCents: w.adminOverride.gatedCapCents ?? null,
          walletBalanceCents: w.adminOverride.walletBalanceCents ?? null,
          releasedCents: w.adminOverride.releasedCents ?? null,
          lockedByMaturityCents: w.adminOverride.lockedByMaturityCents ?? null,
          lockedByLicenceCents: w.adminOverride.lockedByLicenceCents ?? null,
          reason: w.adminOverride.reason || null,
          at: w.adminOverride.at || null,
        }
      : null,
    // The bank's own charge — deducted from the payout, never platform revenue.
    bankTransferFee: w.bankTransferFee || 0,
    // Why the fee is what it is (affiliate wallet only): daily/weekly and
    // whether they kept $50 back. Snapshotted at initiate time.
    feeTier: w.feeTier
      ? {
          frequency: w.feeTier.frequency || null,
          keepAmountCents: w.feeTier.keepAmountCents ?? null,
          meetsKeepThreshold: !!w.feeTier.meetsKeepThreshold,
          configured: !!w.feeTier.configured,
          payoutMethod: w.feeTier.payoutMethod || null,
        }
      : null,
    /** fee + taxes. Excludes the bank charge on purpose. */
    platformRetains: (w.feeAmount || 0) + (w.taxTotal || 0),
    taxes: (w.taxes || []).map((t: any) => ({
      label: t.label,
      type: t.type,
      value: t.value,
      amount: t.amount,
    })),
    taxTotal: w.taxTotal || 0,
    netAmount: w.netAmount,
    currency: w.currency,
    status: w.status,
    receiptUrl: w.receiptUrl || "",
    txHash: w.txHash || "",
    proofs: (w.proofs || []).map((p: any) => ({
      url: p.url,
      label: p.label || "",
      uploadedAt: p.uploadedAt,
    })),
    rejectionReason: w.rejectionReason || "",
    createdAt: w.createdAt,
    processedAt: w.processedAt,
  };
}

/**
 * POST /garage-admin/withdrawals/quote — price a withdrawal without writing.
 *
 * Backs the "Initiate withdrawal" dialog: the team sees the Garage fee and
 * WHY it is that rate (the user's daily/weekly + keep-$50 choice), the bank
 * charge, the taxes and the exact net before committing to anything.
 */
export async function adminQuoteWithdrawal(req: Request, res: Response) {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      walletType: z.enum(WITHDRAWAL_WALLET_TYPES),
      orgId: z.string().nullable().optional(),
      accountId: z.string().min(1).optional(),
      payoutMethod: z.enum(["bank", "crypto"]).optional(),
      amountCents: z.number().int().positive(),
      taxes: z
        .array(
          z.object({
            label: z.string().min(1).max(60),
            type: z.enum(["percent", "flat"]),
            value: z.number().min(0),
          })
        )
        .max(10)
        .optional(),
      bankTransferFeeCents: z.number().int().min(0).max(100_000_000).optional(),
      // Super-admin overrides, scoped to this one withdrawal. Nothing here
      // is written back to the member's saved withdrawal preference.
      overrides: z
        .object({
          feePercent: z.number().min(0).max(100).optional(),
          releaseLockedFunds: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .optional(),
    });
    const body = schema.parse(req.body);

    // Prefer the real account's type — the dialog may pass either.
    let payoutMethod = body.payoutMethod || "bank";
    if (body.accountId) {
      const { WalletAccount } = await import("../models/walletAccount.model");
      const acc = await WalletAccount.findById(body.accountId)
        .select("accountType")
        .lean();
      if (acc) payoutMethod = (acc as any).accountType === "crypto" ? "crypto" : "bank";
    }

    const { quoteWithdrawal } = await import("../services/withdrawal");
    const quote = await quoteWithdrawal({
      userId: body.userId,
      walletType: body.walletType,
      orgId: body.orgId,
      payoutMethod,
      grossCents: body.amountCents,
      taxes: body.taxes,
      bankTransferFeeCents: body.bankTransferFeeCents,
      overrides: body.overrides,
    });
    return res.json(ok({ ...quote, payoutMethod }));
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json(fail(issues[0]?.message || "Invalid input"));
    }
    console.error("adminQuoteWithdrawal error:", error);
    return res.status(500).json(fail(error?.message || "Failed to quote withdrawal"));
  }
}

/** POST /garage-admin/withdrawals — initiate a withdrawal for a user. */
export async function adminInitiateWithdrawal(req: Request, res: Response) {
  try {
    const admin = (req as any).garageAdmin as { id: string };
    const schema = z.object({
      userId: z.string().min(1),
      walletType: z.enum(WITHDRAWAL_WALLET_TYPES),
      // Accept null in addition to undefined — the frontend sends `null` for
      // affiliate / content_rewards wallets where there is no org context.
      orgId: z.string().nullable().optional(),
      accountId: z.string().min(1),
      amountCents: z.number().int().positive(),
      taxes: z
        .array(
          z.object({
            label: z.string().min(1).max(60),
            type: z.enum(["percent", "flat"]),
            value: z.number().min(0),
          })
        )
        .max(10)
        .optional(),
      // What the bank charges to send it. Bank payouts only; the service
      // refuses it on a crypto account rather than silently dropping it.
      bankTransferFeeCents: z.number().int().min(0).max(100_000_000).optional(),
      // Super-admin overrides, scoped to this one withdrawal. Nothing here
      // is written back to the member's saved withdrawal preference.
      overrides: z
        .object({
          feePercent: z.number().min(0).max(100).optional(),
          releaseLockedFunds: z.boolean().optional(),
          reason: z.string().max(500).optional(),
        })
        .optional(),
    });
    const body = schema.parse(req.body);

    // Store and Content Rewards are both per-org now — Affiliate is the
    // only single-pool wallet left.
    if (
      (body.walletType === "store" ||
        body.walletType === "content_rewards") &&
      !body.orgId
    ) {
      return res
        .status(400)
        .json(fail(`orgId is required for ${body.walletType} wallet`));
    }

    const withdrawal = await initiateWithdrawal({
      adminId: admin.id,
      userId: body.userId,
      walletType: body.walletType,
      orgId: body.orgId,
      accountId: body.accountId,
      grossCents: body.amountCents,
      taxes: body.taxes,
      bankTransferFeeCents: body.bankTransferFeeCents,
      overrides: body.overrides,
    });

    // Fire-and-forget: notify Shorupan (platform owner) so the bank
    // transfer can be initiated manually. Failures are logged inside the
    // helper and never block the response — the Withdrawal row is already
    // committed by this point, so a missed email never loses money.
    void notifyAdminOnWithdrawalInitiated(withdrawal._id);
    // Also notify the recipient that their request is queued. Same
    // fire-and-forget guarantees.
    void notifyUserOnWithdrawalInitiated(withdrawal._id);

    return res.json(ok(shapeWithdrawal(withdrawal)));
  } catch (error: any) {
    // Zod v4 exposes the issue list as `.issues` (renamed from `.errors`).
    // Guard against either name so older callers still produce a useful msg.
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res
        .status(400)
        .json(fail(issues[0]?.message || "Invalid input"));
    }
    const msg = error?.message || "Failed to initiate withdrawal";
    const status = /exceeds|not found|required|greater than 0|Insufficient/.test(msg) ? 400 : 500;
    return res.status(status).json(fail(msg));
  }
}

/** GET /garage-admin/withdrawals — paginated queue (default initiated). */
export async function listWithdrawals(req: Request, res: Response) {
  try {
    const status = (req.query.status as string) || "initiated";
    const search = (req.query.search as string)?.trim() || "";
    const skip = Math.max(0, parseInt((req.query.skip as string) || "0", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "30", 10)));

    const filter: any = {};
    if (status && status !== "all") filter.status = status;

    // Search by user name/email → resolve to userIds first.
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const users = await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
        .select("_id")
        .lean();
      filter.userId = { $in: users.map((u) => u._id) };
    }

    const [rows, total] = await Promise.all([
      Withdrawal.find(filter)
        .populate("userId", "name email profilePicture")
        .populate("orgId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Withdrawal.countDocuments(filter),
    ]);

    return res.json(
      ok({
        items: rows.map(shapeWithdrawal),
        total,
        skip,
        limit,
        hasMore: skip + rows.length < total,
      })
    );
  } catch (error) {
    console.error("Error listing withdrawals:", error);
    return res.status(500).json(fail("Failed to list withdrawals"));
  }
}

/** GET /garage-admin/withdrawals/stats — counts + pending total for badges/cards. */
export async function getWithdrawalStats(req: Request, res: Response) {
  try {
    const agg = await Withdrawal.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          gross: { $sum: "$grossAmount" },
        },
      },
    ]);
    const byStatus: Record<string, { count: number; gross: number }> = {};
    for (const a of agg) byStatus[a._id] = { count: a.count, gross: a.gross };
    return res.json(
      ok({
        pending: byStatus.initiated?.count || 0,
        pendingAmount: byStatus.initiated?.gross || 0,
        completed: byStatus.completed?.count || 0,
        rejected: byStatus.rejected?.count || 0,
      })
    );
  } catch (error) {
    console.error("Error fetching withdrawal stats:", error);
    return res.status(500).json(fail("Failed to fetch withdrawal stats"));
  }
}

/** POST /garage-admin/withdrawals/:id/complete */
export async function adminCompleteWithdrawal(req: Request, res: Response) {
  try {
    const admin = (req as any).garageAdmin as { id: string };
    const { id } = req.params;
    // `proofs` is the new multi-document field; `receiptUrl` stays accepted so
    // an older admin build keeps working unchanged.
    const { receiptUrl, txHash, proofs } = z
      .object({
        receiptUrl: z.string().optional(),
        txHash: z.string().max(200).optional(),
        proofs: z
          .array(
            z.object({ url: z.string().min(1), label: z.string().max(120).optional() })
          )
          .max(10)
          .optional(),
      })
      .parse(req.body || {});
    const w = await completeWithdrawal({
      adminId: admin.id,
      withdrawalId: id,
      receiptUrl,
      txHash,
      proofs,
    });
    // Fire-and-forget recipient email.
    void notifyUserOnWithdrawalCompleted(w._id);
    return res.json(ok(shapeWithdrawal(w)));
  } catch (error: any) {
    const msg = error?.message || "Failed to complete withdrawal";
    const status = /not found|already/.test(msg) ? 400 : 500;
    return res.status(status).json(fail(msg));
  }
}

/** POST /garage-admin/withdrawals/:id/reject */
export async function adminRejectWithdrawal(req: Request, res: Response) {
  try {
    const admin = (req as any).garageAdmin as { id: string };
    const { id } = req.params;
    const { reason } = z.object({ reason: z.string().max(1000).optional() }).parse(req.body || {});
    const w = await rejectWithdrawal({ adminId: admin.id, withdrawalId: id, reason });
    // Fire-and-forget recipient email: explains the rejection + refund.
    void notifyUserOnWithdrawalRejected(w._id);
    return res.json(ok(shapeWithdrawal(w)));
  } catch (error: any) {
    const msg = error?.message || "Failed to reject withdrawal";
    const status = /not found|already/.test(msg) ? 400 : 500;
    return res.status(status).json(fail(msg));
  }
}

export async function getAllUnilevelPlusLicenseHolders(
  req: Request,
  res: Response
) {
  try {
    const purchaseAgg = await UnilevelPlusPurchase.aggregate<{
      _id: any;
      licensesPurchased: number;
      totalSpent: number;
      currency: string;
      firstPurchasedAt: Date;
    }>([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$userId",
          licensesPurchased: { $sum: 1 },
          totalSpent: { $sum: "$amount" },
          currency: { $first: "$currency" },
          firstPurchasedAt: { $min: "$purchasedAt" },
        },
      },
    ]);

    const holderIds = purchaseAgg.map((p) => p._id);

    if (holderIds.length === 0) {
      return res.json(ok([]));
    }

    // --- Reserve license aggregation (counts by status) ---
    const reserveAgg = await ReserveLicense.aggregate<{
      _id: { userId: any; status: string };
      count: number;
    }>([
      { $match: { userId: { $in: holderIds } } },
      {
        $group: {
          _id: { userId: "$userId", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const reserveByUser = new Map<
      string,
      { available: number; assigned: number; expired: number }
    >();
    for (const row of reserveAgg) {
      const userKey = String(row._id.userId);
      const entry = reserveByUser.get(userKey) || {
        available: 0,
        assigned: 0,
        expired: 0,
      };
      if (row._id.status === "available") entry.available = row.count;
      else if (row._id.status === "assigned") entry.assigned = row.count;
      else if (row._id.status === "expired") entry.expired = row.count;
      reserveByUser.set(userKey, entry);
    }

    // --- Individual purchase docs (dates + amounts + paymentId for spend calc) ---
    const purchaseDocs = await UnilevelPlusPurchase.find(
      { userId: { $in: holderIds }, status: "active" },
      { userId: 1, purchasedAt: 1, amount: 1, paymentId: 1 }
    ).lean();
    const purchaseDatesByUser = new Map<string, Date[]>();
    // Track actual purchase spend (exclude assigned licenses — those users didn't pay)
    const realPurchaseSpendByUser = new Map<string, number>();
    for (const doc of purchaseDocs) {
      const key = String(doc.userId);
      const arr = purchaseDatesByUser.get(key) || [];
      arr.push(doc.purchasedAt);
      purchaseDatesByUser.set(key, arr);
      // Only count as "spent" if this was a real purchase, not a reserve assignment
      if (!doc.paymentId.startsWith("assigned_")) {
        realPurchaseSpendByUser.set(key, (realPurchaseSpendByUser.get(key) || 0) + doc.amount);
      }
    }

    // --- Individual reserve license docs (dates + amounts) ---
    const reserveDocs = await ReserveLicense.find(
      { userId: { $in: holderIds } },
      { userId: 1, createdAt: 1, amount: 1 }
    ).lean();
    const reserveDatesByUser = new Map<string, Date[]>();
    const reserveSpendByUser = new Map<string, number>();
    for (const doc of reserveDocs) {
      const key = String(doc.userId);
      const arr = reserveDatesByUser.get(key) || [];
      arr.push(doc.createdAt);
      reserveDatesByUser.set(key, arr);
      reserveSpendByUser.set(key, (reserveSpendByUser.get(key) || 0) + doc.amount);
    }

    // --- Directs: count users referred by each holder ---
    const directsAgg = await User.aggregate<{
      _id: any;
      totalDirects: number;
      directIds: any[];
    }>([
      { $match: { referredBy: { $in: holderIds } } },
      {
        $group: {
          _id: "$referredBy",
          totalDirects: { $sum: 1 },
          directIds: { $push: "$_id" },
        },
      },
    ]);

    // Collect ALL direct IDs across all holders to check license status in one query
    const allDirectIds: any[] = [];
    const directsByHolder = new Map<string, { total: number; ids: any[] }>();
    for (const row of directsAgg) {
      const key = String(row._id);
      directsByHolder.set(key, { total: row.totalDirects, ids: row.directIds });
      allDirectIds.push(...row.directIds);
    }

    // Find which directs have at least 1 active purchase
    const directsWithPurchase = new Set<string>();
    if (allDirectIds.length > 0) {
      const directPurchases = await UnilevelPlusPurchase.find(
        { userId: { $in: allDirectIds }, status: "active" },
        { userId: 1 }
      ).lean();
      for (const dp of directPurchases) {
        directsWithPurchase.add(String(dp.userId));
      }
    }

    // Build per-holder directs breakdown
    const directsBreakdown = new Map<
      string,
      { total: number; withLicense: number; withoutLicense: number }
    >();
    for (const [holderId, data] of directsByHolder) {
      let withLicense = 0;
      for (const dId of data.ids) {
        if (directsWithPurchase.has(String(dId))) withLicense++;
      }
      directsBreakdown.set(holderId, {
        total: data.total,
        withLicense,
        withoutLicense: data.total - withLicense,
      });
    }

    // --- Users (now including city, state, postalCode) ---
    const users = await User.find({ _id: { $in: holderIds } })
      .populate("organizations.organization", "name icon")
      .populate("referredBy", "name email")
      .select("name email profilePicture organizations createdAt country city state postalCode referredBy")
      .lean();

    const usersById = new Map<string, any>();
    for (const u of users) {
      usersById.set(String(u._id), u);
    }

    // --- Payment history: paid invoices containing unilevel_plus line items ---
    const paidInvoices = await Invoice.find(
      {
        userId: { $in: holderIds },
        status: "paid",
        "lineItems.itemType": "unilevel_plus",
      },
      {
        userId: 1,
        invoiceNumber: 1,
        totalAmount: 1,
        itemCurrency: 1,
        paymentCurrency: 1,
        paymentMethodCategory: 1,
        paymentPlatform: 1,
        paidAt: 1,
        invoiceShortUrl: 1,
        couponCode: 1,
        discount: 1,
        lineItems: 1,
      }
    )
      .sort({ paidAt: -1 })
      .lean();

    const invoicesByUser = new Map<string, any[]>();
    for (const inv of paidInvoices) {
      const key = String(inv.userId);
      const arr = invoicesByUser.get(key) || [];
      arr.push({
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount,
        currency: inv.itemCurrency || "USD",
        paymentCurrency: inv.paymentCurrency || inv.itemCurrency || "USD",
        paymentMethod: inv.paymentMethodCategory || null,
        paymentPlatform: inv.paymentPlatform || null,
        paidAt: inv.paidAt,
        invoiceUrl: inv.invoiceShortUrl || null,
        couponCode: inv.couponCode || null,
        discount: inv.discount || 0,
        quantity: inv.lineItems?.reduce((s: number, li: any) => s + (li.quantity || 1), 0) || 1,
      });
      invoicesByUser.set(key, arr);
    }

    const result = purchaseAgg
      .map((p) => {
        const userKey = String(p._id);
        const u = usersById.get(userKey);
        if (!u) return null;
        const reserve = reserveByUser.get(userKey) || {
          available: 0,
          assigned: 0,
          expired: 0,
        };
        const uplineDoc = u.referredBy as any;

        // Build purchase timeline (purchased + reserve dates)
        const pDates = (purchaseDatesByUser.get(userKey) || []).map((d: Date) => ({
          date: d,
          type: "purchased" as const,
        }));
        const rDates = (reserveDatesByUser.get(userKey) || []).map((d: Date) => ({
          date: d,
          type: "reserve" as const,
        }));
        const allLicenseDates = [...pDates, ...rDates].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // 4-license milestone: date of the 4th license (purchased + all reserve)
        const fourLicenseMilestoneDate =
          allLicenseDates.length >= 4 ? allLicenseDates[3].date : null;

        // Directs breakdown
        const directs = directsBreakdown.get(userKey) || {
          total: 0,
          withLicense: 0,
          withoutLicense: 0,
        };

        return {
          id: u._id,
          name: u.name || null,
          email: u.email || null,
          profilePicture: u.profilePicture || null,
          createdAt: u.createdAt,
          country: u.country || null,
          city: u.city || null,
          state: u.state || null,
          postalCode: u.postalCode || null,
          upline: uplineDoc && uplineDoc._id
            ? { id: uplineDoc._id, name: uplineDoc.name || null, email: uplineDoc.email || null }
            : null,
          licensesPurchased: p.licensesPurchased,
          licensesInReserve: reserve.available,
          licensesAssigned: reserve.assigned,
          licensesExpired: reserve.expired,
          // totalSpent = real purchase amount (not from assignments) + all reserve amounts they bought
          totalSpent: (realPurchaseSpendByUser.get(userKey) || 0) + (reserveSpendByUser.get(userKey) || 0),
          currency: p.currency || "USD",
          firstPurchasedAt: p.firstPurchasedAt,
          purchaseTimeline: allLicenseDates.map((d) => ({
            date: d.date,
            type: d.type,
          })),
          totalDirects: directs.total,
          directsWithLicense: directs.withLicense,
          directsWithoutLicense: directs.withoutLicense,
          fourLicenseMilestoneDate,
          organizations: (u.organizations || [])
            .map((org: any) => {
              const orgDoc = org.organization;
              if (!orgDoc || !orgDoc._id) return null;
              return {
                id: orgDoc._id,
                name: orgDoc.name || "Unknown Organization",
                icon: orgDoc.icon || null,
                role: org.role,
                fullAccess: !!org.fullAccess,
                joinedAt: org.joinedAt,
              };
            })
            .filter((o: any) => o !== null),
          paymentHistory: invoicesByUser.get(userKey) || [],
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        const totalA = a.licensesPurchased + a.licensesInReserve;
        const totalB = b.licensesPurchased + b.licensesInReserve;
        return totalB - totalA;
      });

    return res.json(ok(result));
  } catch (error) {
    console.error("Error fetching Unilevel Plus license holders:", error);
    return res
      .status(500)
      .json(fail("Failed to fetch Unilevel Plus license holders"));
  }
}

// ============ Platform fee overrides (per-org) ============

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5;

export async function listPlatformFeeOverrides(req: Request, res: Response) {
  try {
    const orgs = await Organization.find({})
      .populate("paymentConfig.platformFeeUpdatedBy", "name email")
      .select(
        "_id name icon parent paymentConfig.platformFeePercentage paymentConfig.platformFeeUpdatedAt paymentConfig.platformFeeUpdatedBy"
      )
      .sort({ name: 1 })
      .lean();

    const data = orgs.map((o: any) => {
      const overridePct = o.paymentConfig?.platformFeePercentage;
      const isOverride = typeof overridePct === "number";
      const updatedBy = o.paymentConfig?.platformFeeUpdatedBy as
        | { _id: any; name?: string; email?: string }
        | undefined;
      return {
        orgId: String(o._id),
        name: o.name,
        icon: o.icon,
        isHq: !!o.parent,
        isOverride,
        feePercentage: isOverride ? overridePct : DEFAULT_PLATFORM_FEE_PERCENTAGE,
        defaultFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        updatedAt: o.paymentConfig?.platformFeeUpdatedAt || null,
        updatedBy: updatedBy
          ? {
              id: String(updatedBy._id),
              name: updatedBy.name,
              email: updatedBy.email,
            }
          : null,
      };
    });

    return res.json(ok({ default: DEFAULT_PLATFORM_FEE_PERCENTAGE, items: data }));
  } catch (error) {
    console.error("Error listing platform fee overrides:", error);
    return res
      .status(500)
      .json(fail("Failed to list platform fee overrides"));
  }
}

const setFeeSchema = z.object({
  feePercentage: z.number().min(0).max(50),
});

export async function setPlatformFeeOverride(req: Request, res: Response) {
  try {
    const { orgId } = req.params;
    if (!orgId) return res.status(400).json(fail("orgId is required"));

    const parsed = setFeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(fail("feePercentage must be a number between 0 and 50"));
    }

    // The middleware attaches the admin as `id` (garageAdminAuth.ts::attach),
    // not `garageAdminId`. Reading the wrong key stored `null` here — and
    // `resolvePlatformFeePercentage` treats a null `platformFeeUpdatedBy` as
    // "plan default, ignore", so every rate set from this page was silently
    // overruled by the org's plan (BAT 246 set to 4% on 11 Sep, still charged
    // 10%). Refuse rather than write null again if the id is ever missing.
    const admin = (req as any).garageAdmin as { id?: string };
    if (!admin?.id) {
      return res.status(401).json(fail("Admin identity missing"));
    }

    const updated = await Organization.findByIdAndUpdate(
      orgId,
      {
        $set: {
          "paymentConfig.platformFeePercentage": parsed.data.feePercentage,
          "paymentConfig.platformFeeUpdatedAt": new Date(),
          "paymentConfig.platformFeeUpdatedBy": new Types.ObjectId(admin.id),
        },
      },
      { new: true }
    )
      .select(
        "_id name paymentConfig.platformFeePercentage paymentConfig.platformFeeUpdatedAt"
      )
      .lean();

    if (!updated) return res.status(404).json(fail("Organization not found"));

    return res.json(
      ok({
        orgId: String(updated._id),
        name: updated.name,
        feePercentage:
          (updated as any).paymentConfig?.platformFeePercentage ?? null,
        updatedAt:
          (updated as any).paymentConfig?.platformFeeUpdatedAt || null,
      })
    );
  } catch (error) {
    console.error("Error setting platform fee override:", error);
    return res
      .status(500)
      .json(fail("Failed to set platform fee override"));
  }
}

export async function removePlatformFeeOverride(req: Request, res: Response) {
  try {
    const { orgId } = req.params;
    if (!orgId) return res.status(400).json(fail("orgId is required"));

    const updated = await Organization.findByIdAndUpdate(
      orgId,
      {
        $unset: {
          "paymentConfig.platformFeePercentage": "",
          "paymentConfig.platformFeeUpdatedAt": "",
          "paymentConfig.platformFeeUpdatedBy": "",
        },
      },
      { new: true }
    )
      .select("_id name")
      .lean();

    if (!updated) return res.status(404).json(fail("Organization not found"));

    return res.json(
      ok({
        orgId: String(updated._id),
        name: updated.name,
        feePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        isOverride: false,
      })
    );
  } catch (error) {
    console.error("Error removing platform fee override:", error);
    return res
      .status(500)
      .json(fail("Failed to remove platform fee override"));
  }
}

/**
 * GET /garage-admin/user-wallets
 *
 * Bird's-eye list across every user × every wallet type (store one row per
 * org, plus one row each for affiliate + content_rewards). Powers the
 * "User Wallets" admin page; pairs with the per-user detail page when the
 * admin clicks Withdraw on a row.
 *
 * Query params:
 *   q       — search by user name / email
 *   type    — store | affiliate | content_rewards (omit = all)
 *   sort    — balance | name | activity (default balance desc)
 *   hasFunds — "1" to hide zero-balance rows
 *   limit, offset
 *
 * Sized for low-thousands of wallets. If totals grow we move to a Mongo
 * `$unionWith` aggregation; today an in-memory union+sort is faster to ship
 * and keeps the response stable regardless of which collection a row came
 * from.
 */
export async function listAllUserWallets(req: Request, res: Response) {
  try {
    const schema = z.object({
      q: z.string().trim().optional(),
      type: z
        .enum(["store", "affiliate", "content_rewards", "all"])
        .optional()
        .default("all"),
      sort: z
        .enum(["balance", "name", "activity"])
        .optional()
        .default("balance"),
      hasFunds: z.string().optional(),
      country: z.string().trim().optional(),
      /** "yes" = has a payout destination saved, "no" = has none. */
      payout: z.enum(["any", "yes", "no"]).optional().default("any"),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(parseInt(v || "50", 10) || 50, 200)),
      offset: z
        .string()
        .optional()
        .transform((v) => parseInt(v || "0", 10) || 0),
    });
    const { q, type, sort, hasFunds, country, payout, limit, offset } =
      schema.parse(req.query);

    // `country` on User is free text typed at signup, so the same place
    // arrives as "India", "India " and "india". Matching the raw string
    // would silently hide 17 Indian users behind the two odd spellings, so
    // both the filter and the facet key off a trimmed, lower-cased form.
    const normCountry = (v: unknown) =>
      String(v ?? "").trim().toLowerCase();

    const userSelect = "name email profilePicture country";

    // Fetch each wallet collection in parallel — empty arrays when filtered out.
    const [stores, affiliates, orgRewards, accounts] = await Promise.all([
      type === "all" || type === "store"
        ? StoreWallet.find({ isActive: { $ne: false } })
            .populate("userId", userSelect)
            .populate("orgId", "name")
            .lean()
        : Promise.resolve([] as any[]),
      type === "all" || type === "affiliate"
        ? AffiliateWallet.find({ isActive: { $ne: false } })
            .populate("userId", userSelect)
            .lean()
        : Promise.resolve([] as any[]),
      type === "all" || type === "content_rewards"
        ? OrgRewardsWallet.find({})
            .populate("userId", userSelect)
            .populate("orgId", "name")
            .lean()
        : Promise.resolve([] as any[]),
      // Single sweep for the payout-account-exists lookup. Tiny rows.
      WalletAccount.find({})
        .select("userId walletType orgId")
        .lean(),
    ]);

    const accountKey = (
      userId: any,
      walletType: string,
      orgId: any
    ) => `${String(userId)}:${walletType}:${orgId ? String(orgId) : ""}`;
    const accountSet = new Set(
      (accounts as any[]).map((a) =>
        accountKey(a.userId, a.walletType, a.orgId)
      )
    );

    type Row = {
      walletId: string;
      walletType: "store" | "affiliate" | "content_rewards";
      user: {
        _id: string;
        name?: string;
        email?: string;
        profilePicture?: string | null;
        country?: string | null;
      } | null;
      orgId: string | null;
      orgName: string | null;
      balance: number; // USD float (all surfaces normalize to dollars)
      currency: string;
      lastTransactionAt: Date | null;
      hasAccount: boolean;
    };

    const userOf = (raw: any) =>
      raw && typeof raw === "object" && raw._id
        ? {
            _id: String(raw._id),
            name: raw.name,
            email: raw.email,
            profilePicture: raw.profilePicture || null,
            country: (raw.country || "").trim() || null,
          }
        : null;

    const rows: Row[] = [];

    for (const sw of stores as any[]) {
      const userId = sw.userId?._id || sw.userId;
      const orgId = sw.orgId?._id || sw.orgId;
      rows.push({
        walletId: String(sw._id),
        walletType: "store",
        user: userOf(sw.userId),
        orgId: orgId ? String(orgId) : null,
        orgName: sw.orgId?.name || null,
        balance: sw.balance || 0,
        currency: sw.currency || "USD",
        lastTransactionAt: sw.lastTransactionAt || null,
        hasAccount: accountSet.has(accountKey(userId, "store", orgId)),
      });
    }
    for (const aw of affiliates as any[]) {
      const userId = aw.userId?._id || aw.userId;
      rows.push({
        walletId: String(aw._id),
        walletType: "affiliate",
        user: userOf(aw.userId),
        orgId: null,
        orgName: null,
        balance: aw.balance || 0,
        currency: aw.currency || "USD",
        lastTransactionAt: aw.lastTransactionAt || null,
        hasAccount: accountSet.has(accountKey(userId, "affiliate", null)),
      });
    }
    // Content Rewards: one OrgRewardsWallet row per (user, org). Emit one
    // display row per wallet, the same way StoreWallet rows render.
    for (const w of orgRewards as any[]) {
      const userId = w.userId?._id || w.userId;
      const orgId = w.orgId?._id || w.orgId;
      const orgIdStr = orgId ? String(orgId) : null;
      rows.push({
        walletId: String(w._id),
        walletType: "content_rewards",
        user: userOf(w.userId),
        orgId: orgIdStr,
        orgName: w.orgId?.name || null,
        // OrgRewardsWallet.balance is cents; surface USD floats here like
        // the other rows.
        balance: (w.balance || 0) / 100,
        currency: "USD",
        lastTransactionAt: null,
        // Payout accounts for CR are global per user (one bank/crypto
        // destination for ALL of a user's CR earnings, across every org).
        // Look up with orgId=null to match the WalletAccount keying.
        hasAccount: accountSet.has(
          accountKey(userId, "content_rewards", null)
        ),
      });
    }

    // Drop rows whose user vanished (deleted account).
    let filtered = rows.filter((r) => r.user);

    // Search
    if (q && q.length > 0) {
      const rx = new RegExp(
        q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filtered = filtered.filter(
        (r) => rx.test(r.user!.name || "") || rx.test(r.user!.email || "")
      );
    }

    if (hasFunds === "1") {
      filtered = filtered.filter((r) => r.balance > 0);
    }

    // Country facet, built BEFORE the country filter is applied — otherwise
    // choosing one country would collapse the dropdown to that single
    // option and there would be no way back without clearing it.
    const facet = new Map<string, { country: string; count: number }>();
    for (const r of filtered) {
      const key = normCountry(r.user!.country);
      if (!key) continue;
      const label = (r.user!.country || "").trim();
      const hit = facet.get(key);
      // Keep the spelling that appears most often as the display label, so
      // the list reads "India" rather than whichever variant came first.
      if (hit) hit.count++;
      else facet.set(key, { country: label, count: 1 });
    }
    const countries = [...facet.values()].sort(
      (a, b) => b.count - a.count || a.country.localeCompare(b.country)
    );

    // Same reasoning as the country facet: counted before either filter is
    // applied, so the two chips always show the full split and switching
    // between them never strands the admin on an empty list.
    const payoutCounts = {
      withAccount: filtered.filter((r) => r.hasAccount).length,
      withoutAccount: filtered.filter((r) => !r.hasAccount).length,
    };

    if (country) {
      const want = normCountry(country);
      filtered = filtered.filter((r) => normCountry(r.user!.country) === want);
    }

    // A wallet with no payout destination cannot be withdrawn from — this is
    // the "who still needs to set one up" list.
    if (payout === "yes") filtered = filtered.filter((r) => r.hasAccount);
    else if (payout === "no") filtered = filtered.filter((r) => !r.hasAccount);

    // Sort
    filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.user!.name || a.user!.email || "").localeCompare(
            b.user!.name || b.user!.email || ""
          );
        case "activity":
          return (
            (b.lastTransactionAt
              ? new Date(b.lastTransactionAt).getTime()
              : 0) -
            (a.lastTransactionAt
              ? new Date(a.lastTransactionAt).getTime()
              : 0)
          );
        case "balance":
        default:
          return b.balance - a.balance;
      }
    });

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return res.json(
      ok({
        items,
        total,
        limit,
        offset,
        /** Every country present in the unfiltered result, most common first. */
        countries,
        /** How the unfiltered result splits on having a payout destination. */
        payoutCounts,
      })
    );
  } catch (error) {
    console.error("Error listing user wallets:", error);
    return res.status(500).json(fail("Failed to list user wallets"));
  }
}

/**
 * List the invoice history for one organization (garage-admin view).
 *
 * Powers the "Invoice history" card on /garage-admin/organizations/[id].
 * Deliberately NOT inlined into getOrganizationById — an active org can
 * accumulate hundreds of invoices (recurring subs = 12/year each), and
 * a paginated dedicated endpoint keeps the org-detail response snappy.
 *
 * The invoice.model has a compound index on
 * { organizationId: 1, status: 1, createdAt: -1 } so both the unfiltered
 * and status-filtered queries hit the index cleanly.
 */
export async function listInvoicesForOrganization(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json(fail("Invalid organization id"));
    }

    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => {
          const n = v ? parseInt(v, 10) : 25;
          return Math.min(Math.max(n, 1), 100);
        }),
      offset: z
        .string()
        .optional()
        .transform((v) => Math.max(v ? parseInt(v, 10) : 0, 0)),
      status: z
        .enum([
          "draft",
          "pending",
          "paid",
          "failed",
          "cancelled",
          "refunded",
          "expired",
        ])
        .optional(),
      type: z.string().min(1).optional(),
    });
    const { limit, offset, status, type } = schema.parse(req.query);

    const orgObjectId = new Types.ObjectId(id);
    const query: Record<string, any> = { organizationId: orgObjectId };
    if (status) query.status = status;
    if (type) query.invoiceType = type;

    const [rows, total] = await Promise.all([
      Invoice.find(query)
        .select(
          "invoiceNumber invoiceType status totalAmount itemCurrency paymentCurrency " +
            "isRecurring recurringPeriod recurringPaymentNumber parentInvoiceId " +
            "lineItems createdAt paidAt nextDueDate cancelledAt"
        )
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    const invoices = rows.map((inv: any) => ({
      id: (inv._id as any).toString(),
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      status: inv.status,
      totalAmount: inv.totalAmount,
      itemCurrency: inv.itemCurrency,
      paymentCurrency: inv.paymentCurrency,
      isRecurring: !!inv.isRecurring,
      recurringPeriod: inv.recurringPeriod || null,
      recurringPaymentNumber: inv.recurringPaymentNumber || null,
      parentInvoiceId: inv.parentInvoiceId
        ? (inv.parentInvoiceId as any).toString()
        : null,
      // Compact display: first line item's name (invoices almost always
      // have exactly one; multi-item ecommerce carts are rare here).
      itemName: inv.lineItems?.[0]?.itemName || null,
      itemType: inv.lineItems?.[0]?.itemType || null,
      createdAt: inv.createdAt,
      paidAt: inv.paidAt || null,
      nextDueDate: inv.nextDueDate || null,
      cancelledAt: inv.cancelledAt || null,
    }));

    return res.json(
      ok({
        invoices,
        total,
        limit,
        offset,
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json(fail(error.issues[0]?.message || "Invalid query params"));
    }
    console.error("Error listing organization invoices:", error);
    return res
      .status(500)
      .json(fail("Failed to list organization invoices"));
  }
}

/**
 * GET /garage-admin/organizations/:id/sellable-items
 * Aggregates every catalog record this office publishes — channels,
 * workshops, courses, products, call offerings and services — into one
 * flat list for the admin org-detail page. Read-only, no pagination
 * (a founder's catalog is small enough to list on one page; if that
 * changes we'll paginate per-kind).
 *
 * Each model uses a different foreign key for the parent org
 * (`channel.storeId`, `workshop.orgId`, everything-else.organizationId)
 * — normalized here so the FE never has to care.
 */
export async function listSellableItemsForOrganization(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json(fail("Invalid organization id"));
    }
    const orgObjectId = new Types.ObjectId(id);

    const [
      channels,
      workshops,
      courses,
      products,
      calls,
      services,
    ] = await Promise.all([
      Channel.find({ storeId: orgObjectId })
        .select("title price currency isActive isSubscription subscriptionPeriod createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Workshop.find({ orgId: orgObjectId })
        .select("title price currency isActive createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Course.find({ organizationId: orgObjectId })
        .select("title price currency status createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Product.find({ organizationId: orgObjectId })
        .select("name price currency status createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      CallOffering.find({ organizationId: orgObjectId })
        .select("title pricePerCall currency status duration createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Service.find({ organizationId: orgObjectId })
        .select("title totalPrice currency status createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const items = [
      ...channels.map((c: any) => ({
        id: c._id.toString(),
        kind: "channel" as const,
        title: c.title,
        price: c.price ?? 0,
        currency: c.currency || "USD",
        status: c.isActive === false ? "inactive" : "active",
        isSubscription: !!c.isSubscription,
        subscriptionPeriod: c.subscriptionPeriod || null,
        createdAt: c.createdAt,
      })),
      ...workshops.map((w: any) => ({
        id: w._id.toString(),
        kind: "workshop" as const,
        title: w.title,
        price: w.price ?? 0,
        currency: w.currency || "USD",
        status: w.isActive === false ? "inactive" : "active",
        createdAt: w.createdAt,
      })),
      ...courses.map((c: any) => ({
        id: c._id.toString(),
        kind: "course" as const,
        title: c.title,
        price: c.price ?? 0,
        currency: c.currency || "USD",
        status: c.status || "draft",
        createdAt: c.createdAt,
      })),
      ...products.map((p: any) => ({
        id: p._id.toString(),
        kind: "product" as const,
        title: p.name,
        price: p.price ?? 0,
        currency: p.currency || "USD",
        status: p.status || "draft",
        createdAt: p.createdAt,
      })),
      ...calls.map((c: any) => ({
        id: c._id.toString(),
        kind: "call" as const,
        title: c.title,
        price: c.pricePerCall ?? 0,
        currency: c.currency || "USD",
        status: c.status || "draft",
        durationMinutes: c.duration ?? null,
        createdAt: c.createdAt,
      })),
      ...services.map((s: any) => ({
        id: s._id.toString(),
        kind: "service" as const,
        title: s.title,
        price: s.totalPrice ?? 0,
        currency: s.currency || "USD",
        status: s.status || "draft",
        createdAt: s.createdAt,
      })),
    ];

    // Newest first across all kinds — the org-detail page expects one
    // chronologically-sorted list, not per-kind buckets.
    items.sort((a, b) => {
      const at = new Date(a.createdAt as any).getTime();
      const bt = new Date(b.createdAt as any).getTime();
      return bt - at;
    });

    const countsByKind = {
      channel: channels.length,
      workshop: workshops.length,
      course: courses.length,
      product: products.length,
      call: calls.length,
      service: services.length,
    };

    return res.json(
      ok({
        items,
        total: items.length,
        countsByKind,
      })
    );
  } catch (error) {
    console.error("Error listing sellable items for organization:", error);
    return res
      .status(500)
      .json(fail("Failed to list sellable items"));
  }
}
