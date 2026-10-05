// Shapes returned by the Garage Jobs API (garagenew-backend: routes/jobsFounder.ts
// and routes/jobsCandidate.ts). Keep in step with the backend models.

export type JobStatus = "draft" | "scheduled" | "live" | "paused" | "closed" | "filled" | "expired";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship";
export type WorkplaceType = "hybrid" | "remote" | "onsite";
export type StageCategory = "applied" | "screening" | "assessment" | "interview" | "offer" | "hired";
export type TeamRole = "hiring_manager" | "recruiter" | "interviewer";
export type ApplicationStatus = "active" | "rejected" | "withdrawn" | "hired";
export type ApplicationSource =
  | "garage_hq"
  | "university"
  | "public_link"
  | "careers_page"
  | "referral"
  | "talent_pool";

export type JobFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "url"
  | "single_choice"
  | "checkboxes"
  | "dropdown"
  | "yes_no"
  | "rating"
  | "ranking"
  | "resume"
  | "file_upload"
  | "portfolio_link"
  | "video_answer"
  | "quiz_mcq"
  | "profile_full_name"
  | "profile_email"
  | "profile_phone"
  | "profile_location"
  | "profile_company"
  | "profile_experience"
  | "profile_current_ctc"
  | "profile_expected_ctc"
  | "profile_notice_period"
  | "profile_linkedin"
  | "section_heading"
  | "info_text"
  | "declaration";

export type ConditionOperator = "equals" | "not_equals" | "greater_than" | "less_than" | "contains";

export interface FieldOption {
  id: string;
  label: string;
}

export interface Knockout {
  enabled: boolean;
  answer: string;
  moveToRejected: boolean;
  addReason: boolean;
  reason?: string;
  notifyTeam: boolean;
  emailTemplateId?: string;
  delayEmail: boolean;
}

export interface FieldCondition {
  fieldId: string;
  operator: ConditionOperator;
  value: string;
  hideUntilMet: boolean;
  clearIfHidden: boolean;
}

export interface FormField {
  id: string;
  type: JobFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  locked: boolean;
  options: FieldOption[];
  fileTypes: string[];
  maxSizeMb?: number;
  multiple: boolean;
  parseResume: boolean;
  scaleMax?: number;
  maxLength?: number;
  correctOptionId?: string;
  points?: number;
  talentPoolConsent: boolean;
  knockout?: Knockout | null;
  condition?: FieldCondition | null;
}

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  timeLimitMinutes?: number | null;
  passMark?: number | null;
  fields: FormField[];
}

export interface AutoAction {
  id: string;
  trigger: "on_enter" | "quiz_score_gte" | "idle_days";
  value?: number;
  action: "send_email" | "move_to_stage" | "remind_owner";
  targetStageId?: string;
  emailTemplateId?: string;
}

export interface Stage {
  id: string;
  name: string;
  category: StageCategory;
  ownerId?: string | null;
  autoActions: AutoAction[];
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
}

export interface JobReward {
  enabled: boolean;
  amount: number;
  guaranteeDays: 30 | 60 | 90;
  funding: "hold" | "on_hire";
  heldAmount: number;
  totalHeld: number;
  payerId?: string;
}

export interface Job {
  _id: string;
  orgId: string;
  createdBy: string;
  status: JobStatus;
  slug: string;
  title: string;
  department?: string;
  openings: number;
  employmentType: EmploymentType;
  workplace: WorkplaceType;
  officeDays?: number | null;
  locations: string[];
  experienceMin?: number | null;
  experienceMax?: number | null;
  joining?: string;
  salary: {
    show: boolean;
    currency: string;
    min?: number | null;
    max?: number | null;
    period: "year" | "month" | "hour";
  };
  description: {
    aboutRole: string;
    responsibilities: string;
    requirements: string;
    niceToHave: string;
    offer: string;
  };
  skills: string[];
  education: { required: boolean; qualification?: string };
  perks: string[];
  form: { pages: FormPage[] };
  stages: Stage[];
  team: TeamMember[];
  candidateEmails: {
    applicationReceived: boolean;
    movedToInterview: boolean;
    rejection: boolean;
    rejectionDelayHours: number;
    offer: boolean;
  };
  reward: JobReward;
  channels: { garageHq: boolean; university: boolean; publicLink: boolean };
  publishMode: "now" | "scheduled";
  publishAt?: string | null;
  closesAt?: string | null;
  autoCloseOnHires: boolean;
  completedStep: number;
  stats: { views: number; applyStarts: number };
  publishedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  affiliateId?: string;
}

