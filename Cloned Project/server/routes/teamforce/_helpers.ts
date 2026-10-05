import { Request, Response } from "express";
import { Types } from "mongoose";
import { TeamforceEmployeeProfile } from "../../models/teamforce/teamforceEmployeeProfile.model";

type AuthUser = { userId: string; orgId: string; role: string };

export function getAuthUser(req: Request): AuthUser {
  return (req as any).user as AuthUser;
}

export function getOrgIdStrict(
  req: Request,
  res: Response
): string | null {
  // Prefer the orgId the client sends as a query param (sourced from
  // localStorage `garage_org_id`) so the user's currently-selected org
  // always wins. Fall back to the JWT-embedded orgId for older callers.
  const queryOrg = (req.query.orgId as string | undefined)?.trim();
  const me = getAuthUser(req);
  const orgId = queryOrg || me.orgId;
  if (!orgId) {
    res.status(400).json({ error: "No organization selected" });
    return null;
  }
  return orgId;
}

export function isFounder(req: Request): boolean {
  return getAuthUser(req).role === "founder";
}

export async function hasFullAccess(req: Request): Promise<boolean> {
  const me = getAuthUser(req);
  if (me.role === "founder") return true;

  // Use the same org the rest of the request is scoped to (query > JWT).
  const queryOrg = (req.query.orgId as string | undefined)?.trim();
  const orgId = queryOrg || me.orgId;
  if (!orgId) return false;

  const profile = await TeamforceEmployeeProfile.findOne({
    userId: new Types.ObjectId(me.userId),
    orgId: new Types.ObjectId(orgId),
  })
    .select("teamforceRole")
    .lean();

  return profile?.teamforceRole === "admin";
}

export async function requireTeamforceWriteAccess(
  req: Request,
  res: Response
): Promise<boolean> {
  const allowed = await hasFullAccess(req);
  if (!allowed) {
    res
      .status(403)
      .json({ error: "Requires founder or Teamforce Admin role" });
    return false;
  }
  return true;
}

/** Recruitment access: founder, Teamforce admin, or any employee
 *  whose profile has managesTeam=true (treated as "manager"). */
export async function hasRecruitmentAccess(req: Request): Promise<boolean> {
  const me = getAuthUser(req);
  if (me.role === "founder") return true;

  const queryOrg = (req.query.orgId as string | undefined)?.trim();
  const orgId = queryOrg || me.orgId;
  if (!orgId) return false;

  const profile = await TeamforceEmployeeProfile.findOne({
    userId: new Types.ObjectId(me.userId),
    orgId: new Types.ObjectId(orgId),
  })
    .select("teamforceRole managesTeam")
    .lean();

  if (!profile) return false;
  return profile.teamforceRole === "admin" || profile.managesTeam === true;
}

export async function requireRecruitmentAccess(
  req: Request,
  res: Response
): Promise<boolean> {
  const allowed = await hasRecruitmentAccess(req);
  if (!allowed) {
    res
      .status(403)
      .json({ error: "Requires founder, admin, or manager role" });
    return false;
  }
  return true;
}

export function requireFounderOnly(
  req: Request,
  res: Response
): boolean {
  if (!isFounder(req)) {
    res.status(403).json({ error: "Founder access required" });
    return false;
  }
  return true;
}

export const SENSITIVE_FIELDS = [
  // Salary & payroll
  "salaryStructureId",
  "monthlyCtc",
  "basicSalary",
  "hra",
  "transportAllowance",
  "providentFund",
  "professionalTax",
  "variablePay",
  "customAllowances",
  "customDeductions",
  "tdsRegime",
  "estimatedAnnualTds",
  "autoCalculateTds",
  "pfOption",
  "esiApplicable",
  // Hierarchy — reportingManagerId stays readable (org chart on the employee
  // details page); writes are still blocked via MANAGER_ONLY_FIELDS.
  "secondaryReviewerId",
  "managesTeam",
  // Attendance policy — admin-assigned
  "shiftId",
  "weeklyOffPatternId",
  // Documents — offer letter is admin-uploaded only
  "offerLetterUrl",
  // Exit / F&F — admin-only
  "exitedAt",
  "exitReason",
];

/** Fields an employee is NEVER allowed to set on themselves, even in self-edit
 *  (these are HR/manager-controlled, not self-service). */
export const MANAGER_ONLY_FIELDS = [
  "teamforceRole",
  "reportingManagerId",
  "secondaryReviewerId",
  "branchId",
  "departmentId",
  "designation",
  "employmentType",
  "dateOfJoining",
  "placeOfJoining",
  "managesTeam",
  "shiftId",
  "weeklyOffPatternId",
  "state",
  "cityType",
  "exitedAt",
  "exitReason",
];

export function stripSensitive(
  profile: Record<string, any> | null,
  fullAccess: boolean
): Record<string, any> | null {
  if (!profile || fullAccess) return profile;
  const cleaned = { ...profile };
  for (const field of SENSITIVE_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}
