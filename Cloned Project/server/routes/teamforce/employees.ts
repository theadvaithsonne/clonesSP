import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { User } from "../../models/user.model";
import { Invite } from "../../models/invite.model";
import { TeamforceEmployeeProfile } from "../../models/teamforce/teamforceEmployeeProfile.model";
import {
  getAuthUser,
  getOrgIdStrict,
  hasFullAccess,
  requireTeamforceWriteAccess,
  requireFounderOnly,
  stripSensitive,
  SENSITIVE_FIELDS,
  MANAGER_ONLY_FIELDS,
} from "./_helpers";

const router = Router();

// Employee-status tracking (Invited/Onboarded/Inactive) only makes sense for
// people who joined through the new invite flow. Anyone who already had a
// membership before this feature shipped gets forced to "active" so they
// don't suddenly show a stale "Onboarded"/"Inactive" badge — regardless of
// whether they happen to have a profile or a leftover invite record.
// STATUS_TRACKING_EXEMPT_EMAILS lets specific test accounts bypass that
// override so their real computed status still shows.
const STATUS_TRACKING_SINCE = new Date("2026-07-09T17:56:53.000Z");
const STATUS_TRACKING_EXEMPT_EMAILS = new Set(["crossuquejavu-7721@yopmail.com"]);

// ------------------------------------------------------------------
// GET / — List all org members with their Teamforce profiles (if any)
// ------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const orgOid = new Types.ObjectId(orgId);
  const fullAccess = await hasFullAccess(req);

  // All users who have a NON-GUEST membership in this org.
  // The per-org membership.guest flag is the source of truth for "is this
  // person a guest in *this* org". The top-level User.guest flag tracks
  // origin (e.g. they signed up via a guest flow elsewhere) and must NOT
  // be used to exclude them — they may be a full stakeholder here.
  const members = await User.find({
    organizations: {
      $elemMatch: {
        organization: orgOid,
        $or: [{ guest: false }, { guest: { $exists: false } }],
      },
    },
  })
    .select("name email profilePicture organizations createdAt")
    .lean();

  // All Teamforce profiles for this org
  const profiles = await TeamforceEmployeeProfile.find({ orgId: orgOid })
    .populate("branchId", "name")
    .populate("departmentId", "name")
    .lean();

  const profileMap = new Map(
    profiles.map((p: any) => [p.userId.toString(), p])
  );

  // Invites for this org — used to derive Invited/Inactive status for
  // members who joined via an email invite but haven't filled the
  // onboarding profile yet. Members with no matching invite (e.g. added
  // via Manual Entry/Bulk Upload, or pre-existing data) default to Active.
  // Revoked invites are excluded — they're not a live "invite sent" signal.
  const invites = await Invite.find({ orgId: orgOid, status: { $ne: "revoked" } })
    .select("email name role updatedAt")
    .lean();
  const inviteMap = new Map(
    invites.map((inv: any) => [inv.email.toLowerCase(), inv])
  );
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const memberEmails = new Set(
    (members as any[]).map((m: any) => (m.email || "").toLowerCase())
  );

  const employees = members.map((member: any) => {
    const membership = member.organizations?.find(
      (o: any) => o.organization?.toString() === orgId
    );
    if (!membership) return null;
    // Defense-in-depth: skip guest memberships (the $elemMatch above
    // should already exclude them, but double-check at the row level).
    if (membership.guest === true) return null;

    const rawProfile = profileMap.get(member._id.toString()) || null;
    const profile = stripSensitive(rawProfile, fullAccess);

    let status: "invited" | "onboarded" | "active" | "inactive";
    if (rawProfile) {
      // HR has finished setting them up (Bulk Assign sets these together)
      // once both Department and Reporting Manager are on the profile —
      // that's the signal that promotes them from self-filled "Onboarded"
      // to fully "Active", rather than requiring a separate stored field.
      const hrAssigned = !!rawProfile.departmentId && !!rawProfile.reportingManagerId;
      status = hrAssigned ? "active" : "onboarded";
    } else {
      const invite = inviteMap.get((member.email || "").toLowerCase());
      if (!invite) {
        status = "active";
      } else {
        // updatedAt (not createdAt) so a resent invite restarts the 24h
        // window — the "invite:create" route upserts the same doc on
        // re-invite, so createdAt would stay stuck on the original send.
        const ageMs = Date.now() - new Date(invite.updatedAt).getTime();
        status = ageMs < ONE_DAY_MS ? "invited" : "inactive";
      }
    }

    // Legacy override — pre-existing members always show Active unless
    // explicitly exempted (see STATUS_TRACKING_SINCE comment above).
    const memberEmail = (member.email || "").toLowerCase();
    if (
      !STATUS_TRACKING_EXEMPT_EMAILS.has(memberEmail) &&
      membership.joinedAt &&
      new Date(membership.joinedAt) < STATUS_TRACKING_SINCE
    ) {
      status = "active";
    }

    return {
      userId: member._id.toString(),
      name: member.name || member.email?.split("@")[0] || "Unknown",
      email: member.email || "",
      profilePicture: member.profilePicture || null,
      role: membership.role,
      joinedAt: membership.joinedAt,
      hasProfile: !!rawProfile,
      teamforceRole: rawProfile?.teamforceRole || "member",
      profile,
      status,
      isPending: false,
    };
  }).filter(Boolean);

  // Pending invitees — invite sent but they haven't completed OTP signup
  // yet, so there's no User/membership for them. Synthesized as read-only
  // rows (no profile, no real userId) so admins can see "invite sent,
  // still waiting" instead of the invite silently disappearing from view.
  const pendingInvitees = invites
    .filter((inv: any) => !memberEmails.has(inv.email.toLowerCase()))
    .map((inv: any) => {
      const ageMs = Date.now() - new Date(inv.updatedAt).getTime();
      return {
        userId: `invite:${inv._id.toString()}`,
        name: inv.name || inv.email.split("@")[0],
        email: inv.email,
        profilePicture: null,
        role: inv.role === "founder" ? "founder" : "stakeholder",
        joinedAt: "",
        hasProfile: false,
        teamforceRole: "member",
        profile: null,
        status: ageMs < ONE_DAY_MS ? "invited" : "inactive",
        isPending: true,
      };
    });

  res.json({ employees: [...employees, ...pendingInvitees] });
});