export interface OrgInfo {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  city?: string;
  country?: string;
  description?: string;
}

export interface RewardSplitPreview {
  total: number;
  buckets: Array<{ key: string; label: string; percentage: number; amount: number }>;
  returnedPercentage: number;
  directAmount: number;
}

export interface JobStats {
  total: number;
  fresh: number;
  hired: number;
  rejected: number;
  byCategory: Record<StageCategory, number>;
}

export interface JobDetailResponse {
  success: boolean;
  job: Job;
  org: OrgInfo;
  publicUrl: string;
  people: Record<string, Person>;
  stats: JobStats;
  problems: string[];
  rewardPreview: RewardSplitPreview | null;
  holdRequired: number;
}

export interface PostingRow {
  _id: string;
  title: string;
  slug: string;
  publicUrl?: string;
  department: string;
  status: JobStatus;
  createdBy: Person;
  applicants: number;
  newApplicants: number;
  hired: number;
  stageCounts: Record<StageCategory, number>;
  reward: { enabled: boolean; amount: number; funding?: string; heldAmount: number; guaranteeDays?: number };
  channels: Job["channels"];
  locations: string[];
  workplace: WorkplaceType;
  employmentType: EmploymentType;
  openings: number;
  closesAt?: string | null;
  publishAt?: string | null;
  publishedAt?: string;
  completedStep: number;
  updatedAt: string;
  createdAt: string;
}

export interface OverviewResponse {
  success: boolean;
  metrics: {
    liveJobs: number;
    acceptingJobs: number;
    applicants30d: number;
    applicantsPrev30d: number;
    inInterview: number;
    interviewJobs: number;
    hiredQuarter: number;
    hiredQuarterReferral: number;
    rewardsHeld: number;
  };
  funnel: Array<{ category: StageCategory; count: number }>;
  sources: Array<{ source: ApplicationSource; count: number }>;
  attention: Array<{
    kind: "new_applications" | "overdue_scorecards" | "closing_soon" | "guarantee_starts";
    count?: number;
    jobId?: string;
    title?: string;
    closesAt?: string;
    rewardId?: string;
    name?: string;
    joinedAt?: string;
  }>;
  liveJobs: PostingRow[];
  jobs: Array<{ _id: string; title: string }>;
}

export interface PostingsResponse {
  success: boolean;
  org: OrgInfo;
  postings: PostingRow[];
  total: number;
  page: number;
  pages: number;
  applicantsTotal: number;
  counts: { all: number; live: number; draft: number; paused: number; closed: number };
  filters: { departments: string[]; locations: string[]; posters: Person[] };
}

export interface PipelineCard {
  _id: string;
  candidateId: string;
  name: string;
  avatar?: string;
  matchScore: number;
  source: ApplicationSource;
  stageId: string;
  status: ApplicationStatus;
  tags: string[];
  skills: string[];
  context: string;
  isNew: boolean;
  appliedAt?: string;
}

export interface PipelineResponse {
  success: boolean;
  columns: Array<{ stage: Stage; applications: PipelineCard[] }>;
  outcomes: { rejected: number; withdrawn: number };
  tags: string[];
  total: number;
}

export interface ApplicationRow {
  _id: string;
  reference: string;
  candidate: { _id: string; name: string; email?: string; avatar?: string };
  job: { _id: string; title: string };
  stage: { id: string; name: string; category: StageCategory };
  status: ApplicationStatus;
  matchScore: number;
  source: ApplicationSource;
  referral: { affiliateId: string; name: string } | null;
  appliedAt?: string;
  lastActivity: string;
  lastActivityAt?: string;
  starred: boolean;
  tags: string[];
  isNew: boolean;
}

export interface ApplicationsResponse {
  success: boolean;
  applications: ApplicationRow[];
  total: number;
  page: number;
  pages: number;
  counts: { active: number; new: number; needsReview: number; referred: number; starred: number };
  jobs: Array<{ _id: string; title: string }>;
  /** Every tag used on the office's applications. */
  tags?: string[];
}

