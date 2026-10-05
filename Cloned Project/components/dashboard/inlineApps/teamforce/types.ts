export type Section =
  | "dashboard"
  | "employees"
  | "add-employee"
  | "add-employee-form"
  | "invite-employee"
  | "bulk-assign"
  | "update-info"
  | "edit-employee"
  | "departments"
  | "branches"
  | "attendance"
  | "payroll"
  | "tax-declaration"
  | "my-salary-slips"
  | "recruitment"
  | "settings";

export type RecruitmentStatus =
  | "draft"
  | "approval_pending"
  | "approved"
  | "floated"
  | "closed";

export type EmploymentType = "Full-Time" | "Part-Time" | "Contract" | "Intern";
export type ExperienceRange = "0-2" | "2-5" | "5-8" | "8+";

export type CustomFieldType = "text" | "number" | "upload";

export interface CustomFieldDef {
  id: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
}

export interface CustomFieldValue {
  fieldId: string;
  label: string;
  type: CustomFieldType;
  value: string;
  fileKey?: string;
  fileName?: string;
  fileContentType?: string;
  fileSize?: number;
}

export interface RecruitmentRequest {
  _id: string;
  orgId: string;
  positionName: string;
  department: string;
  branch: string;
  reportingManager: string;
  employmentType: EmploymentType;
  numberOfOpenings: number;
  experienceRequired: ExperienceRange;
  jobLocation: string;
  expectedJoiningDate: string;
  roleSummary?: string;
  keyResponsibilities?: string;
  requiredSkills?: string;
  preferredSkills?: string;
  approver?: string;
  approvers?: string[];
  status: RecruitmentStatus;
  customFieldsDraft?: CustomFieldDef[];
  customFieldsPublished?: CustomFieldDef[];
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CandidateStage =
  | "applied"
  | "reviewing"
  | "shortlisted"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export interface Candidate {
  _id: string;
  orgId: string;
  recruitmentRequestId: string;
  positionName: string;
  department?: string;
  jobLocation?: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  yearsOfExperience: number;
  experienceDetails?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  resumeKey: string;
  resumeFileName: string;
  resumeContentType?: string;
  resumeSize?: number;
  stage: CandidateStage;
  notes?: string;
  customFieldValues?: CustomFieldValue[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateApplyPayload {
  fullName: string;
  mobileNumber: string;
  email: string;
  yearsOfExperience: number;
  experienceDetails: string;
  currentCtc: string;
  expectedCtc: string;
  noticePeriod: string;
}

export interface RecruitmentRequestPayload {
  positionName: string;
  department: string;
  branch: string;
  reportingManager: string;
  employmentType: EmploymentType;
  numberOfOpenings: number;
  experienceRequired: ExperienceRange;
  jobLocation: string;
  expectedJoiningDate: string;
  roleSummary?: string;
  keyResponsibilities?: string;
  requiredSkills?: string;
  preferredSkills?: string;
  approver?: string;
  approvers?: string[];
  action?: "draft" | "submit";
}

export interface EducationEntry {
  degreeName?: string;
  yearOfPassing?: string;
  certificateUrl?: string;
}

export interface WorkExperienceEntry {
  companyName?: string;
  yearsOfExperience?: string;
  designation?: string;
  referenceName?: string;
  referenceContact?: string;
}

export interface CustomAmount {
  name: string;
  amount: number;
}

export interface EmployeeProfile {
  _id?: string;
  userId: string;
  orgId: string;
  teamforceRole: "admin" | "member";
  mobileNumber?: string;
  pan?: string;
  dateOfBirth?: string;
  exitedAt?: string | null;
  exitReason?: string;
  permanentAddress?: string;
  currentAddress?: string;
  sameAsPermanent?: boolean;
  dateOfJoining?: string;
  placeOfJoining?: string;
  branchId?: string | { _id: string; name: string };
  departmentId?: string | { _id: string; name: string };
  designation?: string;
  employmentType?: string;
  state?: string;
  cityType?: "METRO" | "NON_METRO";
  reportingManagerId?: string | { _id: string; name: string; email: string };
  secondaryReviewerId?: string | { _id: string; name: string; email: string };
  managesTeam?: boolean;
  education?: EducationEntry[];
  workExperience?: WorkExperienceEntry[];
  salaryStructureId?: string | { _id: string; name: string };
  monthlyCtc?: number;
  basicSalary?: number;
  hra?: number;
  transportAllowance?: number;
  providentFund?: number;
  professionalTax?: number;
  variablePay?: number;
  customAllowances?: CustomAmount[];
  customDeductions?: CustomAmount[];
  pfOption?: "CEILING" | "ACTUAL";
  esiApplicable?: boolean;
  tdsRegime?: "new" | "old";
  estimatedAnnualTds?: number;
  autoCalculateTds?: boolean;
  shiftId?: string;
  weeklyOffPatternId?: string;
  offerLetterUrl?: string;
  idProofUrl?: string;
  educationCertificatesUrl?: string;
  experienceLettersUrl?: string;
  bankAccountHolderName?: string;
  bankAccountType?: "savings" | "current";
  bankAccountNumber?: string;
  bankIfscCode?: string;
}

export type EmployeeStatus = "invited" | "onboarded" | "active" | "inactive";

export interface EmployeeListItem {
  userId: string;
  name: string;
  email: string;
  profilePicture: string | null;
  role: "founder" | "stakeholder";
  joinedAt: string;
  hasProfile: boolean;
  teamforceRole: "admin" | "member";
  profile: EmployeeProfile | null;
  status: EmployeeStatus;
  /** True for synthesized rows representing an invite that hasn't been
   *  accepted yet — there's no real User/profile behind these. */
  isPending: boolean;
}

export interface Branch {
  _id: string;
  orgId: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  isActive: boolean;
}

export interface Department {
  _id: string;
  orgId: string;
  name: string;
  description?: string;
  headId?: { _id: string; name: string; email: string };
  isActive: boolean;
}

export interface Shift {
  _id: string;
  orgId: string;
  name: string;
  startTime: string;
  endTime: string;
  workingHours?: number;
  graceMinutes?: number;
  breakMinutes: number;
  isActive: boolean;
}

export interface WeeklyOffPattern {
  _id: string;
  orgId: string;
  name: string;
  patternType?: "Fixed" | "Rotating";
  offDays: number[];
  isActive: boolean;
}

export type LeavePolicyType = "Paid" | "Unpaid";
export type LeavePolicyApplicableFor =
  | "All Employees"
  | "Full-Time Only"
  | "Contract Only";

export type BreakScopeType = "Universal" | "By Department" | "By Designation";

export interface BreakPayrollImpact {
  deductHalfDay: boolean;
  deductHourly: { enabled: boolean; ofBasic: boolean; ofCtc: boolean };
  fixedAmount: number;
}

export interface BreakPolicy {
  _id?: string;
  orgId?: string;
  name: string;
  activateBreaks: boolean;
  scopeType: BreakScopeType;
  scopeTargets: string[];
  breakMinutesPerDay: number;
  breachAffectsPayroll: boolean;
  maxBreachMinutesAllowed: number;
  maxBreachesAllowed: number;
  payrollImpact: BreakPayrollImpact;
}

export interface BreakStatus {
  activated: boolean;
  inScope: boolean;
  policyId: string | null;
  policyName: string | null;
  breakMinutesPerDay: number;
  budgetSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  overBudgetSeconds: number;
  hasBreached: boolean;
  onBreak: boolean;
  breakStartTime: string | null;
}

export interface LeavePolicy {
  _id: string;
  orgId: string;
  name: string;
  leaveType: LeavePolicyType;
  annualQuota: number;
  maxConsecutiveDays: number;
  applicableFor: LeavePolicyApplicableFor;
  allowCarryForward: boolean;
  allowEncashment: boolean;
  isActive: boolean;
}

export type ComponentCode =
  | "BASIC"
  | "DA"
  | "HRA"
  | "LTA"
  | "SPECIAL"
  | "CHILDREN_EDU"
  | "CHILDREN_HOSTEL"
  | "UNIFORM"
  | "MEDICAL_REIMB"
  | "TELEPHONE_REIMB"
  | "BONUS"
  | "OVERTIME"
  | "LEAVE_ENCASH"
  | "PF_EMPLOYER"
  | "NPS_EMPLOYER"
  | "GRATUITY_PROVISION"
  | "PF_EMPLOYEE"
  | "ESI_EMPLOYEE"
  | "PT"
  | "TDS"
  | "LOAN_EMI"
  | "ADVANCE_RECOVERY"
  | "CUSTOM";

export type TaxabilityType =
  | "FULLY_TAXABLE"
  | "EXEMPT_FORMULA"
  | "EXEMPT_FIXED"
  | "EXEMPT_FULL"
  | "DEDUCTION_STATUTORY"
  | "DEDUCTION_VOLUNTARY"
  | "REIMBURSEMENT";

export type CalcType =
  | "flat"
  | "percentBasic"
  | "percentBasicPlusDA"
  | "percentCTC"
  | "percentGross";

export type TaxRegime = "old" | "new";

export interface SalaryComponent {
  componentCode: ComponentCode;
  componentName: string;
  taxabilityType: TaxabilityType;
  calculationType: CalcType;
  value: number;
}

export interface SalaryStructure {
  _id: string;
  orgId: string;
  name: string;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  taxRegime: TaxRegime;
  autoTds: boolean;
  estimatedAnnualTds: number;
  isActive: boolean;
}

export interface SalaryStructureDefaults {
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
}

export interface PayrollConfig {
  _id?: string;
  orgId: string;
  attendanceCutoffDay: number;
  defaultState: string;
  fyStartMonth: number;
  locked: boolean;
  lockedSince?: string | null;
}

export interface PTSlab {
  _id: string;
  state: string;
  grossFrom: number;
  grossTo: number | null;
  monthlyPT: number;
  monthOverride: number | null;
  effectiveDate: string;
  isActive: boolean;
}

export type Regime = "OLD" | "NEW";

export interface HRADeclaration {
  monthlyRentPaid: number;
  landlordName: string;
  landlordPan: string;
  ownsHouseInCity: boolean;
}

export interface PreviousEmployer {
  name: string;
  tan: string;
  grossSalary: number;
  tdsDeducted: number;
  ptPaid: number;
  pfPaid: number;
}

export interface EmployeeTaxDeclaration {
  _id?: string;
  userId: string;
  orgId: string;
  fy: string;
  regime: Regime;
  hraDeclaration: HRADeclaration;
  ltaClaimAmount: number;
  numChildren: number;
  declared80C: number;
  declaredNpsSelf: number;
  declared80DSelf: number;
  declared80DParent: number;
  parentSeniorCitizen: boolean;
  savingsInterest: number;
  fdInterest: number;
  declared80E: number;
  declared80EEA: number;
  declared80G: number;
  previousEmployer: PreviousEmployer;
  locked: boolean;
  lockedAt?: string | null;
}

export interface RegimeBreakdown {
  projectedAnnualGross: number;
  hraExempt: number;
  ltaExempt: number;
  childrenExempt: number;
  totalExemptions: number;
  taxableSalary: number;
  standardDeduction: number;
  taxableAfterStdDed: number;
  chapterVIATotal: number;
  projectedAnnualPT: number;
  netTaxableIncome: number;
  taxBeforeRebate: number;
  rebateApplied: number;
  taxAfterRebate: number;
  marginalReliefNew: number;
  surchargeRate: number;
  surcharge: number;
  surchargeMarginalRelief: number;
  cess: number;
  annualTaxLiability: number;
  monthlyTDS: number;
}

export interface RegimePreview {
  fy: string;
  monthlyGross: number;
  projectedAnnualGross: number;
  old: RegimeBreakdown;
  new: RegimeBreakdown;
  recommended: Regime;
  saving: number;
  currentRegime: Regime;
}

export interface OrgTaxSummaryEntry {
  userId: string;
  name: string;
  email: string;
  filled: boolean;
  regime: Regime | null;
  locked: boolean;
}

// ─── Payroll Runs ─────────────────────────────────────────────

export type PayrollRunStatus = "DRAFT" | "APPROVED" | "PAID";

export interface PayrollRunTotals {
  grossSum: number;
  netSum: number;
  tdsSum: number;
  pfSum: number;
  ptSum: number;
  esiSum: number;
  employeeCount: number;
}

export type PayrollRunType = "FULL" | "PARTIAL";

export interface PartialPayrollScope {
  departmentIds: string[];
  branchIds: string[];
  userIds: string[];
  label: string;
}

export interface PayrollRun {
  _id: string;
  orgId: string;
  fyMonth: number;
  fyYear: number;
  calendarMonth: number;
  calendarYear: number;
  runType?: PayrollRunType;
  scope?: PartialPayrollScope | null;
  includedUserIds?: string[];
  status: PayrollRunStatus;
  windowStart: string;
  windowEnd: string;
  cutoffDayUsed: number;
  totals: PayrollRunTotals;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string | null;
  paidAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthSummaryRemainingEmployee {
  userId: string;
  name: string;
  email?: string;
  departmentId?: string | null;
  branchId?: string | null;
}

export interface MonthSummaryResponse {
  runs: PayrollRun[];
  processedUserIds: string[];
  remainingEmployees: MonthSummaryRemainingEmployee[];
  totalEligible: number;
  totalProcessed: number;
  totalRemaining: number;
}

export interface AttendanceBreakdown {
  windowStart: string;
  windowEnd: string;
  windowCalendarDays: number;
  daysEmployeeInWindow: number;
  daysPresentInWindow: number;
  paidLeaveDaysInWindow: number;
  lopDaysInWindow: number;
  scheduledOffDaysInWindow: number;
  attendanceFactor: number;
  lopDaysApplied: number;
  deferredLopApplied: number;
  isJoiningMonth: boolean;
  inGraceWindow: boolean;
  graceTailDays: number;
  graceTailLopDays: number;
  graceTailFactor: number;
  deferredLopForNextCycle: number;
}

export interface ResolvedComponentRow {
  componentCode: ComponentCode;
  componentName: string;
  taxabilityType: TaxabilityType;
  calculationType: CalcType;
  value: number;
  amount: number;
}

export interface PayrollTransaction {
  _id: string;
  runId: string;
  orgId: string;
  userId: string | { _id: string; name?: string; email?: string };
  salaryStructureId?: string;
  monthlyCtcAnchor: number;
  earnings: ResolvedComponentRow[];
  deductions: ResolvedComponentRow[];
  attendance: AttendanceBreakdown;
  regimeUsed: Regime;
  projectedAnnualGross: number;
  totalExemptions: number;
  standardDeduction: number;
  chapterVIA: { total: number };
  netTaxableIncome: number;
  annualTaxLiability: number;
  monthlyTDS: number;
  overDeducted: boolean;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  grossSalary: number;
  joiningPartialPay: number;
  netPay: number;
  warnings: string[];
  overrideNotes?: string;
  overriddenBy?: string | { _id: string; name?: string; email?: string };
  overriddenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunCreateResult {
  run: PayrollRun;
  processed: number;
  skipped: Array<{ userId: string; reason: string }>;
}

export interface Form16Totals {
  gross: number;
  exemptions: number;
  standardDeduction: number;
  chapterVIA: number;
  tds: number;
  pf: number;
  pt: number;
  esi: number;
  netPay: number;
}

export interface Form16Response {
  fyYear: number;
  fyString: string;
  months: Array<{ run: PayrollRun; transaction: PayrollTransaction }>;
  totals: Form16Totals | null;
}