// ------------------------------------------------------------------
// GET /:userId — Single employee detail
// ------------------------------------------------------------------
router.get("/:userId", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const orgOid = new Types.ObjectId(orgId);
  const userId = req.params.userId;

  const user = await User.findOne({
    _id: new Types.ObjectId(userId),
    "organizations.organization": orgOid,
  })
    .select("name email profilePicture organizations createdAt")
    .lean();

  if (!user) return res.status(404).json({ error: "Employee not found in this organization" });

  const membership = (user as any).organizations?.find(
    (o: any) => o.organization?.toString() === orgId
  );

  const fullAccess = await hasFullAccess(req);

  const rawProfile = await TeamforceEmployeeProfile.findOne({
    userId: new Types.ObjectId(userId),
    orgId: orgOid,
  })
    .populate("branchId", "name")
    .populate("departmentId", "name")
    .populate("reportingManagerId", "name email")
    .populate("secondaryReviewerId", "name email")
    .populate("shiftId", "name startTime endTime")
    .populate("weeklyOffPatternId", "name offDays")
    .lean();

  const profile = stripSensitive(rawProfile as any, fullAccess);

  res.json({
    userId: (user as any)._id.toString(),
    name: (user as any).name || (user as any).email?.split("@")[0] || "Unknown",
    email: (user as any).email || "",
    profilePicture: (user as any).profilePicture || null,
    role: membership?.role,
    joinedAt: membership?.joinedAt,
    hasProfile: !!rawProfile,
    teamforceRole: rawProfile?.teamforceRole || "member",
    profile,
  });
});