export interface AnswerFile {
  url: string;
  name: string;
  size?: number;
  type?: string;
}

export interface Answer {
  fieldId: string;
  value?: string | number | boolean | string[] | null;
  files: AnswerFile[];
}

export interface Application {
  _id: string;
  jobId: string;
  orgId: string;
  candidateId: string;
  reference: string;
  isDraft: boolean;
  stageId: string;
  stageCategory: StageCategory;
  maxStageRank: number;
  status: ApplicationStatus;
  answers: Answer[];
  profile: {
    fullName?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    company?: string;
    experienceYears?: number;
    currentCtc?: string;
    expectedCtc?: string;
    noticePeriod?: string;
    linkedin?: string;
  };
  resume?: AnswerFile;
  source: ApplicationSource;
  referral?: { referrerId: string; affiliateId: string };
  matchScore: number;
  matchedSkills: string[];
  quiz?: { score: number; total: number; passed: boolean };
  knockout?: { triggered: boolean; fieldId?: string; reason?: string };
  rejection?: { reason?: string; note?: string; at: string; emailDueAt?: string; emailSentAt?: string };
  tags: string[];
  starred: boolean;
  reviewedAt?: string;
  talentPoolConsent: boolean;
  consentUntil?: string;
  joiningDate?: string;
  hiredAt?: string;
  appliedAt?: string;
  lastActivityAt?: string;
  lastActivity?: string;
}

export interface Scorecard {
  interviewerId: string;
  ratings: Array<{ criterion: string; score: number; note?: string }>;
  recommendation?: "strong_no" | "no" | "yes" | "strong_yes";
  privateNote?: string;
  submittedAt?: string;
  interviewer?: Person;
}

export interface Interview {
  _id: string;
  applicationId: string;
  jobId: string;
  stageId: string;
  roundLabel: string;
  interviewerIds: string[];
  interviewers?: Person[];
  mode: "video" | "in_person" | "phone";
  durationMin: number;
  timezone?: string;
  slots: string[];
  candidatePicks: boolean;
  scheduledAt?: string;
  meetingUrl?: string;
  location?: string;
  message?: string;
  status: "awaiting_candidate" | "scheduled" | "completed" | "cancelled";
  scorecards: Scorecard[];
  createdAt: string;
}

export interface Offer {
  _id: string;
  applicationId: string;
  role: string;
  ctc: number;
  currency: string;
  joiningDate?: string;
  expiresAt?: string;
  letter?: { url: string; name: string; size?: number };
  message?: string;
  status: "sent" | "accepted" | "declined" | "withdrawn" | "expired";
  respondedAt?: string;
  declineReason?: string;
  createdAt: string;
}

export type RewardStatus =
  | "in_guarantee"
  | "processing"
  | "paid"
  | "payment_due"
  | "cancelled"
  | "refund_due"
  | "failed";

export interface Reward {
  _id: string;
  applicationId: string;
  jobId: string;
  amount: number;
  funding: "hold" | "on_hire";
  status: RewardStatus;
  joinedAt: string;
  guaranteeDays: number;
  guaranteeEndsAt: string;
  paidAt?: string;
  paidAmount?: number;
  returnedAmount?: number;
  lastError?: string;
}

export interface ActivityItem {
  _id: string;
  type: string;
  text: string;
  createdAt: string;
  actor?: Person | null;
  data?: Record<string, unknown>;
}

export interface CandidateProfileResponse {
  success: boolean;
  application: Application;
  candidate: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
    title?: string;
    company?: string;
    location?: string;
  };
  referral: { affiliateId: string; name: string; userId: string } | null;
  job: {
    _id: string;
    title: string;
    stages: Stage[];
    form: { pages: FormPage[] };
    reward: { enabled: boolean; amount: number; guaranteeDays: number };
    skills: string[];
    team: TeamMember[];
  } | null;
  interviews: Interview[];
  offers: Offer[];
  reward: Reward | null;
  activity: ActivityItem[];
  notes: ActivityItem[];
}

