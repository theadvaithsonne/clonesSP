import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { TeamforceEmployeeTaxDeclaration } from "../../models/teamforce/teamforceEmployeeTaxDeclaration.model";
import { TeamforceEmployeeProfile } from "../../models/teamforce/teamforceEmployeeProfile.model";
import { TeamforcePTSlab } from "../../models/teamforce/teamforcePTSlab.model";
import { TeamforceSalaryStructure } from "../../models/teamforce/teamforceSalaryStructure.model";
import {
  getAuthUser,
  getOrgIdStrict,
  hasFullAccess,
} from "./_helpers";
import {
  computeSection192TDS,
  resolveStructure,
  ageOnDate,
  type PTSlab,
  type CityType,
  type Regime,
  type RawStructure,
} from "../../services/teamforce/payroll";

const router = Router();

const hraSchema = z.object({
  monthlyRentPaid: z.number().min(0).optional(),
  landlordName: z.string().trim().optional(),
  landlordPan: z.string().trim().optional(),
  ownsHouseInCity: z.boolean().optional(),
});

const prevEmpSchema = z.object({
  name: z.string().trim().optional(),
  tan: z.string().trim().optional(),
  grossSalary: z.number().min(0).optional(),
  tdsDeducted: z.number().min(0).optional(),
  ptPaid: z.number().min(0).optional(),
  pfPaid: z.number().min(0).optional(),
});

const upsertSchema = z.object({
  fy: z.string().trim().min(1),
  regime: z.enum(["OLD", "NEW"]).optional(),
  hraDeclaration: hraSchema.optional(),
  ltaClaimAmount: z.number().min(0).optional(),
  numChildren: z.number().int().min(0).max(10).optional(),
  declared80C: z.number().min(0).optional(),
  declaredNpsSelf: z.number().min(0).optional(),
  declared80DSelf: z.number().min(0).optional(),
  declared80DParent: z.number().min(0).optional(),
  parentSeniorCitizen: z.boolean().optional(),
  savingsInterest: z.number().min(0).optional(),
  fdInterest: z.number().min(0).optional(),
  declared80E: z.number().min(0).optional(),
  declared80EEA: z.number().min(0).optional(),
  declared80G: z.number().min(0).optional(),
  previousEmployer: prevEmpSchema.optional(),
});

/** Resolve which user this request applies to. Anyone can read/write their
 *  own declaration. Admins can read/write anyone's by passing `?userId=`. */
async function resolveTargetUserId(
  req: any,
  res: any
): Promise<string | null> {
  const me = getAuthUser(req);
  const queryUserId = (req.query.userId as string | undefined)?.trim();
  if (!queryUserId) return me.userId;
  if (queryUserId === me.userId) return me.userId;
  const isAdmin = await hasFullAccess(req);
  if (!isAdmin) {
    res
      .status(403)
      .json({ error: "Only admins can read another employee's declaration" });
    return null;
  }
  return queryUserId;
}

// GET /tax-declaration?fy=2024-25&userId=  → own (or someone else's if admin)
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const fy = (req.query.fy as string | undefined)?.trim();
  if (!fy) return res.status(400).json({ error: "fy is required" });

  const userId = await resolveTargetUserId(req, res);
  if (!userId) return;

  const decl = await TeamforceEmployeeTaxDeclaration.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    fy,
  }).lean();
  res.json({ declaration: decl });
});

// POST /tax-declaration  → upsert. Caller can only edit their own.
//  Admins can edit others' by passing ?userId=.
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const userId = await resolveTargetUserId(req, res);
  if (!userId) return;

  const body = upsertSchema.parse(req.body);

  const existing = await TeamforceEmployeeTaxDeclaration.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    fy: body.fy,
  }).lean();

  if (existing && existing.locked) {
    return res
      .status(409)
      .json({ error: "Declaration is locked for this FY and cannot be edited" });
  }

  const decl = await TeamforceEmployeeTaxDeclaration.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      fy: body.fy,
    },
    { $set: body },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  res.json({ declaration: decl });
});

// POST /tax-declaration/lock  → locks the declaration for the FY.
router.post("/lock", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const userId = await resolveTargetUserId(req, res);
  if (!userId) return;

  const fy = (req.body?.fy as string | undefined)?.trim();
  if (!fy) return res.status(400).json({ error: "fy is required" });

  const decl = await TeamforceEmployeeTaxDeclaration.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      fy,
    },
    { $set: { locked: true, lockedAt: new Date() } },
    { new: true }
  ).lean();

  if (!decl)
    return res.status(404).json({ error: "Declaration not found for this FY" });
  res.json({ declaration: decl });
});

