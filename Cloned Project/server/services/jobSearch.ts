// src/services/jobSearch.ts
//
// One definition of "which live postings match these criteria", shared by
// GET /jobs/discover and job alerts (endpoints + sweeper digests), so an alert
// always finds exactly what the same search shows in Discover.

import { Organization } from "../models/organization.model";
import { EMPLOYMENT_TYPES, WORKPLACE_TYPES } from "../models/jobPosting.model";
import type { IJobAlertCriteria } from "../models/jobAlert.model";

export interface JobSearchCriteria extends IJobAlertCriteria {
  /** Discover only: published within the last N days. */
  postedWithin?: number;
}

/** Every posting Garage members can see in Jobs → Discover. */
export const LIVE_HQ_FILTER = {
  status: "live",
  "channels.garageHq": true,
  deletedAt: null,
} as const;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Drop empty values so stored criteria and summaries stay clean. */
export function normalizeCriteria(c: IJobAlertCriteria): IJobAlertCriteria {
  const out: IJobAlertCriteria = {};
  const q = c.q?.trim();
  if (q) out.q = q;
  const location = c.location?.trim();
  if (location) out.location = location;
  const workplace = (c.workplace || []).filter((w) => (WORKPLACE_TYPES as readonly string[]).includes(w));
  if (workplace.length) out.workplace = [...new Set(workplace)];
  const employment = (c.employmentType || []).filter((e) => (EMPLOYMENT_TYPES as readonly string[]).includes(e));
  if (employment.length) out.employmentType = [...new Set(employment)];
  if (typeof c.experience === "number" && !Number.isNaN(c.experience) && c.experience >= 0) out.experience = c.experience;
  if (typeof c.salaryMin === "number" && c.salaryMin > 0) out.salaryMin = c.salaryMin;
  const department = c.department?.trim();
  if (department) out.department = department;
  return out;
}

/** Discover's query string → criteria (comma lists for multi-selects). */
export function criteriaFromQuery(query: Record<string, unknown>): JobSearchCriteria {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const list = (v: unknown) => str(v).split(",").map((s) => s.trim()).filter(Boolean);
  const num = (v: unknown) => {
    const s = str(v);
    if (s === "") return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? undefined : n;
  };
  return {
    ...normalizeCriteria({
      q: str(query.q),
      location: str(query.location),
      workplace: list(query.workplace),
      employmentType: list(query.employmentType),
      experience: num(query.experience),
      salaryMin: num(query.salaryMin),
      department: str(query.department),
    }),
    postedWithin: num(query.postedWithin),
  };
}

/**
 * Mongo filter for live Garage-HQ postings matching `c`. `publishedAfter`
 * narrows to postings that went live after a moment (alert digests).
 */
export async function buildJobSearchFilter(
  c: JobSearchCriteria,
  opts: { publishedAfter?: Date } = {}
): Promise<Record<string, any>> {
  const filter: Record<string, any> = { ...LIVE_HQ_FILTER };
  const and: Record<string, any>[] = [];

  if (c.q) {
    const rx = { $regex: escapeRegex(c.q), $options: "i" };
    const orgIds = (await Organization.find({ name: rx }).select("_id").limit(200).lean<any[]>()).map((o) => o._id);
    and.push({ $or: [{ title: rx }, { skills: rx }, { department: rx }, { orgId: { $in: orgIds } }] });
  }
  if (c.location) {
    and.push({ $or: [{ locations: { $regex: escapeRegex(c.location), $options: "i" } }, { workplace: "remote" }] });
  }
  if (c.workplace?.length) filter.workplace = { $in: c.workplace };
  if (c.employmentType?.length) filter.employmentType = { $in: c.employmentType };
  if (c.department) filter.department = c.department;
  if (typeof c.experience === "number") {
    and.push({ $or: [{ experienceMin: { $lte: c.experience } }, { experienceMin: null }] });
  }
  if (c.salaryMin && c.salaryMin > 0) and.push({ "salary.show": true, "salary.max": { $gte: c.salaryMin } });

  const published: Record<string, Date> = {};
  if (c.postedWithin && c.postedWithin > 0) published.$gte = new Date(Date.now() - c.postedWithin * 86400000);
  if (opts.publishedAfter) published.$gt = opts.publishedAfter;
  if (Object.keys(published).length) filter.publishedAt = published;

  if (and.length) filter.$and = and;
  return filter;
}

const WORKPLACE_LABEL: Record<string, string> = { hybrid: "Hybrid", remote: "Remote", onsite: "On-site" };
const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

/** "Product Designer · Bengaluru · Hybrid · Full-time" — the default alert name. */
export function summarizeCriteria(c: IJobAlertCriteria): string {
  const parts = [
    c.q,
    c.location,
    c.department,
    ...(c.workplace || []).map((w) => WORKPLACE_LABEL[w] || w),
    ...(c.employmentType || []).map((e) => EMPLOYMENT_LABEL[e] || e),
    typeof c.experience === "number" ? `${c.experience}+ yrs` : undefined,
    c.salaryMin ? `Salary ${c.salaryMin.toLocaleString("en-US")}+` : undefined,
  ].filter(Boolean) as string[];
  return (parts.join(" · ") || "All new jobs").slice(0, 160);
}