export interface PayoutRow {
  _id: string;
  hire: { name: string; applicationId: string };
  job: { _id: string; title: string };
  referrer: { name: string; affiliateId?: string };
  amount: number;
  funding: "hold" | "on_hire";
  joinedAt: string;
  guaranteeEndsAt: string;
  status: RewardStatus;
  progress: number;
  paidAt?: string;
  paidAmount?: number;
  returnedAmount?: number;
  lastError?: string;
}

export interface PayoutsResponse {
  success: boolean;
  metrics: {
    held: { amount: number; jobs: number };
    inGuarantee: { amount: number; count: number };
    paid: { amount: number; count: number };
    refunded: { amount: number; count: number };
  };
  rewards: PayoutRow[];
  holds: Array<{ jobId: string; title: string; status: JobStatus; openings: number; rewardAmount: number; heldAmount: number }>;
}

export interface PayoutDetailResponse {
  success: boolean;
  reward: Reward & {
    hire: { name: string };
    job: { title: string };
    referrer: Person | null;
    cancelReason?: string;
  };
  split: {
    saleAmount: number;
    direct: { userId: string; amount: number } | null;
    directRecipient: Person | null;
    level: { recipients: number; amount: number };
    infinity1: { recipients: number; amount: number };
    infinity2: { recipients: number; amount: number };
    status: string;
  } | null;
  preview: RewardSplitPreview | null;
}

export interface TalentCandidate {
  candidateId: string;
  applicationId: string;
  name: string;
  email?: string;
  avatar?: string;
  title?: string;
  location?: string;
  experienceYears?: number;
  topSkills: string[];
  lastJob: { _id: string; title: string };
  lastStage: string;
  status: ApplicationStatus;
  tags: string[];
  consentUntil?: string;
  appliedAt?: string;
  applications: number;
}

export interface TalentPoolResponse {
  success: boolean;
  candidates: TalentCandidate[];
  total: number;
  tags: string[];
  liveJobs: Array<{ _id: string; title: string }>;
}

export interface AnalyticsResponse {
  success: boolean;
  totals: {
    views: number;
    applyStarts: number;
    applications: number;
    applyRate: number | null;
    timeToHireDays: number | null;
    costPerHire: number | null;
    hires: number;
  };
  series: Array<{ date: string; views: number; applications: number }>;
  dropoff: {
    pages: Array<{ pageId: string; title: string; count: number }>;
    worst: { title: string; dropPercent: number } | null;
  };
  sources: Array<{ source: ApplicationSource; applicants: number; hires: number; rewarded: number }>;
  topReferrers: Array<{ userId: string; name: string; avatar?: string; applicants: number; hires: number }>;
}

export type EmailTemplateKind =
  | "application_received"
  | "moved_to_interview"
  | "interview_invite"
  | "rejection"
  | "offer"
  | "custom";

export interface EmailTemplate {
  id: string;
  name: string;
  kind: EmailTemplateKind;
  subject: string;
  body: string;
}

export interface JobsSettings {
  careersPage: {
    coverImage?: string;
    headline?: string;
    about?: string;
    culturePhotos: string[];
    perks: string[];
    showRewards: boolean;
  };
  emailTemplates: EmailTemplate[];
  rejectionReasons: Array<{ id: string; label: string }>;
  savedForms: Array<{ id: string; name: string; pages: FormPage[]; createdAt: string }>;
  defaultPipeline: { stages: Array<{ name: string; category: StageCategory; ownerId?: string | null }> };
  privacy: { retentionMonths: number; allowDeletionRequests: boolean; consentAddition: string };
}

export interface SettingsResponse {
  success: boolean;
  settings: JobsSettings;
  org: OrgInfo;
  careersUrl: string;
  consentMinimum: string;
}

export interface InterviewDetailResponse {
  success: boolean;
  interview: Interview;
  myScorecard: Scorecard | null;
  othersHidden: boolean;
  application: {
    _id: string;
    profile: Application["profile"];
    matchScore: number;
    quiz?: Application["quiz"];
    matchedSkills: string[];
    referral: { affiliateId: string; name?: string } | null;
  } | null;
  job: { _id: string; title: string; skills: string[] } | null;
  previousRounds: Array<{ _id: string; roundLabel: string; status: string; average: number | null; recommendation?: string }>;
}

export interface OfficeMember {
  _id: string;
  name: string;
  email: string;
  role?: string;
  profilePicture?: string;
  guest?: boolean;
}