// ------------------------------------------------------------------
// POST / — Upsert employee profile (find-or-create User + add to org)
// ------------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      mobileNumber: z.string().optional(),
      pan: z.string().trim().optional(),
      dateOfBirth: z.string().optional(),
      exitedAt: z.string().nullable().optional(),
      exitReason: z.string().trim().optional(),
      permanentAddress: z.string().optional(),
      currentAddress: z.string().optional(),
      sameAsPermanent: z.boolean().optional(),
      dateOfJoining: z.string().optional(),
      placeOfJoining: z.string().optional(),
      branchId: z.string().optional(),
      departmentId: z.string().optional(),
      designation: z.string().optional(),
      employmentType: z
        .enum(["full-time", "part-time", "contract", "intern", "freelance"])
        .optional(),
      state: z.string().optional(),
      cityType: z.enum(["METRO", "NON_METRO"]).optional(),
      reportingManagerId: z.string().optional(),
      secondaryReviewerId: z.string().nullable().optional(),
      managesTeam: z.boolean().optional(),
      education: z
        .array(
          z.object({
            degreeName: z.string().optional(),
            yearOfPassing: z.string().optional(),
            certificateUrl: z.string().optional(),
          })
        )
        .optional(),
      workExperience: z
        .array(
          z.object({
            companyName: z.string().optional(),
            yearsOfExperience: z.string().optional(),
            designation: z.string().optional(),
            referenceName: z.string().optional(),
            referenceContact: z.string().optional(),
          })
        )
        .optional(),
      salaryStructureId: z.string().optional(),
      monthlyCtc: z.number().min(0).optional(),
      basicSalary: z.number().optional(),
      hra: z.number().optional(),
      transportAllowance: z.number().optional(),
      providentFund: z.number().optional(),
      professionalTax: z.number().optional(),
      variablePay: z.number().optional(),
      customAllowances: z
        .array(z.object({ name: z.string(), amount: z.number() }))
        .optional(),
      customDeductions: z
        .array(z.object({ name: z.string(), amount: z.number() }))
        .optional(),
      pfOption: z.enum(["CEILING", "ACTUAL"]).optional(),
      esiApplicable: z.boolean().optional(),
      tdsRegime: z.enum(["new", "old"]).optional(),
      estimatedAnnualTds: z.number().optional(),
      autoCalculateTds: z.boolean().optional(),
      shiftId: z.string().optional(),
      weeklyOffPatternId: z.string().optional(),
      offerLetterUrl: z.string().optional(),
      idProofUrl: z.string().optional(),
      educationCertificatesUrl: z.string().optional(),
      experienceLettersUrl: z.string().optional(),
      bankAccountHolderName: z.string().optional(),
      bankAccountType: z.enum(["savings", "current"]).optional(),
      bankAccountNumber: z.string().optional(),
      bankIfscCode: z.string().optional(),
    });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`).join("; "),
    });
  }
  const body = parsed.data;

  const orgOid = new Types.ObjectId(orgId);

  // Find or create User
  let user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user) {
    user = await User.create({
      email: body.email.toLowerCase(),
      name: body.name || body.email.split("@")[0],
      organizations: [
        {
          organization: orgOid,
          role: "stakeholder",
          joinedAt: new Date(),
        },
      ],
    });
  } else {
    // Check if already in org, if not add
    const alreadyMember = user.organizations?.some(
      (o: any) => o.organization?.toString() === orgId
    );
    if (!alreadyMember) {
      user.organizations = user.organizations || [];
      user.organizations.push({
        organization: orgOid,
        role: "stakeholder",
        joinedAt: new Date(),
      } as any);
      await user.save();
    }
  }

  // Update user name if provided and user has no name
  if (body.name && !user.name) {
    user.name = body.name;
    await user.save();
  }

  // Build profile update (exclude email/name — those are on User)
  const { email, name, ...profileFields } = body;

  // Convert string IDs to ObjectId where needed
  const profileData: any = { ...profileFields };
  if (profileData.branchId)
    profileData.branchId = new Types.ObjectId(profileData.branchId);
  if (profileData.departmentId)
    profileData.departmentId = new Types.ObjectId(profileData.departmentId);
  if (profileData.reportingManagerId)
    profileData.reportingManagerId = new Types.ObjectId(
      profileData.reportingManagerId
    );
  if (profileData.secondaryReviewerId) {
    profileData.secondaryReviewerId = new Types.ObjectId(
      profileData.secondaryReviewerId
    );
  } else if (profileData.secondaryReviewerId === null) {
    profileData.secondaryReviewerId = null;
  }
  if (profileData.salaryStructureId)
    profileData.salaryStructureId = new Types.ObjectId(
      profileData.salaryStructureId
    );
  if (profileData.shiftId)
    profileData.shiftId = new Types.ObjectId(profileData.shiftId);
  if (profileData.weeklyOffPatternId)
    profileData.weeklyOffPatternId = new Types.ObjectId(
      profileData.weeklyOffPatternId
    );
  if (profileData.dateOfJoining)
    profileData.dateOfJoining = new Date(profileData.dateOfJoining);
  if (profileData.dateOfBirth)
    profileData.dateOfBirth = new Date(profileData.dateOfBirth);

  // Upsert profile
  const profile = await TeamforceEmployeeProfile.findOneAndUpdate(
    {
      userId: user._id,
      orgId: orgOid,
    },
    { $set: profileData },
    { upsert: true, new: true }
  ).lean();

  res.status(201).json({
    userId: user._id.toString(),
    name: user.name || user.email?.split("@")[0],
    email: user.email,
    profile,
  });
});

// ------------------------------------------------------------------
// PATCH /:userId — Update profile fields
//   - Founders & Teamforce Admins: full write access
//   - Self (caller editing their own profile): limited write access —
//     salary/bank/TDS + manager-controlled fields are stripped server-side
// ------------------------------------------------------------------
router.patch("/:userId", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const me = getAuthUser(req);
  const isSelfEdit = me.userId === req.params.userId;
  const isManager = await hasFullAccess(req);

  if (!isSelfEdit && !isManager) {
    return res
      .status(403)
      .json({ error: "Requires founder or Teamforce Admin role" });
  }

  const orgOid = new Types.ObjectId(orgId);
  const userId = new Types.ObjectId(req.params.userId);

  // Verify user is in org
  const user = await User.findOne({
    _id: userId,
    "organizations.organization": orgOid,
  })
    .select("_id")
    .lean();

  if (!user)
    return res
      .status(404)
      .json({ error: "Employee not found in this organization" });

  const body = { ...req.body };

  // If this is a self-edit and the caller isn't also a manager, strip fields
  // employees can't change on themselves (salary, bank, TDS, role assignment,
  // reporting manager, etc.) so they can never escalate or change compensation.
  if (isSelfEdit && !isManager) {
    for (const field of SENSITIVE_FIELDS) delete body[field];
    for (const field of MANAGER_ONLY_FIELDS) delete body[field];
  }

  // Convert string IDs to ObjectId
  const update: any = { ...body };
  if (update.branchId)
    update.branchId = new Types.ObjectId(update.branchId);
  if (update.departmentId)
    update.departmentId = new Types.ObjectId(update.departmentId);
  if (update.reportingManagerId)
    update.reportingManagerId = new Types.ObjectId(
      update.reportingManagerId
    );
  if (update.secondaryReviewerId) {
    update.secondaryReviewerId = new Types.ObjectId(
      update.secondaryReviewerId
    );
  }
  if (update.salaryStructureId)
    update.salaryStructureId = new Types.ObjectId(update.salaryStructureId);
  if (update.shiftId) update.shiftId = new Types.ObjectId(update.shiftId);
  if (update.weeklyOffPatternId)
    update.weeklyOffPatternId = new Types.ObjectId(
      update.weeklyOffPatternId
    );
  if (update.dateOfJoining)
    update.dateOfJoining = new Date(update.dateOfJoining);
  if (update.dateOfBirth)
    update.dateOfBirth = new Date(update.dateOfBirth);
  if (update.exitedAt === null) {
    update.exitedAt = null;
  } else if (update.exitedAt) {
    const lwdDate = new Date(update.exitedAt);
    if (isNaN(lwdDate.getTime())) {
      res.status(400).json({ error: "Invalid Last Working Date" });
      return;
    }
    const maxLwd = new Date();
    maxLwd.setMonth(maxLwd.getMonth() + 6);
    if (lwdDate > maxLwd) {
      res.status(400).json({ error: "Last Working Date cannot be more than 6 months in the future" });
      return;
    }
    if (update.dateOfJoining) {
      const doj = new Date(update.dateOfJoining as string);
      if (!isNaN(doj.getTime())) {
        const tenureYears = (lwdDate.getTime() - doj.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (tenureYears > 50) {
          res.status(400).json({ error: "Duration between Date of Joining and Last Working Date cannot exceed 50 years" });
          return;
        }
      }
    }
    update.exitedAt = lwdDate;
  }

  // Don't allow setting teamforceRole via this endpoint
  delete update.teamforceRole;
  // name lives on the User model, not the profile — extract before profile $set
  const nameUpdate = typeof update.name === "string" ? update.name.trim() : null;
  delete update.name;

  const profile = await TeamforceEmployeeProfile.findOneAndUpdate(
    { userId, orgId: orgOid },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  // Update User.name only when a manager explicitly provides it
  if (nameUpdate && isManager) {
    await User.findByIdAndUpdate(userId, { $set: { name: nameUpdate } });
  }

  res.json({ profile });
});

// ------------------------------------------------------------------
// PATCH /:userId/role — Set teamforceRole (founder-only)
// ------------------------------------------------------------------
router.patch("/:userId/role", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!requireFounderOnly(req, res)) return;

  const body = z
    .object({
      teamforceRole: z.enum(["admin", "member"]),
    })
    .parse(req.body);

  const orgOid = new Types.ObjectId(orgId);
  const userId = new Types.ObjectId(req.params.userId);

  // Verify user is in org
  const user = await User.findOne({
    _id: userId,
    "organizations.organization": orgOid,
  })
    .select("_id")
    .lean();

  if (!user)
    return res
      .status(404)
      .json({ error: "User not found in this organization" });

  const profile = await TeamforceEmployeeProfile.findOneAndUpdate(
    { userId, orgId: orgOid },
    { $set: { teamforceRole: body.teamforceRole } },
    { upsert: true, new: true }
  ).lean();

  res.json({ profile });
});

// ------------------------------------------------------------------
// DELETE /:userId/profile — Delete profile only (not org membership)
// ------------------------------------------------------------------
router.delete("/:userId/profile", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  await TeamforceEmployeeProfile.deleteOne({
    userId: new Types.ObjectId(req.params.userId),
    orgId: new Types.ObjectId(orgId),
  });

  res.json({ ok: true });
});

export default router;