// GET /tax-declaration/org-summary?fy=2024-25  → admin/founder only.
//   Returns all employees' declaration status for the org: name, filled,
//   regime selected, and lock state. Powers the "Organisation" toggle view.
router.get("/org-summary", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const isAdmin = await hasFullAccess(req);
  if (!isAdmin)
    return res.status(403).json({ error: "Requires founder or admin role" });

  const fy = (req.query.fy as string | undefined)?.trim();
  if (!fy) return res.status(400).json({ error: "fy is required" });

  const orgOid = new Types.ObjectId(orgId);

  const [profiles, declarations] = await Promise.all([
    TeamforceEmployeeProfile.find({ orgId: orgOid })
      .select("userId")
      .populate<{ userId: { _id: Types.ObjectId; name: string; email: string } }>(
        "userId",
        "name email"
      )
      .lean(),
    TeamforceEmployeeTaxDeclaration.find({ orgId: orgOid, fy })
      .select("userId regime locked")
      .lean(),
  ]);

  const declMap = new Map(
    declarations.map((d) => [d.userId.toString(), d])
  );

  const summary = profiles.map((p) => {
    const user = p.userId as unknown as { _id: Types.ObjectId; name: string; email: string };
    const userIdStr = user._id?.toString() ?? (p.userId as unknown as Types.ObjectId).toString();
    const decl = declMap.get(userIdStr);
    return {
      userId: userIdStr,
      name: user.name || "Unknown",
      email: user.email || "",
      filled: !!decl,
      regime: decl?.regime ?? null,
      locked: decl?.locked ?? false,
    };
  });

  res.json({ summary });
});

// POST /tax-declaration/unlock  → founder or admin unlock.
//   - When `userId` is omitted in the body, defaults to the caller's own
//     declaration (so a founder/admin can unlock their own without specifying).
//   - When `userId` is provided, unlocks that user's declaration.
router.post("/unlock", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const isAdmin = await hasFullAccess(req);
  if (!isAdmin)
    return res.status(403).json({ error: "Requires founder or admin role" });

  const me = getAuthUser(req);
  const userId =
    (req.body?.userId as string | undefined)?.trim() || me.userId;
  const fy = (req.body?.fy as string | undefined)?.trim();
  if (!fy) return res.status(400).json({ error: "fy is required" });

  const decl = await TeamforceEmployeeTaxDeclaration.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      fy,
    },
    { $set: { locked: false, lockedAt: null } },
    { new: true }
  ).lean();

  if (!decl)
    return res.status(404).json({ error: "Declaration not found for this FY" });
  res.json({ declaration: decl });
});

