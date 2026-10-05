// Shapes returned by the candidate side of the Garage Jobs API
// (garagenew-backend routes/jobsCandidate.ts). Candidates only ever see stage
// categories and their own applications — never an office's hiring internals.

import type {
  Answer,
  ApplicationStatus,
  EmploymentType,
  FormPage,
  JobStatus,
  StageCategory,
  WorkplaceType,
} from "../types";

export interface PublicOrg {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  city?: string;
  country?: string;
}

export interface PublicJob {
  _id: string;
  slug: string;
  title: string;
  department?: string;
  status: JobStatus;
  isOpen: boolean;
  employmentType: EmploymentType;
  workplace: WorkplaceType;
  officeDays?: number | null;
  locations: string[];
  experienceMin?: number | null;
  experienceMax?: number | null;
  joining?: string;
  salary: { currency: string; min?: number | null; max?: number | null; period: "year" | "month" | "hour" } | null;
  skills: string[];
  publishedAt?: string;
  closesAt?: string | null;
  closedAt?: string | null;
  org: PublicOrg | null;
  reward: { amount: number; guaranteeDays: number } | null;
  /** Discover / saved lists only. */
  myApplication?: { isDraft: boolean; status: ApplicationStatus } | null;
  saved?: boolean;
  savedAt?: string;
}

export interface JobDescription {
  aboutRole: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  offer: string;
}

export interface JobDetail extends PublicJob {
  description: JobDescription;
  education?: { required: boolean; qualification?: string };
  perks: string[];
  /** Stage categories the candidate goes through (never "hired"). */
  process: StageCategory[];
  formPages: number;
  estimatedMinutes: number;
  applicants: number;
  aboutCompany?: string;
}

export interface MyApplicationRef {
  _id: string;
  isDraft: boolean;
  status: ApplicationStatus;
  stageCategory?: StageCategory;
  reference?: string;
}

export interface JobViewResponse {
  success: boolean;
  job: JobDetail;
  myApplication: MyApplicationRef | null;
  referral: { earn: number; guaranteeDays: number; link: string; affiliateId: string } | null;
  publicUrl: string | null;
}

export interface DiscoverResponse {
  success: boolean;
  jobs: PublicJob[];
  total: number;
  page: number;
  pages: number;
  departments: string[];
}

export interface ApplyResponse {
  success: boolean;
  job: PublicJob & { form: { pages: FormPage[] } };
  prefill: {
    profile_full_name: string;
    profile_email: string;
    profile_phone: string;
    profile_location: string;
    title: string;
  };
  draft: { _id: string; answers: Answer[]; furthestPage: number } | null;
  consent: { minimum: string; addition: string };
}

export type ApplySource = "garage_hq" | "university" | "public_link" | "careers_page" | "talent_pool";

export interface MyInterview {
  _id: string;
  status: "awaiting_candidate" | "scheduled";
  roundLabel: string;
  scheduledAt?: string;
  durationMin: number;
  mode: "video" | "in_person" | "phone";
  location?: string;
  slots: string[];
  meetingUrl: string | null;
}

export interface MyApplication {
  _id: string;
  reference: string;
  isDraft: boolean;
  draftProgress: { page: number; pages: number } | null;
  status: ApplicationStatus;
  stageCategory: StageCategory;
  process: StageCategory[];
  appliedAt?: string;
  job: { _id: string; title: string; slug: string; status: JobStatus; locations: string[]; workplace: WorkplaceType } | null;
  org: { _id: string; name: string; slug: string; icon?: string } | null;
  /** The first of `interviews` — kept for older callers. */
  interview: MyInterview | null;
  /** Every scheduled / awaiting round, the same set the hiring team sees. Absent from older backends. */
  interviews?: MyInterview[];
  offer: {
    _id: string;
    status: "sent" | "accepted" | "declined" | "expired";
    role: string;
    ctc: number;
    currency: string;
    joiningDate?: string;
    expiresAt?: string;
    letter?: { url: string; name: string; size?: number };
    message?: string;
  } | null;
}

export interface AlertCriteria {
  q?: string;
  location?: string;
  workplace?: WorkplaceType[];
  employmentType?: EmploymentType[];
  experience?: number;
  salaryMin?: number;
  department?: string;
}

export type AlertFrequency = "instant" | "daily" | "weekly";

export interface JobAlert {
  _id: string;
  name: string;
  criteria: AlertCriteria;
  frequency: AlertFrequency;
  /** 0 = Sunday … 6 = Saturday (weekly alerts only). */
  weekday?: number;
  active: boolean;
  newMatches: number;
  lastSentAt?: string;
  createdAt: string;
}
