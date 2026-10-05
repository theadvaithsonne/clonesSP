import { api } from "@/lib/api";
import { getOrgId } from "@/lib/auth";
import type {
  EmployeeListItem,
  EmployeeProfile,
  Branch,
  Department,
  Shift,
  WeeklyOffPattern,
  LeavePolicy,
  BreakPolicy,
  BreakStatus,
  SalaryStructure,
  SalaryStructureDefaults,
  PayrollConfig,
  PTSlab,
  EmployeeTaxDeclaration,
  RegimePreview,
  OrgTaxSummaryEntry,
  PayrollRun,
  PayrollRunCreateResult,
  PayrollTransaction,
  Form16Response,
  MonthSummaryResponse,
  PartialPayrollScope,
  RecruitmentRequest,
  RecruitmentRequestPayload,
  RecruitmentStatus,
  Candidate,
  CandidateApplyPayload,
  CandidateStage,
  CustomFieldDef,
} from "./types";

/** Append the currently-selected orgId (from localStorage) to a path as a
 *  query param. The backend prefers this over the JWT-embedded orgId so the
 *  user's active org always wins. */
function withOrg(path: string): string {
  const orgId = getOrgId();
  if (!orgId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}orgId=${encodeURIComponent(orgId)}`;
}

// Employees
export async function listEmployees() {
  return api<{ employees: EmployeeListItem[] }>(withOrg("/teamforce/employees"));
}

export async function getEmployee(userId: string) {
  return api<EmployeeListItem>(withOrg(`/teamforce/employees/${userId}`));
}

export async function upsertEmployee(payload: Record<string, unknown>) {
  return api<{ userId: string; name: string; email: string; profile: EmployeeProfile }>(
    withOrg("/teamforce/employees"),
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function updateEmployeeProfile(
  userId: string,
  patch: Record<string, unknown>
) {
  return api<{ profile: EmployeeProfile }>(
    withOrg(`/teamforce/employees/${userId}`),
    { method: "PATCH", body: JSON.stringify(patch) }
  );
}

export async function setTeamforceRole(
  userId: string,
  teamforceRole: "admin" | "member"
) {
  return api<{ profile: EmployeeProfile }>(
    withOrg(`/teamforce/employees/${userId}/role`),
    { method: "PATCH", body: JSON.stringify({ teamforceRole }) }
  );
}

export async function deleteEmployeeProfile(userId: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/employees/${userId}/profile`), {
    method: "DELETE",
  });
}

// Branches
export async function listBranches() {
  return api<{ branches: Branch[] }>(withOrg("/teamforce/branches"));
}