// GET /tax-declaration/regime-preview?fy=2024-25
//   Runs the Section 192 engine for both regimes against the current
//   declaration + the employee's profile. Returns a side-by-side comparison
//   so the employee can see which regime is cheaper for them.
router.get("/regime-preview", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const fy = (req.query.fy as string | undefined)?.trim();
  if (!fy) return res.status(400).json({ error: "fy is required" });

  const userId = await resolveTargetUserId(req, res);
  if (!userId) return;

  const orgOid = new Types.ObjectId(orgId);
  const userOid = new Types.ObjectId(userId);

  const [profile, decl, slabsRaw] = await Promise.all([
    TeamforceEmployeeProfile.findOne({ userId: userOid, orgId: orgOid }).lean(),
    TeamforceEmployeeTaxDeclaration.findOne({
      userId: userOid,
      orgId: orgOid,
      fy,
    }).lean(),
    TeamforcePTSlab.find({ isActive: true }).lean(),
  ]);

  if (!profile)
    return res
      .status(404)
      .json({ error: "Employee profile not found in this org" });

  const slabs: PTSlab[] = slabsRaw.map((s: any) => ({
    state: s.state,
    grossFrom: s.grossFrom,
    grossTo: s.grossTo,
    monthlyPT: s.monthlyPT,
    monthOverride: s.monthOverride,
  }));

  // Resolve monthly anchors. Prefer the structure-driven path (Phase 5
  // model: salaryStructureId + monthlyCtc); fall back to the legacy fields
  // (basicSalary / hra / transportAllowance / variablePay) for employees
  // whose profile predates the structure work.
  let basicMonthly = 0;
  let daMonthly = 0;
  let hraMonthly = 0;
  let ltaMonthly = 0;
  let educationAllowanceMonthly = 0;
  let hostelAllowanceMonthly = 0;
  let employerNpsMonthly = 0;
  let monthlyGross = 0;

  if (profile.salaryStructureId && (profile.monthlyCtc || 0) > 0) {
    const structure = await TeamforceSalaryStructure.findOne({
      _id: profile.salaryStructureId,
      orgId: orgOid,
      isActive: true,
    }).lean();
    if (structure) {
      const r = resolveStructure({
        structure: structure as unknown as RawStructure,
        monthlyCtc: profile.monthlyCtc || 0,
      });
      basicMonthly = r.basicMonthly;
      daMonthly = r.daMonthly;
      hraMonthly = r.hraMonthly;
      ltaMonthly = r.ltaMonthly;
      educationAllowanceMonthly = r.educationAllowanceMonthly;
      hostelAllowanceMonthly = r.hostelAllowanceMonthly;
      employerNpsMonthly = r.employerNpsMonthly;
      monthlyGross = r.grossMonthly;
    }
  }
  if (monthlyGross === 0) {
    // Legacy fallback
    basicMonthly = profile.basicSalary || 0;
    hraMonthly = profile.hra || 0;
    monthlyGross =
      basicMonthly +
      hraMonthly +
      (profile.transportAllowance || 0) +
      (profile.variablePay || 0);
  }

  // Use April as the projection month so projection = 12× current month.
  // This gives a clean full-FY estimate independent of the actual run-month.
  const payrollMonth = 4;
  const payrollYear = Number(fy.split("-")[0]) || new Date().getFullYear();

  // Derive age from profile.dateOfBirth (added in Phase 7); fall back to 35
  // when DOB hasn't been captured. Only matters for Old Regime senior slabs.
  const age = profile.dateOfBirth
    ? ageOnDate(profile.dateOfBirth as Date)
    : 35;

  const cityType: CityType =
    (profile.cityType as CityType | undefined) === "METRO" ? "METRO" : "NON_METRO";
  const state = profile.state || "Karnataka";

  const baseInput = {
    age,
    state,
    cityType,
    // Form 12B (§13.1) — fold previous-employer figures into YTD so the
    // preview reflects what THIS employer would actually deduct for a
    // mid-FY joiner.
    ytdActualGross: decl?.previousEmployer?.grossSalary || 0,
    ytdTdsDeducted: decl?.previousEmployer?.tdsDeducted || 0,
    ytdPtPaid: decl?.previousEmployer?.ptPaid || 0,
    ytdPfEmployeeAnnual:
      (decl?.previousEmployer?.pfPaid || 0) +
      (profile.providentFund || 0) * 12,
    payrollMonth,
    payrollYear,
    monthlyGross,
    basicAnnual: basicMonthly * 12,
    daAnnual: daMonthly * 12,
    hraAnnual: hraMonthly * 12,
    ltaAnnual: ltaMonthly * 12,
    educationAllowanceAnnual: educationAllowanceMonthly * 12,
    hostelAllowanceAnnual: hostelAllowanceMonthly * 12,
    employerNpsAnnual: employerNpsMonthly * 12,

    // From declaration (only HRA / 80C / etc.; old-regime engine inputs)
    hraDeclaration: decl?.hraDeclaration && decl.hraDeclaration.monthlyRentPaid
      ? {
          monthlyRentPaid: decl.hraDeclaration.monthlyRentPaid || 0,
          ownsHouseInCity: !!decl.hraDeclaration.ownsHouseInCity,
          rentDeclarationProvided: true,
          landlordPanProvided: !!decl.hraDeclaration.landlordPan,
        }
      : undefined,
    ltaClaimAmount: decl?.ltaClaimAmount || 0,
    numChildren: decl?.numChildren || 0,
    declared80C: decl?.declared80C || 0,
    declaredNpsSelf: decl?.declaredNpsSelf || 0,
    declared80DSelf: decl?.declared80DSelf || 0,
    declared80DParent: decl?.declared80DParent || 0,
    parentSeniorCitizen: !!decl?.parentSeniorCitizen,
    savingsInterest: decl?.savingsInterest || 0,
    fdInterest: decl?.fdInterest || 0,
    declared80E: decl?.declared80E || 0,
    declared80EEA: decl?.declared80EEA || 0,
    declared80G: decl?.declared80G || 0,
    ptSlabs: slabs,
  };

  const oldResult = computeSection192TDS({ ...baseInput, regime: "OLD" as Regime });
  const newResult = computeSection192TDS({ ...baseInput, regime: "NEW" as Regime });

  const recommended: Regime =
    newResult.annualTaxLiability <= oldResult.annualTaxLiability ? "NEW" : "OLD";
  const saving = Math.abs(
    oldResult.annualTaxLiability - newResult.annualTaxLiability
  );

  res.json({
    fy,
    monthlyGross,
    projectedAnnualGross: monthlyGross * 12,
    old: oldResult,
    new: newResult,
    recommended,
    saving,
    currentRegime: decl?.regime || "NEW",
  });
});

export default router;
