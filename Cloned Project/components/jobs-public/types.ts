// Shapes returned by the public (no-login) Garage Jobs endpoints —
// garagenew-backend routes/jobsCandidate.ts, `/jobs/public/*`.

import type { EmploymentType, StageCategory, WorkplaceType } from "@/components/dashboard/jobs/types";

export interface PublicOrg {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  city?: string;
  country?: string;
  description?: string;
}

export interface PublicJob {
  _id: string;
  slug: string;
  title: string;
  department?: string;
  status: string;
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
}

export interface PublicJobDetail extends PublicJob {
  description: {
    aboutRole?: string;
    responsibilities?: string;
    requirements?: string;
    niceToHave?: string;
    offer?: string;
  };
  education?: { required?: boolean; qualification?: string };
  perks: string[];
  process: StageCategory[];
  formPages: number;
  estimatedMinutes: number;
  applicants: number;
}

export interface CareersResponse {
  success: boolean;
  org: PublicOrg;
  careersPage: {
    coverImage?: string;
    headline?: string;
    about?: string;
    culturePhotos: string[];
    perks: string[];
  };
  jobs: PublicJob[];
}

export interface PublicJobResponse {
  success: boolean;
  job: PublicJobDetail;
  referrer: { name?: string; avatar?: string; affiliateId: string } | null;
}