export async function createBranch(data: Partial<Branch>) {
  return api<{ branch: Branch }>(withOrg("/teamforce/branches"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  return api<{ branch: Branch }>(withOrg(`/teamforce/branches/${id}`), {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteBranch(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/branches/${id}`), {
    method: "DELETE",
  });
}

// Departments
export async function listDepartments() {
  return api<{ departments: Department[] }>(withOrg("/teamforce/departments"));
}

export async function createDepartment(data: Partial<Department>) {
  return api<{ department: Department }>(withOrg("/teamforce/departments"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDepartment(
  id: string,
  data: Partial<Department>
) {
  return api<{ department: Department }>(withOrg(`/teamforce/departments/${id}`), {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDepartment(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/departments/${id}`), {
    method: "DELETE",
  });
}

// Shifts
export async function listShifts() {
  return api<{ shifts: Shift[] }>(withOrg("/teamforce/shifts"));
}

export async function createShift(data: Partial<Shift>) {
  return api<{ shift: Shift }>(withOrg("/teamforce/shifts"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateShift(id: string, data: Partial<Shift>) {
  return api<{ shift: Shift }>(withOrg(`/teamforce/shifts/${id}`), {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteShift(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/shifts/${id}`), {
    method: "DELETE",
  });
}

// Weekly Off Patterns
export async function listWeeklyOffPatterns() {
  return api<{ patterns: WeeklyOffPattern[] }>(
    withOrg("/teamforce/weekly-off-patterns")
  );
}

export async function createWeeklyOffPattern(
  data: Partial<WeeklyOffPattern>
) {
  return api<{ pattern: WeeklyOffPattern }>(
    withOrg("/teamforce/weekly-off-patterns"),
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function updateWeeklyOffPattern(
  id: string,
  data: Partial<WeeklyOffPattern>
) {
  return api<{ pattern: WeeklyOffPattern }>(
    withOrg(`/teamforce/weekly-off-patterns/${id}`),
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteWeeklyOffPattern(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/weekly-off-patterns/${id}`), {
    method: "DELETE",
  });
}

// Break Policies (list / CRUD) + Status
export async function listBreakPolicies() {
  return api<{ policies: BreakPolicy[] }>(
    withOrg("/teamforce/break-settings")
  );
}

export async function createBreakPolicy(data: Partial<BreakPolicy>) {
  return api<{ policy: BreakPolicy }>(withOrg("/teamforce/break-settings"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBreakPolicy(
  id: string,
  data: Partial<BreakPolicy>
) {
  return api<{ policy: BreakPolicy }>(
    withOrg(`/teamforce/break-settings/${id}`),
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteBreakPolicy(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/break-settings/${id}`), {
    method: "DELETE",
  });
}

export async function getBreakStatus() {
  return api<BreakStatus>(withOrg("/teamforce/break-settings/status"));
}

// Leave Policies
export async function listLeavePolicies() {
  return api<{ policies: LeavePolicy[] }>(
    withOrg("/teamforce/leave-policies")
  );
}

export async function createLeavePolicy(data: Partial<LeavePolicy>) {
  return api<{ policy: LeavePolicy }>(withOrg("/teamforce/leave-policies"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLeavePolicy(
  id: string,
  data: Partial<LeavePolicy>
) {
  return api<{ policy: LeavePolicy }>(
    withOrg(`/teamforce/leave-policies/${id}`),
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteLeavePolicy(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/leave-policies/${id}`), {
    method: "DELETE",
  });
}

// Leave Requests
export type LeaveType =
  | "Casual Leave"
  | "Sick Leave"
  | "Earned Leave"
  | "Official Duty";

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveRequest {
  _id: string;
  userId:
    | string
    | { _id: string; name: string; email: string };
  orgId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  approverUserId?: string;
  approverName?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  reason: string;
  attachmentUrl?: string;
}

export async function createLeaveRequest(data: LeaveRequestInput) {
  return api<{ leave: LeaveRequest }>(withOrg("/teamforce/leave-requests"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listMyLeaveRequests() {
  return api<{ leaves: LeaveRequest[] }>(
    withOrg("/teamforce/leave-requests/mine")
  );
}

export async function listOrgLeaveRequests(status?: LeaveStatus) {
  const base = "/teamforce/leave-requests";
  const path = status
    ? `${base}?status=${encodeURIComponent(status)}`
    : base;
  return api<{ leaves: LeaveRequest[] }>(withOrg(path));
}

export async function approveLeaveRequest(id: string, note?: string) {
  return api<{ leave: LeaveRequest }>(
    withOrg(`/teamforce/leave-requests/${id}/approve`),
    { method: "POST", body: JSON.stringify({ note }) }
  );
}

export async function rejectLeaveRequest(id: string, note?: string) {
  return api<{ leave: LeaveRequest }>(
    withOrg(`/teamforce/leave-requests/${id}/reject`),
    { method: "POST", body: JSON.stringify({ note }) }
  );
}

export async function cancelLeaveRequest(id: string) {
  return api<{ leave: LeaveRequest }>(
    withOrg(`/teamforce/leave-requests/${id}/cancel`),
    { method: "POST" }
  );
}

// Manager team leave requests
export async function listTeamLeaveRequests(status?: LeaveStatus) {
  const base = "/teamforce/leave-requests/team";
  const path = status
    ? `${base}?status=${encodeURIComponent(status)}`
    : base;
  return api<{ leaves: LeaveRequest[] }>(withOrg(path));
}

// Salary Structures
export async function listSalaryStructures() {
  return api<{ structures: SalaryStructure[] }>(
    withOrg("/teamforce/salary-structures")
  );
}

export async function createSalaryStructure(
  data: Partial<Omit<SalaryStructure, "_id" | "orgId" | "isActive">>
) {
  return api<{ structure: SalaryStructure }>(
    withOrg("/teamforce/salary-structures"),
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function updateSalaryStructure(
  id: string,
  data: Partial<Omit<SalaryStructure, "_id" | "orgId" | "isActive">>
) {
  return api<{ structure: SalaryStructure }>(
    withOrg(`/teamforce/salary-structures/${id}`),
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteSalaryStructure(id: string) {
  return api<{ ok: boolean }>(
    withOrg(`/teamforce/salary-structures/${id}`),
    { method: "DELETE" }
  );
}

export async function getSalaryStructureDefaults() {
  return api<SalaryStructureDefaults>(
    "/teamforce/salary-structures/defaults"
  );
}

// Payroll Config (per org)
export async function getPayrollConfig() {
  return api<{ config: PayrollConfig }>(withOrg("/teamforce/payroll-config"));
}

export async function updatePayrollConfig(
  data: Partial<Pick<PayrollConfig, "attendanceCutoffDay" | "defaultState" | "fyStartMonth">>
) {
  return api<{ config: PayrollConfig }>(
    withOrg("/teamforce/payroll-config"),
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function unlockPayrollConfig() {
  return api<{ config: PayrollConfig }>(
    withOrg("/teamforce/payroll-config/unlock"),
    { method: "POST" }
  );
}

// Professional Tax Slabs (global)
export async function listPTSlabs(state?: string) {
  const path = state
    ? `/teamforce/pt-slabs?state=${encodeURIComponent(state)}`
    : "/teamforce/pt-slabs";
  return api<{ slabs: PTSlab[]; states: string[] }>(path);
}

export async function createPTSlab(
  data: Omit<PTSlab, "_id" | "isActive" | "effectiveDate"> & {
    effectiveDate?: string;
  }
) {
  return api<{ slab: PTSlab }>("/teamforce/pt-slabs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePTSlab(
  id: string,
  data: Partial<Omit<PTSlab, "_id" | "isActive">>
) {
  return api<{ slab: PTSlab }>(`/teamforce/pt-slabs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePTSlab(id: string) {
  return api<{ ok: boolean }>(`/teamforce/pt-slabs/${id}`, {
    method: "DELETE",
  });
}

export async function seedPTSlabs() {
  return api<{ ok: boolean; inserted: number }>(
    "/teamforce/pt-slabs/seed",
    { method: "POST" }
  );
}

// Employee Tax Declaration (per FY)
export async function getTaxDeclaration(fy: string, userId?: string) {
  const orgQS = withOrg("/teamforce/tax-declaration").includes("?")
    ? "&"
    : "?";
  const userQS = userId ? `&userId=${encodeURIComponent(userId)}` : "";
  return api<{ declaration: EmployeeTaxDeclaration | null }>(
    `${withOrg("/teamforce/tax-declaration")}${orgQS}fy=${encodeURIComponent(fy)}${userQS}`
  );
}

export async function upsertTaxDeclaration(
  data: Partial<Omit<EmployeeTaxDeclaration, "_id" | "userId" | "orgId" | "locked" | "lockedAt">> & { fy: string },
  userId?: string
) {
  const path = userId
    ? `${withOrg("/teamforce/tax-declaration")}&userId=${encodeURIComponent(userId)}`
    : withOrg("/teamforce/tax-declaration");
  return api<{ declaration: EmployeeTaxDeclaration }>(path, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function lockTaxDeclaration(fy: string, userId?: string) {
  const path = userId
    ? `${withOrg("/teamforce/tax-declaration/lock")}&userId=${encodeURIComponent(userId)}`
    : withOrg("/teamforce/tax-declaration/lock");
  return api<{ declaration: EmployeeTaxDeclaration }>(path, {
    method: "POST",
    body: JSON.stringify({ fy }),
  });
}

/** Founder-only master unlock. When `userId` is omitted, the backend
 *  unlocks the caller's own declaration. */
export async function unlockTaxDeclaration(fy: string, userId?: string) {
  const body: Record<string, string> = { fy };
  if (userId) body.userId = userId;
  return api<{ declaration: EmployeeTaxDeclaration }>(
    withOrg("/teamforce/tax-declaration/unlock"),
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function getRegimePreview(fy: string, userId?: string) {
  const orgQS = withOrg("/teamforce/tax-declaration/regime-preview").includes("?")
    ? "&"
    : "?";
  const userQS = userId ? `&userId=${encodeURIComponent(userId)}` : "";
  return api<RegimePreview>(
    `${withOrg("/teamforce/tax-declaration/regime-preview")}${orgQS}fy=${encodeURIComponent(fy)}${userQS}`
  );
}

export async function getOrgTaxSummary(fy: string) {
  const base = withOrg("/teamforce/tax-declaration/org-summary");
  const sep = base.includes("?") ? "&" : "?";
  return api<{ summary: OrgTaxSummaryEntry[] }>(
    `${base}${sep}fy=${encodeURIComponent(fy)}`
  );
}

// Payroll Runs
export async function listPayrollRuns(fyYear?: number) {
  const qs = fyYear ? `&fyYear=${fyYear}` : "";
  return api<{ runs: PayrollRun[] }>(
    `${withOrg("/teamforce/payroll-runs")}${qs}`
  );
}

export async function listMyPayrollSlips(fyYear?: number) {
  const qs = fyYear ? `&fyYear=${fyYear}` : "";
  return api<{ slips: Array<{ run: PayrollRun; transaction: PayrollTransaction }> }>(
    `${withOrg("/teamforce/payroll-runs/me/transactions")}${qs}`
  );
}

export async function getMyForm16(fyYear: number) {
  return api<Form16Response>(
    `${withOrg("/teamforce/payroll-runs/me/form16")}&fyYear=${fyYear}`
  );
}

export async function getPayrollRun(id: string) {
  return api<{ run: PayrollRun; transactions: PayrollTransaction[] }>(
    withOrg(`/teamforce/payroll-runs/${id}`)
  );
}

export async function createPayrollRun(params: {
  fyMonth: number;
  fyYear: number;
  runType?: "FULL" | "PARTIAL";
  scope?: Partial<PartialPayrollScope>;
}) {
  return api<PayrollRunCreateResult>(withOrg("/teamforce/payroll-runs"), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getMonthSummary(fyYear: number, fyMonth: number) {
  return api<MonthSummaryResponse>(
    `${withOrg("/teamforce/payroll-runs/month-summary")}&fyYear=${fyYear}&fyMonth=${fyMonth}`
  );
}

export async function approvePayrollRun(id: string) {
  return api<{ run: PayrollRun }>(
    withOrg(`/teamforce/payroll-runs/${id}/approve`),
    { method: "POST" }
  );
}

export async function markPaidPayrollRun(id: string) {
  return api<{ run: PayrollRun }>(
    withOrg(`/teamforce/payroll-runs/${id}/mark-paid`),
    { method: "POST" }
  );
}

export async function deletePayrollRun(id: string) {
  return api<{ ok: boolean }>(withOrg(`/teamforce/payroll-runs/${id}`), {
    method: "DELETE",
  });
}

export async function overridePayrollTransaction(
  runId: string,
  txId: string,
  patch: Partial<{
    monthlyTDS: number;
    professionalTax: number;
    pfEmployee: number;
    esiEmployee: number;
    joiningPartialPay: number;
    netPay: number;
    overrideNotes: string;
  }>
) {
  return api<{ transaction: PayrollTransaction }>(
    withOrg(`/teamforce/payroll-runs/${runId}/transactions/${txId}`),
    { method: "PATCH", body: JSON.stringify(patch) }
  );
}

export async function emailPayrollSlip(runId: string, txId: string) {
  return api<{ ok: boolean; sentTo: string }>(
    withOrg(`/teamforce/payroll-runs/${runId}/transactions/${txId}/email`),
    { method: "POST" }
  );
}

export async function emailAllPayrollSlips(runId: string) {
  return api<{
    ok: boolean;
    sent: number;
    total: number;
    failures: Array<{ txId: string; reason: string }>;
  }>(withOrg(`/teamforce/payroll-runs/${runId}/email-all`), { method: "POST" });
}

// Recruitment Requests
export async function listRecruitmentRequests(params?: {
  page?: number;
  pageSize?: number;
  status?: RecruitmentStatus;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.status) qs.set("status", params.status);
  const path = qs.toString()
    ? `/teamforce/recruitment-requests?${qs.toString()}`
    : "/teamforce/recruitment-requests";
  return api<{
    requests: RecruitmentRequest[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>(withOrg(path));
}

export async function getRecruitmentRequest(id: string) {
  return api<{ request: RecruitmentRequest }>(
    withOrg(`/teamforce/recruitment-requests/${id}`)
  );
}

export async function createRecruitmentRequest(
  payload: RecruitmentRequestPayload
) {
  return api<{ request: RecruitmentRequest }>(
    withOrg("/teamforce/recruitment-requests"),
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function updateRecruitmentRequest(
  id: string,
  payload: Partial<RecruitmentRequestPayload> & { status?: RecruitmentStatus }
) {
  return api<{ request: RecruitmentRequest }>(
    withOrg(`/teamforce/recruitment-requests/${id}`),
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export async function deleteRecruitmentRequest(id: string) {
  return api<{ ok: boolean }>(
    withOrg(`/teamforce/recruitment-requests/${id}`),
    { method: "DELETE" }
  );
}

export async function getRecruitmentAccess() {
  return api<{ canAccess: boolean }>(
    withOrg("/teamforce/recruitment-requests/meta/access")
  );
}

// Application Form Builder — custom fields (draft + published)
export type FormBuilderResponse = {
  customFieldsDraft: CustomFieldDef[];
  customFieldsPublished: CustomFieldDef[];
};

export async function getRecruitmentForm(id: string) {
  return api<FormBuilderResponse>(
    withOrg(`/teamforce/recruitment-requests/${id}/form`)
  );
}

export async function saveRecruitmentFormDraft(
  id: string,
  customFields: CustomFieldDef[]
) {
  return api<FormBuilderResponse>(
    withOrg(`/teamforce/recruitment-requests/${id}/form/draft`),
    { method: "PUT", body: JSON.stringify({ customFields }) }
  );
}

export async function publishRecruitmentForm(id: string) {
  return api<FormBuilderResponse>(
    withOrg(`/teamforce/recruitment-requests/${id}/form/publish`),
    { method: "POST" }
  );
}

// Candidate Pipeline
export interface CustomFieldSubmission {
  id: string;
  type: "text" | "number" | "upload";
  value: string;
  file?: File | null;
}

export async function submitCandidateApplication(
  requestId: string,
  payload: CandidateApplyPayload,
  resume: File,
  customFields?: CustomFieldSubmission[]
) {
  const fd = new FormData();
  fd.append("resume", resume);
  fd.append("fullName", payload.fullName);
  fd.append("mobileNumber", payload.mobileNumber);
  fd.append("email", payload.email);
  fd.append("yearsOfExperience", String(payload.yearsOfExperience));
  fd.append("experienceDetails", payload.experienceDetails);
  fd.append("currentCtc", payload.currentCtc);
  fd.append("expectedCtc", payload.expectedCtc);
  fd.append("noticePeriod", payload.noticePeriod);
  if (customFields) {
    for (const cf of customFields) {
      const key = `customField_${cf.id}`;
      if (cf.type === "upload") {
        if (cf.file) fd.append(key, cf.file);
      } else {
        fd.append(key, cf.value);
      }
    }
  }
  return api<{ candidate: Candidate }>(
    withOrg(`/teamforce/candidates/${requestId}/apply`),
    { method: "POST", body: fd }
  );
}

export async function listCandidates(params?: {
  page?: number;
  pageSize?: number;
  requestId?: string;
  stage?: CandidateStage;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.requestId) qs.set("requestId", params.requestId);
  if (params?.stage) qs.set("stage", params.stage);
  const path = qs.toString()
    ? `/teamforce/candidates?${qs.toString()}`
    : "/teamforce/candidates";
  return api<{
    candidates: Candidate[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(withOrg(path));
}

export async function getCandidateResumeUrl(id: string) {
  return api<{ url: string; fileName: string; contentType: string; size: number }>(
    withOrg(`/teamforce/candidates/${id}/resume`)
  );
}

export async function getCandidateCustomFileUrl(id: string, fieldId: string) {
  return api<{ url: string; fileName: string; contentType: string; size: number }>(
    withOrg(`/teamforce/candidates/${id}/custom-file/${fieldId}`)
  );
}

export async function updateCandidateStage(
  id: string,
  patch: { stage?: CandidateStage; notes?: string }
) {
  return api<{ candidate: Candidate }>(
    withOrg(`/teamforce/candidates/${id}`),
    { method: "PATCH", body: JSON.stringify(patch) }
  );
}

// Send org invites — reuses the same /invites/create endpoint used by InviteMemberDialog.
// Sends an OTP email to each address so the invitee can accept and join the org.
export async function sendOrgInvites(
  invitees: Array<{ email: string; name?: string }>
) {
  return api<{ ok: boolean; count: number }>(
    withOrg("/invites/create"),
    {
      method: "POST",
      body: JSON.stringify({
        members: invitees.map(({ email, name }) => ({
          email,
          role: "stakeholder" as const,
          ...(name ? { name } : {}),
        })),
      }),
    }
  );
}

// File upload (reuses existing /upload endpoint — no orgId needed)
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api<{
    url: string;
    key: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }>("/upload", { method: "POST", body: formData });
}
