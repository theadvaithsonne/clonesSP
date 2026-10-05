// src/routes/jobsFounder.ts
//
// Founder API for Garage Jobs, mounted at /jobs/founder.
//
// Every route runs requireAuth + `manager`, which resolves the office from the
// caller's token and checks founder access against their membership record —
// an org id sent by the client is never trusted. Guards are attached per route
// (not router.use) because this router shares the /jobs prefix with the
// candidate router.
//
// Money never moves here directly: publishing, hiring, closing and "left
// early" call services/jobRewards.ts, which only uses the existing wallet and
// Unilevel Plus functions.

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import OpenAI from "openai";
import { requireAuth, AuthUser } from "../middleware/auth";
import { env } from "../config/env";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import {
  JobPosting,
  IJobPosting,
  JOB_FIELD_TYPES,
  CONDITION_OPERATORS,
  STAGE_CATEGORIES,
  TEAM_ROLES,
  EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
  AUTO_ACTION_TRIGGERS,
  AUTO_ACTION_KINDS,
  StageCategory,
} from "../models/jobPosting.model";
import {
  JobApplication,
  IJobApplication,
  APPLICATION_SOURCES,
} from "../models/jobApplication.model";
import { JobActivity } from "../models/jobActivity.model";
import {
  JobInterview,
  INTERVIEW_MODES,
  RECOMMENDATIONS,
} from "../models/jobInterview.model";
import { JobOffer } from "../models/jobOffer.model";
import { JobReward } from "../models/jobReward.model";
import { JobEvent } from "../models/jobEvent.model";
import { EMAIL_TEMPLATE_KINDS } from "../models/jobsSettings.model";
import * as jobs from "../services/jobs";
import { sendMail, senderForOrg } from "../services/mailer";
import {
  holdJobRewards,
  releaseJobHold,
  createRewardForHire,
  rescheduleReward,
  cancelRewardLeftEarly,
  rewardSplitPreview,
  paidRewardSplit,
  holdAmountFor,
  InsufficientFundsError,
} from "../services/jobRewards";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────

type Ctx = { userId: string; orgId: string; email?: string };

function bad(res: Response, status: number, error: string, extra?: Record<string, any>) {
  return res.status(status).json({ success: false, error, ...(extra || {}) });
}

async function manager(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.userId || !user.orgId) return bad(res, 401, "Not authenticated");
  if (!(await jobs.canManageJobs(user.userId, user.orgId))) {
    return bad(res, 403, "Only the office's founders can manage jobs");
  }
  res.locals.ctx = { userId: user.userId, orgId: user.orgId, email: user.email } as Ctx;
  next();
}

const guard = [requireAuth, manager];
const ctx = (res: Response) => res.locals.ctx as Ctx;

const objectIdZ = z.string().refine((v) => Types.ObjectId.isValid(v), "Invalid id");
const isoZ = z.string().datetime({ offset: true });

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const r = schema.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    bad(res, 400, `${issue.path.join(".") || "body"}: ${issue.message}`);
    return null;
  }
  return r.data;
}

async function loadJob(res: Response, id: string): Promise<IJobPosting | null> {
  if (!jobs.isObjectId(id)) {
    bad(res, 404, "Job not found");
    return null;
  }
  const job = await JobPosting.findOne({ _id: id, orgId: ctx(res).orgId, deletedAt: null });
  if (!job) bad(res, 404, "Job not found");
  return job;
}

async function loadApp(res: Response, id: string): Promise<IJobApplication | null> {
  if (!jobs.isObjectId(id)) {
    bad(res, 404, "Application not found");
    return null;
  }
  const app = await JobApplication.findOne({ _id: id, orgId: ctx(res).orgId, isDraft: false });
  if (!app) bad(res, 404, "Application not found");
  return app;
}

type Person = { _id: string; name: string; email?: string; avatar?: string; affiliateId?: string };

async function peopleById(ids: Array<string | Types.ObjectId | undefined | null>): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))].filter(jobs.isObjectId);
  const map = new Map<string, Person>();
  if (!unique.length) return map;
  const users = await User.find({ _id: { $in: unique } })
    .select("name email profilePicture affiliateId")
    .lean<any[]>();
  for (const u of users) {
    map.set(String(u._id), {
      _id: String(u._id),
      name: u.name || (u.email ? String(u.email).split("@")[0] : "Unknown"),
      email: u.email,
      avatar: u.profilePicture,
      affiliateId: u.affiliateId,
    });
  }
  return map;
}

async function orgInfo(orgId: string) {
  const org = await Organization.findById(orgId).select("name slug icon city country description").lean<any>();
  return {
    _id: orgId,
    name: org?.name || "Your office",
    slug: org?.slug || orgId,
    icon: org?.icon,
    city: org?.city,
    country: org?.country,
    description: org?.description,
  };
}

const CLOSED_STATUSES = ["closed", "filled", "expired"];
const OPEN_STATUSES = ["live", "paused", "scheduled"];

type JobStats = {
  total: number;
  fresh: number;
  hired: number;
  rejected: number;
  byCategory: Record<StageCategory, number>;
};

function emptyStats(): JobStats {
  return {
    total: 0,
    fresh: 0,
    hired: 0,
    rejected: 0,
    byCategory: STAGE_CATEGORIES.reduce((a, c) => ({ ...a, [c]: 0 }), {} as Record<StageCategory, number>),
  };
}

async function statsByJob(jobIds: Types.ObjectId[]): Promise<Map<string, JobStats>> {
  const map = new Map<string, JobStats>();
  if (!jobIds.length) return map;
  const rows = await JobApplication.aggregate([
    { $match: { jobId: { $in: jobIds }, isDraft: false } },
    {
      $group: {
        _id: { jobId: "$jobId", cat: "$stageCategory", status: "$status" },
        n: { $sum: 1 },
        fresh: { $sum: { $cond: [{ $ifNull: ["$reviewedAt", false] }, 0, 1] } },
      },
    },
  ]);
  for (const r of rows) {
    const key = String(r._id.jobId);
    const s = map.get(key) || emptyStats();
    s.total += r.n;
    if (r._id.status === "active") {
      s.byCategory[r._id.cat as StageCategory] = (s.byCategory[r._id.cat as StageCategory] || 0) + r.n;
      s.fresh += r.fresh;
    }
    if (r._id.status === "hired") s.hired += r.n;
    if (r._id.status === "rejected") s.rejected += r.n;
    map.set(key, s);
  }
  return map;
}

function postingRow(job: any, stats: JobStats | undefined, people: Map<string, Person>, orgSlug?: string) {
  const s = stats || emptyStats();
  return {
    _id: String(job._id),
    title: job.title || "Untitled job",
    slug: job.slug,
    publicUrl: orgSlug ? jobs.publicJobUrl(orgSlug, job.slug) : undefined,
    department: job.department || "",
    status: job.status,
    createdBy: people.get(String(job.createdBy)) || { _id: String(job.createdBy), name: "Unknown" },
    applicants: s.total,
    newApplicants: s.fresh,
    hired: s.hired,
    stageCounts: s.byCategory,
    reward: {
      enabled: !!job.reward?.enabled,
      amount: job.reward?.amount || 0,
      funding: job.reward?.funding,
      heldAmount: job.reward?.heldAmount || 0,
      guaranteeDays: job.reward?.guaranteeDays,
    },
    channels: job.channels,
    locations: job.locations || [],
    workplace: job.workplace,
    employmentType: job.employmentType,
    openings: job.openings,
    closesAt: job.closesAt,
    publishAt: job.publishAt,
    publishedAt: job.publishedAt,
    completedStep: job.completedStep,
    updatedAt: job.updatedAt,
    createdAt: job.createdAt,
  };
}

// ── Schemas ──────────────────────────────────────────────────────────────

const shortId = z.string().min(1).max(40);

const optionZ = z.object({ id: shortId, label: z.string().max(300) });

const knockoutZ = z.object({
  enabled: z.boolean(),
  answer: z.string().max(60),
  moveToRejected: z.boolean().default(true),
  addReason: z.boolean().default(true),
  reason: z.string().max(200).optional(),
  notifyTeam: z.boolean().default(false),
  emailTemplateId: z.string().max(40).optional(),
  delayEmail: z.boolean().default(true),
});

const conditionZ = z.object({
  fieldId: shortId,
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().max(200),
  hideUntilMet: z.boolean().default(true),
  clearIfHidden: z.boolean().default(true),
});

const fieldZ = z.object({
  id: shortId,
  type: z.enum(JOB_FIELD_TYPES),
  label: z.string().max(500),
  helpText: z.string().max(1000).optional(),
  required: z.boolean().default(false),
  locked: z.boolean().default(false),
  options: z.array(optionZ).max(50).default([]),
  fileTypes: z.array(z.string().max(10)).max(10).default([]),
  maxSizeMb: z.number().min(1).max(100).optional(),
  multiple: z.boolean().default(false),
  parseResume: z.boolean().default(false),
  scaleMax: z.number().int().min(2).max(10).optional(),
  maxLength: z.number().int().min(1).max(20000).optional(),
  correctOptionId: z.string().max(40).optional(),
  points: z.number().min(0).max(100).optional(),
  talentPoolConsent: z.boolean().default(false),
  knockout: knockoutZ.optional().nullable(),
  condition: conditionZ.optional().nullable(),
});

const pageZ = z.object({
  id: shortId,
  title: z.string().max(200),
  description: z.string().max(500).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
  passMark: z.number().min(0).max(1000).optional().nullable(),
  fields: z.array(fieldZ).max(100),
});

const autoActionZ = z.object({
  id: shortId,
  trigger: z.enum(AUTO_ACTION_TRIGGERS),
  value: z.number().min(0).max(1000).optional(),
  action: z.enum(AUTO_ACTION_KINDS),
  targetStageId: z.string().max(40).optional(),
  emailTemplateId: z.string().max(40).optional(),
});

const stageZ = z.object({
  id: shortId,
  name: z.string().min(1).max(80),
  category: z.enum(STAGE_CATEGORIES),
  ownerId: objectIdZ.optional().nullable(),
  autoActions: z.array(autoActionZ).max(10).default([]),
});

const jobPatchZ = z
  .object({
    title: z.string().max(160),
    department: z.string().max(80),
    openings: z.number().int().min(1).max(500),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    workplace: z.enum(WORKPLACE_TYPES),
    officeDays: z.number().int().min(1).max(7).nullable(),
    locations: z.array(z.string().min(1).max(120)).max(20),
    experienceMin: z.number().min(0).max(60).nullable(),
    experienceMax: z.number().min(0).max(60).nullable(),
    joining: z.string().max(80),
    salary: z
      .object({
        show: z.boolean(),
        currency: z.string().min(3).max(6),
        min: z.number().min(0).nullable(),
        max: z.number().min(0).nullable(),
        period: z.enum(["year", "month", "hour"]),
      })
      .partial(),
    description: z
      .object({
        aboutRole: z.string().max(20000),
        responsibilities: z.string().max(20000),
        requirements: z.string().max(20000),
        niceToHave: z.string().max(20000),
        offer: z.string().max(20000),
      })
      .partial(),
    skills: z.array(z.string().min(1).max(60)).max(30),
    education: z
      .object({ required: z.boolean(), qualification: z.string().max(120) })
      .partial(),
    perks: z.array(z.string().min(1).max(80)).max(30),
    form: z.object({ pages: z.array(pageZ).max(20) }),
    stages: z.array(stageZ).min(2).max(15),
    team: z.array(z.object({ userId: objectIdZ, role: z.enum(TEAM_ROLES) })).max(30),
    candidateEmails: z
      .object({
        applicationReceived: z.boolean(),
        movedToInterview: z.boolean(),
        rejection: z.boolean(),
        rejectionDelayHours: z.number().int().min(0).max(168),
        offer: z.boolean(),
      })
      .partial(),
    reward: z
      .object({
        enabled: z.boolean(),
        amount: z.number().min(0).max(100000),
        guaranteeDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
        funding: z.enum(["hold", "on_hire"]),
      })
      .partial(),
    channels: z
      .object({ garageHq: z.boolean(), university: z.boolean(), publicLink: z.boolean() })
      .partial(),
    publishMode: z.enum(["now", "scheduled"]),
    publishAt: isoZ.nullable(),
    closesAt: isoZ.nullable(),
    autoCloseOnHires: z.boolean(),
    completedStep: z.number().int().min(0).max(6),
  })
  .partial();

// ── Overview (A1) ────────────────────────────────────────────────────────

router.get("/overview", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const org = new Types.ObjectId(orgId);
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d60 = new Date(now.getTime() - 60 * 86400000);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const jobFilter = jobs.isObjectId(String(req.query.jobId || ""))
    ? new Types.ObjectId(String(req.query.jobId))
    : null;
  const appMatch: Record<string, any> = { orgId: org, isDraft: false, ...(jobFilter ? { jobId: jobFilter } : {}) };

  const [
    liveJobs,
    applicants30,
    applicantsPrev,
    interviewRows,
    hiredQuarter,
    hiredQuarterReferral,
    heldRows,
    guaranteeRows,
    funnelRows,
    sourceRows,
    freshCount,
    closingSoon,
    upcomingJoins,
    overdueInterviews,
    jobList,
  ] = await Promise.all([
    JobPosting.find({ orgId, status: "live", deletedAt: null })
      .sort({ publishedAt: -1 })
      .lean<any[]>(),
    JobApplication.countDocuments({ orgId: org, isDraft: false, appliedAt: { $gte: d30 } }),
    JobApplication.countDocuments({ orgId: org, isDraft: false, appliedAt: { $gte: d60, $lt: d30 } }),
    JobApplication.aggregate([
      { $match: { orgId: org, isDraft: false, status: "active", stageCategory: "interview" } },
      { $group: { _id: "$jobId", n: { $sum: 1 } } },
    ]),
    JobApplication.countDocuments({ orgId: org, status: "hired", hiredAt: { $gte: quarterStart } }),
    JobApplication.countDocuments({
      orgId: org,
      status: "hired",
      hiredAt: { $gte: quarterStart },
      "referral.referrerId": { $exists: true },
    }),
    JobPosting.aggregate([
      { $match: { orgId: org, deletedAt: null } },
      { $group: { _id: null, held: { $sum: "$reward.heldAmount" } } },
    ]),
    JobReward.aggregate([
      { $match: { orgId: org, status: "in_guarantee", funding: "hold" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    JobApplication.aggregate([
      { $match: appMatch },
      { $group: { _id: "$maxStageRank", n: { $sum: 1 } } },
    ]),
    JobApplication.aggregate([
      { $match: appMatch },
      { $group: { _id: "$source", n: { $sum: 1 } } },
    ]),
    JobApplication.countDocuments({ orgId: org, isDraft: false, status: "active", reviewedAt: null }),
    JobPosting.find({
      orgId,
      status: "live",
      deletedAt: null,
      closesAt: { $gte: now, $lte: new Date(now.getTime() + 3 * 86400000) },
    })
      .select("title closesAt")
      .lean<any[]>(),
    JobReward.find({ orgId: org, status: "in_guarantee", joinedAt: { $gte: now } })
      .sort({ joinedAt: 1 })
      .limit(3)
      .lean<any[]>(),
    JobInterview.find({ orgId: org, status: "scheduled", scheduledAt: { $lt: now } })
      .select("interviewerIds scorecards")
      .lean<any[]>(),
    JobPosting.find({ orgId, deletedAt: null, status: { $ne: "draft" } })
      .select("title")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean<any[]>(),
  ]);

  const funnelCounts = STAGE_CATEGORIES.map((category, rank) => ({
    category,
    count: funnelRows
      .filter((r: any) => (r._id ?? 0) >= rank)
      .reduce((s: number, r: any) => s + r.n, 0),
  }));

  const overdueScorecards = overdueInterviews.filter((iv) => {
    const submitted = (iv.scorecards || []).filter((s: any) => s.submittedAt).length;
    return submitted < Math.max(1, (iv.interviewerIds || []).length);
  }).length;

  const hireApps = upcomingJoins.length
    ? await JobApplication.find({ _id: { $in: upcomingJoins.map((r) => r.applicationId) } })
        .select("profile candidateId")
        .lean<any[]>()
    : [];
  const hireNames = new Map(hireApps.map((a) => [String(a._id), a.profile?.fullName || "A hire"]));

  const attention: Array<Record<string, any>> = [];
  if (freshCount) attention.push({ kind: "new_applications", count: freshCount });
  if (overdueScorecards) attention.push({ kind: "overdue_scorecards", count: overdueScorecards });
  for (const j of closingSoon) {
    attention.push({ kind: "closing_soon", jobId: String(j._id), title: j.title, closesAt: j.closesAt });
  }
  for (const r of upcomingJoins) {
    attention.push({
      kind: "guarantee_starts",
      rewardId: String(r._id),
      name: hireNames.get(String(r.applicationId)) || "A hire",
      joinedAt: r.joinedAt,
    });
  }

  const liveStats = await statsByJob(liveJobs.map((j) => j._id));
  const posters = await peopleById(liveJobs.map((j) => j.createdBy));
  const orgDetails = await orgInfo(orgId);

  res.json({
    success: true,
    metrics: {
      liveJobs: liveJobs.length,
      acceptingJobs: liveJobs.filter((j) => !j.closesAt || new Date(j.closesAt) > now).length,
      applicants30d: applicants30,
      applicantsPrev30d: applicantsPrev,
      inInterview: interviewRows.reduce((s: number, r: any) => s + r.n, 0),
      interviewJobs: interviewRows.length,
      hiredQuarter,
      hiredQuarterReferral,
      rewardsHeld:
        Math.round(((heldRows[0]?.held || 0) + (guaranteeRows[0]?.amount || 0)) * 100) / 100,
    },
    funnel: funnelCounts,
    sources: sourceRows.map((r: any) => ({ source: r._id, count: r.n })),
    attention,
    liveJobs: liveJobs.slice(0, 5).map((j) => postingRow(j, liveStats.get(String(j._id)), posters, orgDetails.slug)),
    jobs: jobList.map((j) => ({ _id: String(j._id), title: j.title })),
  });
});

// ── Postings (A2) ────────────────────────────────────────────────────────

router.get("/postings", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const tab = String(req.query.status || "all");
  const q = String(req.query.q || "").trim();
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));

  const base: Record<string, any> = { orgId, deletedAt: null };
  const filter: Record<string, any> = { ...base };
  if (tab === "live") filter.status = { $in: ["live", "scheduled"] };
  else if (tab === "draft") filter.status = "draft";
  else if (tab === "paused") filter.status = "paused";
  else if (tab === "closed") filter.status = { $in: CLOSED_STATUSES };
  if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (req.query.department) filter.department = String(req.query.department);
  if (req.query.location) filter.locations = String(req.query.location);
  if (jobs.isObjectId(String(req.query.postedBy || ""))) filter.createdBy = String(req.query.postedBy);

  const sortKey = String(req.query.sort || "updated");
  const sort: Record<string, 1 | -1> =
    sortKey === "created"
      ? { createdAt: -1 }
      : sortKey === "closes"
        ? { closesAt: 1 }
        : sortKey === "title"
          ? { title: 1 }
          : { updatedAt: -1 };

  const [rows, total, statusRows, departments, locations, posterIds] = await Promise.all([
    JobPosting.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean<any[]>(),
    JobPosting.countDocuments(filter),
    JobPosting.aggregate([
      { $match: { orgId: new Types.ObjectId(orgId), deletedAt: null } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    JobPosting.distinct("department", base),
    JobPosting.distinct("locations", base),
    JobPosting.distinct("createdBy", base),
  ]);

  const byStatus = new Map(statusRows.map((r: any) => [r._id, r.n as number]));
  const count = (...s: string[]) => s.reduce((a, k) => a + (byStatus.get(k) || 0), 0);
  const stats = await statsByJob(rows.map((r) => r._id));
  const people = await peopleById([...rows.map((r) => r.createdBy), ...posterIds]);
  const org = await orgInfo(orgId);
  const applicantsTotal = await JobApplication.countDocuments({
    orgId: new Types.ObjectId(orgId),
    isDraft: false,
    jobId: { $in: (await JobPosting.find(base).select("_id").lean<any[]>()).map((j) => j._id) },
  });

  res.json({
    success: true,
    org,
    postings: rows.map((r) => postingRow(r, stats.get(String(r._id)), people, org.slug)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    applicantsTotal,
    counts: {
      all: count(...["draft", "scheduled", "live", "paused", ...CLOSED_STATUSES]),
      live: count("live", "scheduled"),
      draft: count("draft"),
      paused: count("paused"),
      closed: count(...CLOSED_STATUSES),
    },
    filters: {
      departments: (departments as string[]).filter(Boolean).sort(),
      locations: (locations as string[]).filter(Boolean).sort(),
      posters: (posterIds as any[]).map((id) => people.get(String(id))).filter(Boolean),
    },
  });
});

// ── Jobs: create / read / update ─────────────────────────────────────────

router.post("/jobs", guard, async (req: Request, res: Response) => {
  const { orgId, userId } = ctx(res);
  const body = parse(z.object({ title: z.string().max(160).optional() }), req.body || {}, res);
  if (!body) return;
  const org = await orgInfo(orgId);
  const settings = await jobs.getJobsSettings(orgId);
  const title = (body.title || "").trim();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const job = await JobPosting.create({
        orgId,
        createdBy: userId,
        status: "draft",
        slug: await jobs.uniqueJobSlug(orgId, title || `job-${jobs.newId()}`),
        title,
        form: { pages: jobs.defaultFormPages(org.name) },
        stages: jobs.defaultStagesFor(settings),
        team: [{ userId: new Types.ObjectId(userId), role: "hiring_manager" }],
      });
      return res.status(201).json({ success: true, job });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  }
  return bad(res, 409, "Could not create the job, please try again");
});

router.get("/jobs/:id", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  const org = await orgInfo(ctx(res).orgId);
  const people = await peopleById([
    ...job.team.map((t) => t.userId),
    ...job.stages.map((s) => s.ownerId),
    job.createdBy,
  ]);
  const stats = (await statsByJob([job._id])).get(String(job._id)) || emptyStats();
  const preview = job.reward?.enabled && job.reward.amount > 0 ? await rewardSplitPreview(job.reward.amount) : null;
  res.json({
    success: true,
    job,
    org,
    publicUrl: jobs.publicJobUrl(org.slug, job.slug),
    people: Object.fromEntries(people),
    stats,
    problems: jobs.publishProblems(job),
    rewardPreview: preview,
    holdRequired: holdAmountFor(job),
  });
});

router.patch("/jobs/:id", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  const patch = parse(jobPatchZ, req.body || {}, res);
  if (!patch) return;

  const published = job.status !== "draft";
  if (published && patch.reward && (job.reward?.totalHeld || 0) > 0) {
    const changesMoney =
      (patch.reward.amount !== undefined && patch.reward.amount !== job.reward.amount) ||
      (patch.reward.funding !== undefined && patch.reward.funding !== job.reward.funding) ||
      (patch.reward.enabled !== undefined && patch.reward.enabled !== job.reward.enabled);
    if (changesMoney) {
      return bad(res, 409, "The referral reward is locked while rewards are held for this job.");
    }
  }

  if (patch.stages && published) {
    const keep = new Set(patch.stages.map((s) => s.id));
    const removed = job.stages.filter((s) => !keep.has(s.id)).map((s) => s.id);
    if (removed.length) {
      const stuck = await JobApplication.countDocuments({
        jobId: job._id,
        isDraft: false,
        status: "active",
        stageId: { $in: removed },
      });
      if (stuck) return bad(res, 409, "Move candidates out of a stage before removing it.");
    }
  }

  const set: Record<string, any> = {};
  const unset: Record<string, 1> = {};
  const nested = ["salary", "description", "education", "candidateEmails", "reward", "channels"] as const;
  for (const [key, value] of Object.entries(patch)) {
    if ((nested as readonly string[]).includes(key) && value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (v === null) unset[`${key}.${k}`] = 1;
        else set[`${key}.${k}`] = v;
      }
    } else if (key === "publishAt" || key === "closesAt") {
      if (value === null) unset[key] = 1;
      else set[key] = new Date(value as string);
    } else if (value === null) {
      unset[key] = 1;
    } else if (key === "completedStep") {
      set.completedStep = Math.max(job.completedStep || 0, value as number);
    } else {
      set[key] = value;
    }
  }

  if (typeof patch.title === "string" && !published) {
    const nextTitle = patch.title.trim();
    if (nextTitle && jobs.slugify(nextTitle) !== job.slug.replace(/-\d+$/, "")) {
      set.slug = await jobs.uniqueJobSlug(String(job.orgId), nextTitle, String(job._id));
    }
    set.title = nextTitle;
  }

  const updated = await JobPosting.findOneAndUpdate(
    { _id: job._id },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true, runValidators: true }
  );
  res.json({ success: true, job: updated, problems: updated ? jobs.publishProblems(updated) : [] });
});

// ── Jobs: lifecycle ──────────────────────────────────────────────────────

router.post("/jobs/:id/publish", guard, async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(res);
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  if (!["draft", "scheduled"].includes(job.status)) {
    return bad(res, 409, `This job is already ${job.status}.`);
  }
  const problems = jobs.publishProblems(job);
  if (problems.length) return bad(res, 400, problems[0], { problems });

  let heldAmount = job.reward?.heldAmount || 0;
  try {
    heldAmount = await holdJobRewards(job, userId);
  } catch (err: any) {
    if (err instanceof InsufficientFundsError) {
      return bad(res, 402, "Your GaragePay balance is too low to hold the referral rewards.", {
        balance: err.balance,
        required: err.required,
      });
    }
    throw err;
  }

  const now = new Date();
  const scheduled = job.publishMode === "scheduled" && job.publishAt && job.publishAt > now;
  const updated = await JobPosting.findByIdAndUpdate(
    job._id,
    {
      $set: {
        status: scheduled ? "scheduled" : "live",
        completedStep: 6,
        ...(scheduled ? {} : { publishedAt: now }),
      },
    },
    { new: true }
  );
  const org = await orgInfo(orgId);
  res.json({
    success: true,
    job: updated,
    publicUrl: jobs.publicJobUrl(org.slug, job.slug),
    heldAmount,
  });
});

router.post("/jobs/:id/pause", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  if (job.status !== "live") return bad(res, 409, "Only live jobs can be paused.");
  job.status = "paused";
  await job.save();
  res.json({ success: true, job });
});

router.post("/jobs/:id/resume", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  if (job.status !== "paused") return bad(res, 409, "Only paused jobs can be resumed.");
  if (job.closesAt && job.closesAt <= new Date()) {
    return bad(res, 409, "The closing date has passed — extend it before resuming.");
  }
  job.status = "live";
  if (!job.publishedAt) job.publishedAt = new Date();
  await job.save();
  res.json({ success: true, job });
});

router.post("/jobs/:id/close", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  if (!OPEN_STATUSES.includes(job.status)) return bad(res, 409, `This job is ${job.status}.`);
  job.status = "closed";
  job.closedAt = new Date();
  await job.save();
  const released = await releaseJobHold(job._id, "job closed").catch(() => 0);
  res.json({ success: true, job: await JobPosting.findById(job._id), released });
});

router.post("/jobs/:id/duplicate", guard, async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(res);
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  const src: any = job.toObject();
  const title = `${src.title || "Untitled job"} (copy)`.slice(0, 160);
  const copy = await JobPosting.create({
    orgId,
    createdBy: userId,
    status: "draft",
    slug: await jobs.uniqueJobSlug(orgId, title),
    title,
    department: src.department,
    openings: src.openings,
    employmentType: src.employmentType,
    workplace: src.workplace,
    officeDays: src.officeDays,
    locations: src.locations,
    experienceMin: src.experienceMin,
    experienceMax: src.experienceMax,
    joining: src.joining,
    salary: src.salary,
    description: src.description,
    skills: src.skills,
    education: src.education,
    perks: src.perks,
    form: src.form,
    stages: src.stages,
    team: src.team,
    candidateEmails: src.candidateEmails,
    reward: {
      enabled: src.reward?.enabled,
      amount: src.reward?.amount,
      guaranteeDays: src.reward?.guaranteeDays,
      funding: src.reward?.funding,
      heldAmount: 0,
      totalHeld: 0,
    },
    channels: src.channels,
    publishMode: "now",
    autoCloseOnHires: src.autoCloseOnHires,
    completedStep: Math.min(5, src.completedStep || 0),
  });
  res.status(201).json({ success: true, job: copy });
});

router.delete("/jobs/:id", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  if (OPEN_STATUSES.includes(job.status)) {
    return bad(res, 409, "Live jobs can be closed, not deleted.");
  }
  await releaseJobHold(job._id, "job deleted").catch(() => 0);
  const hasApplicants = await JobApplication.exists({ jobId: job._id });
  if (hasApplicants) {
    job.deletedAt = new Date();
    await job.save();
  } else {
    await JobPosting.deleteOne({ _id: job._id });
  }
  res.json({ success: true });
});

// ── Pipeline (A11) ───────────────────────────────────────────────────────

function sourceLabel(source: string): string {
  switch (source) {
    case "garage_hq":
      return "Garage HQ";
    case "university":
      return "Garage University";
    case "public_link":
      return "Public link";
    case "careers_page":
      return "Careers page";
    case "referral":
      return "Referral";
    case "talent_pool":
      return "Talent pool";
    default:
      return source;
  }
}

function shortDate(d?: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** The one-line status under a candidate card / in the applications table. */
async function contextLines(
  apps: Array<Pick<IJobApplication, "_id" | "stageCategory" | "status" | "source" | "appliedAt" | "quiz" | "joiningDate">>,
  people?: Map<string, Person>
): Promise<Map<string, string>> {
  const ids = apps.map((a) => a._id);
  const [interviews, offers, rewards] = await Promise.all([
    JobInterview.find({ applicationId: { $in: ids }, status: { $ne: "cancelled" } })
      .sort({ createdAt: -1 })
      .lean<any[]>(),
    JobOffer.find({ applicationId: { $in: ids } }).sort({ createdAt: -1 }).lean<any[]>(),
    JobReward.find({ applicationId: { $in: ids } }).select("applicationId status").lean<any[]>(),
  ]);
  const interviewer = people || (await peopleById(interviews.flatMap((i) => i.interviewerIds || [])));
  const lines = new Map<string, string>();
  for (const a of apps) {
    const id = String(a._id);
    let line = `${sourceLabel(a.source)} · ${shortDate(a.appliedAt)}`;
    if (a.status === "hired") {
      const reward = rewards.find((r) => String(r.applicationId) === id);
      line = `Joining ${shortDate(a.joiningDate)}${reward?.status === "in_guarantee" ? " · reward in guarantee" : ""}`;
    } else if (a.stageCategory === "offer") {
      const o = offers.find((x) => String(x.applicationId) === id);
      if (o) {
        const amt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(o.ctc);
        line =
          o.status === "accepted"
            ? "Offer accepted"
            : o.status === "declined"
              ? "Offer declined"
              : `${o.currency} ${amt}${o.expiresAt ? ` · expires ${shortDate(o.expiresAt)}` : ""}`;
      } else line = "Offer not sent yet";
    } else if (a.stageCategory === "interview") {
      const iv = interviews.find((x) => String(x.applicationId) === id);
      if (iv) {
        const submitted = (iv.scorecards || []).filter((s: any) => s.submittedAt);
        if (iv.status === "awaiting_candidate") line = "Waiting for candidate to pick a slot";
        else if (iv.status === "completed" && submitted.length) {
          const avg =
            submitted.reduce(
              (s: number, c: any) =>
                s + (c.ratings?.length ? c.ratings.reduce((x: number, r: any) => x + r.score, 0) / c.ratings.length : 0),
              0
            ) / submitted.length;
          line = `${(submitted[0].recommendation || "scored").replace("_", " ")} · ${avg.toFixed(1)}`;
        } else if (iv.scheduledAt && new Date(iv.scheduledAt) < new Date()) line = "Awaiting score";
        else if (iv.scheduledAt) {
          const who = interviewer.get(String(iv.interviewerIds?.[0] || ""))?.name?.split(" ")[0];
          line = `${shortDate(iv.scheduledAt)}${who ? ` · ${who}` : ""}`;
        }
      }
    } else if (a.stageCategory === "assessment" && a.quiz?.total) {
      line = `Quiz ${a.quiz.score}/${a.quiz.total} · ${a.quiz.passed ? "passed" : "not passed"}`;
    }
    lines.set(id, line);
  }
  return lines;
}

router.get("/jobs/:id/pipeline", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  const filter: Record<string, any> = { jobId: job._id, isDraft: false };
  const q = String(req.query.q || "").trim();
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ "profile.fullName": rx }, { "profile.email": rx }, { tags: rx }, { matchedSkills: rx }];
  }
  if (req.query.source && (APPLICATION_SOURCES as readonly string[]).includes(String(req.query.source))) {
    filter.source = String(req.query.source);
  }
  const minMatch = Number(req.query.minMatch || 0);
  if (minMatch > 0) filter.matchScore = { $gte: minMatch };
  if (req.query.tag) filter.tags = String(req.query.tag);

  const apps = await JobApplication.find(filter)
    .sort(req.query.sort === "applied" ? { appliedAt: -1 } : { matchScore: -1, appliedAt: -1 })
    .limit(1000)
    .lean<any[]>();
  const people = await peopleById(apps.map((a) => a.candidateId));
  const lines = await contextLines(apps);

  const card = (a: any) => ({
    _id: String(a._id),
    candidateId: String(a.candidateId),
    name: a.profile?.fullName || people.get(String(a.candidateId))?.name || "Candidate",
    avatar: people.get(String(a.candidateId))?.avatar,
    matchScore: a.matchScore,
    source: a.source,
    stageId: a.stageId,
    status: a.status,
    tags: a.tags || [],
    skills: (a.matchedSkills || []).slice(0, 2),
    context: lines.get(String(a._id)) || "",
    isNew: !a.reviewedAt,
    appliedAt: a.appliedAt,
  });

  const active = apps.filter((a) => a.status === "active" || a.status === "hired");
  res.json({
    success: true,
    columns: job.stages.map((s) => ({
      stage: s,
      applications: active.filter((a) => a.stageId === s.id).map(card),
    })),
    outcomes: {
      rejected: apps.filter((a) => a.status === "rejected").length,
      withdrawn: apps.filter((a) => a.status === "withdrawn").length,
    },
    tags: [...new Set(apps.flatMap((a) => a.tags || []))].sort(),
    total: apps.length,
  });
});

// ── Applications (A10) ───────────────────────────────────────────────────

function applicationFilter(orgId: string, query: Request["query"], userId: string): Record<string, any> {
  const filter: Record<string, any> = { orgId: new Types.ObjectId(orgId), isDraft: false };
  if (jobs.isObjectId(String(query.jobId || ""))) filter.jobId = new Types.ObjectId(String(query.jobId));
  if (query.stage && (STAGE_CATEGORIES as readonly string[]).includes(String(query.stage))) {
    filter.stageCategory = String(query.stage);
  }
  const status = String(query.status || "active");
  if (status !== "all") filter.status = status;
  if (query.source && (APPLICATION_SOURCES as readonly string[]).includes(String(query.source))) {
    filter.source = String(query.source);
  }
  const minMatch = Number(query.minMatch || 0);
  if (minMatch > 0) filter.matchScore = { $gte: minMatch };
  const days = Number(query.appliedWithin || 0);
  if (days > 0) filter.appliedAt = { $gte: new Date(Date.now() - days * 86400000) };
  if (query.tag) filter.tags = String(query.tag);
  const q = String(query.q || "").trim();
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [
      { "profile.fullName": rx },
      { "profile.email": rx },
      { matchedSkills: rx },
      { tags: rx },
      { reference: rx },
    ];
  }
  switch (String(query.view || "all")) {
    case "new":
      filter.reviewedAt = null;
      break;
    case "needs_review":
      filter.stageCategory = "applied";
      filter.status = "active";
      break;
    case "referred":
      filter["referral.referrerId"] = { $exists: true };
      break;
    case "starred":
      filter.starred = true;
      break;
  }
  void userId;
  return filter;
}

async function applicationRows(apps: any[]) {
  const [people, jobDocs] = await Promise.all([
    peopleById([...apps.map((a) => a.candidateId), ...apps.map((a) => a.referral?.referrerId)]),
    JobPosting.find({ _id: { $in: [...new Set(apps.map((a) => String(a.jobId)))] } })
      .select("title stages")
      .lean<any[]>(),
  ]);
  const jobById = new Map(jobDocs.map((j) => [String(j._id), j]));
  const lines = await contextLines(apps);
  return apps.map((a) => {
    const job = jobById.get(String(a.jobId));
    const stage = job?.stages?.find((s: any) => s.id === a.stageId);
    const candidate = people.get(String(a.candidateId));
    const referrer = a.referral ? people.get(String(a.referral.referrerId)) : undefined;
    return {
      _id: String(a._id),
      reference: a.reference,
      candidate: {
        _id: String(a.candidateId),
        name: a.profile?.fullName || candidate?.name || "Candidate",
        email: a.profile?.email || candidate?.email,
        avatar: candidate?.avatar,
      },
      job: { _id: String(a.jobId), title: job?.title || "Deleted job" },
      stage: stage ? { id: stage.id, name: stage.name, category: stage.category } : { id: a.stageId, name: a.stageCategory, category: a.stageCategory },
      status: a.status,
      matchScore: a.matchScore,
      source: a.source,
      referral: a.referral
        ? { affiliateId: a.referral.affiliateId, name: referrer?.name || "Affiliate" }
        : null,
      appliedAt: a.appliedAt,
      lastActivity: a.lastActivity || lines.get(String(a._id)) || "",
      lastActivityAt: a.lastActivityAt,
      starred: !!a.starred,
      tags: a.tags || [],
      isNew: !a.reviewedAt,
    };
  });
}

router.get("/applications/export", guard, async (req: Request, res: Response) => {
  const { orgId, userId } = ctx(res);
  const filter = applicationFilter(orgId, req.query, userId);
  if (typeof req.query.ids === "string" && req.query.ids) {
    filter._id = { $in: req.query.ids.split(",").filter(jobs.isObjectId).map((i) => new Types.ObjectId(i)) };
  }
  const apps = await JobApplication.find(filter).sort({ appliedAt: -1 }).limit(5000).lean<any[]>();
  const rows = await applicationRows(apps);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Reference", "Candidate", "Email", "Job", "Stage", "Status", "Match", "Source", "Referral", "Applied", "Last activity"];
  const lines = rows.map((r) =>
    [
      r.reference,
      r.candidate.name,
      r.candidate.email,
      r.job.title,
      r.stage.name,
      r.status,
      r.matchScore,
      sourceLabel(r.source),
      r.referral ? `${r.referral.name} (${r.referral.affiliateId})` : "",
      r.appliedAt ? new Date(r.appliedAt).toISOString().slice(0, 10) : "",
      r.lastActivity,
    ]
      .map(esc)
      .join(",")
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header.join(","), ...lines].join("\n"));
});

router.get("/applications", guard, async (req: Request, res: Response) => {
  const { orgId, userId } = ctx(res);
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25));
  const filter = applicationFilter(orgId, req.query, userId);
  const sort: Record<string, 1 | -1> =
    req.query.sort === "match" ? { matchScore: -1 } : req.query.sort === "activity" ? { lastActivityAt: -1 } : { appliedAt: -1 };

  const org = new Types.ObjectId(orgId);
  const [apps, total, active, fresh, needsReview, referred, starred, jobList, tags] = await Promise.all([
    JobApplication.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean<any[]>(),
    JobApplication.countDocuments(filter),
    JobApplication.countDocuments({ orgId: org, isDraft: false, status: "active" }),
    JobApplication.countDocuments({ orgId: org, isDraft: false, status: "active", reviewedAt: null }),
    JobApplication.countDocuments({ orgId: org, isDraft: false, status: "active", stageCategory: "applied" }),
    JobApplication.countDocuments({ orgId: org, isDraft: false, "referral.referrerId": { $exists: true } }),
    JobApplication.countDocuments({ orgId: org, isDraft: false, starred: true }),
    JobPosting.find({ orgId, deletedAt: null, status: { $ne: "draft" } }).select("title").sort({ updatedAt: -1 }).lean<any[]>(),
    JobApplication.distinct("tags", { orgId: org, isDraft: false }),
  ]);

  res.json({
    success: true,
    applications: await applicationRows(apps),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts: { active, new: fresh, needsReview, referred, starred },
    jobs: jobList.map((j) => ({ _id: String(j._id), title: j.title })),
    tags: (tags as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
  });
});

const bulkZ = z.object({
  ids: z.array(objectIdZ).min(1).max(500),
  action: z.enum(["move", "reject", "tag", "untag", "star", "unstar", "email"]),
  category: z.enum(STAGE_CATEGORIES).optional(),
  tag: z.string().min(1).max(40).optional(),
  reason: z.string().max(200).optional(),
  subject: z.string().max(300).optional(),
  body: z.string().max(10000).optional(),
});

router.post("/applications/bulk", guard, async (req: Request, res: Response) => {
  const { orgId, userId } = ctx(res);
  const body = parse(bulkZ, req.body, res);
  if (!body) return;
  const apps = await JobApplication.find({
    _id: { $in: body.ids },
    orgId,
    isDraft: false,
  });
  const actor = (await peopleById([userId])).get(userId);
  let done = 0;
  const skipped: string[] = [];

  if (body.action === "tag" || body.action === "untag") {
    if (!body.tag) return bad(res, 400, "tag is required");
    await JobApplication.updateMany(
      { _id: { $in: apps.map((a) => a._id) } },
      body.action === "tag" ? { $addToSet: { tags: body.tag } } : { $pull: { tags: body.tag } }
    );
    return res.json({ success: true, updated: apps.length });
  }
  if (body.action === "star" || body.action === "unstar") {
    await JobApplication.updateMany(
      { _id: { $in: apps.map((a) => a._id) } },
      { $set: { starred: body.action === "star" } }
    );
    return res.json({ success: true, updated: apps.length });
  }

  const jobDocs = await JobPosting.find({ _id: { $in: apps.map((a) => a.jobId) } });
  const jobById = new Map(jobDocs.map((j) => [String(j._id), j]));
  const org = await orgInfo(orgId);

  for (const app of apps) {
    const job = jobById.get(String(app.jobId));
    if (!job) continue;
    if (body.action === "move") {
      if (!body.category || body.category === "hired") {
        return bad(res, 400, "Pick a stage other than Hired (confirm hires one at a time).");
      }
      const stage = jobs.firstStageOfCategory(job, body.category);
      if (!stage || app.status !== "active") {
        skipped.push(String(app._id));
        continue;
      }
      await moveApplication(app, job, stage.id, userId, actor?.name);
      done++;
    } else if (body.action === "reject") {
      if (app.status !== "active") {
        skipped.push(String(app._id));
        continue;
      }
      await rejectApplication(app, job, { reason: body.reason, actorId: userId, actorName: actor?.name, sendEmail: true });
      done++;
    } else if (body.action === "email") {
      if (!body.subject || !body.body) return bad(res, 400, "subject and body are required");
      const to = app.profile?.email || (await User.findById(app.candidateId).select("email").lean<any>())?.email;
      if (!to) {
        skipped.push(String(app._id));
        continue;
      }
      const vars = {
        candidate_name: app.profile?.fullName || "there",
        job_title: job.title,
        company: org.name,
      };
      const from = await senderForOrg(orgId);
      const text = jobs.renderTemplate(body.body, vars);
      await sendMail(to, jobs.renderTemplate(body.subject, vars), `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</div>`, text, from).catch(() => {});
      await jobs.logActivity({ app, type: "email_sent", text: `Email sent: ${body.subject}`, actorId: userId });
      done++;
    }
  }
  res.json({ success: true, updated: done, skipped });
});

async function moveApplication(
  app: IJobApplication,
  job: IJobPosting,
  stageId: string,
  actorId: string,
  actorName?: string
) {
  await jobs.moveApplicationToStage(app, job, stageId, { id: actorId, name: actorName });
}

async function rejectApplication(
  app: IJobApplication,
  job: IJobPosting,
  opts: { reason?: string; note?: string; actorId?: string; actorName?: string; sendEmail: boolean }
) {
  await jobs.rejectApplicationWithEmail(app, job, {
    reason: opts.reason,
    note: opts.note,
    actor: { id: opts.actorId, name: opts.actorName },
    sendEmail: opts.sendEmail,
  });
}

// ── Candidate profile (A12) ──────────────────────────────────────────────

router.get("/applications/:appId", guard, async (req: Request, res: Response) => {
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const job = await JobPosting.findById(app.jobId).lean<any>();
  const [interviews, offers, reward, activity] = await Promise.all([
    JobInterview.find({ applicationId: app._id }).sort({ createdAt: -1 }).lean<any[]>(),
    JobOffer.find({ applicationId: app._id }).sort({ createdAt: -1 }).lean<any[]>(),
    JobReward.findOne({ applicationId: app._id }).lean<any>(),
    JobActivity.find({ applicationId: app._id }).sort({ createdAt: -1 }).limit(300).lean<any[]>(),
  ]);
  const people = await peopleById([
    app.candidateId,
    app.referral?.referrerId,
    ...interviews.flatMap((i) => [...(i.interviewerIds || []), ...(i.scorecards || []).map((s: any) => s.interviewerId)]),
    ...activity.map((a) => a.actorId),
  ]);
  const candidateUser = await User.findById(app.candidateId).select("name email phone profilePicture designation city").lean<any>();

  if (!app.reviewedAt) {
    await JobApplication.updateOne({ _id: app._id }, { $set: { reviewedAt: new Date() } });
  }

  res.json({
    success: true,
    application: app,
    candidate: {
      _id: String(app.candidateId),
      name: app.profile?.fullName || candidateUser?.name || "Candidate",
      email: app.profile?.email || candidateUser?.email,
      phone: app.profile?.phone || candidateUser?.phone,
      avatar: candidateUser?.profilePicture,
      title: app.profile?.title || candidateUser?.designation,
      company: app.profile?.company,
      location: app.profile?.location || candidateUser?.city,
    },
    referral: app.referral
      ? {
          affiliateId: app.referral.affiliateId,
          name: people.get(String(app.referral.referrerId))?.name || "Affiliate",
          userId: String(app.referral.referrerId),
        }
      : null,
    job: job
      ? {
          _id: String(job._id),
          title: job.title,
          stages: job.stages,
          form: job.form,
          reward: { enabled: job.reward?.enabled, amount: job.reward?.amount, guaranteeDays: job.reward?.guaranteeDays },
          skills: job.skills,
          team: job.team,
        }
      : null,
    interviews: interviews.map((i) => ({
      ...i,
      interviewers: (i.interviewerIds || []).map((id: any) => people.get(String(id))).filter(Boolean),
      scorecards: (i.scorecards || [])
        .filter((s: any) => s.submittedAt)
        .map((s: any) => ({ ...s, interviewer: people.get(String(s.interviewerId)) })),
    })),
    offers,
    reward,
    activity: activity
      .filter((a) => a.type !== "note")
      .map((a) => ({ ...a, actor: a.actorId ? people.get(String(a.actorId)) : null })),
    notes: activity
      .filter((a) => a.type === "note")
      .map((a) => ({ ...a, actor: a.actorId ? people.get(String(a.actorId)) : null })),
  });
});

router.patch("/applications/:appId", guard, async (req: Request, res: Response) => {
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(
    z.object({ tags: z.array(z.string().min(1).max(40)).max(20), starred: z.boolean() }).partial(),
    req.body,
    res
  );
  if (!body) return;
  if (body.tags) app.tags = [...new Set(body.tags)];
  if (body.starred !== undefined) app.starred = body.starred;
  await app.save();
  res.json({ success: true, application: app });
});

router.post("/applications/:appId/move", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(
    z.object({ stageId: shortId, note: z.string().max(4000).optional(), notifyTeam: z.boolean().optional() }),
    req.body,
    res
  );
  if (!body) return;
  if (app.status !== "active") return bad(res, 409, `This candidate is ${app.status}.`);
  const job = await JobPosting.findById(app.jobId);
  if (!job) return bad(res, 404, "Job not found");
  const stage = jobs.stageById(job, body.stageId);
  if (!stage) return bad(res, 400, "Stage not found");
  if (stage.category === "hired") return bad(res, 400, "Use Mark as hired to confirm the joining date.");
  const actor = (await peopleById([userId])).get(userId);
  await moveApplication(app, job, stage.id, userId, actor?.name);
  if (body.note?.trim()) {
    await jobs.logActivity({ app, type: "note", text: body.note.trim(), actorId: userId, touch: false });
  }
  if (body.notifyTeam) {
    await jobs.notifyUsersByEmail(
      String(job.orgId),
      job.team.map((t) => String(t.userId)).filter((id) => id !== userId),
      `${app.profile?.fullName || "A candidate"} moved to ${stage.name}`,
      `${actor?.name || "A teammate"} moved ${app.profile?.fullName || "a candidate"} to ${stage.name} for ${job.title}.${body.note ? `\n\nNote: ${body.note}` : ""}`
    );
  }
  res.json({ success: true, application: await JobApplication.findById(app._id) });
});

router.post("/applications/:appId/reject", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(
    z.object({ reason: z.string().max(200).optional(), note: z.string().max(4000).optional(), sendEmail: z.boolean().default(true) }),
    req.body || {},
    res
  );
  if (!body) return;
  if (app.status !== "active") return bad(res, 409, `This candidate is ${app.status}.`);
  const job = await JobPosting.findById(app.jobId);
  if (!job) return bad(res, 404, "Job not found");
  const actor = (await peopleById([userId])).get(userId);
  await rejectApplication(app, job, { ...body, actorId: userId, actorName: actor?.name });
  res.json({ success: true, application: await JobApplication.findById(app._id) });
});

router.post("/applications/:appId/restore", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  if (app.status !== "rejected") return bad(res, 409, "Only rejected candidates can be restored.");
  app.status = "active";
  app.rejection = undefined;
  await app.save();
  await jobs.logActivity({ app, type: "stage_moved", text: "Restored to the pipeline", actorId: userId });
  res.json({ success: true, application: app });
});

router.post("/applications/:appId/notes", guard, async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(
    z.object({ text: z.string().min(1).max(4000), mentions: z.array(objectIdZ).max(20).default([]) }),
    req.body,
    res
  );
  if (!body) return;
  await jobs.logActivity({ app, type: "note", text: body.text.trim(), actorId: userId, mentions: body.mentions, touch: false });
  if (body.mentions.length) {
    const job = await JobPosting.findById(app.jobId).select("title").lean<any>();
    const actor = (await peopleById([userId])).get(userId);
    await jobs.notifyUsersByEmail(
      orgId,
      body.mentions.filter((m) => m !== userId),
      `${actor?.name || "A teammate"} mentioned you on ${app.profile?.fullName || "a candidate"}`,
      `${actor?.name || "A teammate"} wrote on ${app.profile?.fullName || "a candidate"} (${job?.title || "a job"}):\n\n${body.text}`
    );
  }
  const notes = await JobActivity.find({ applicationId: app._id, type: "note" }).sort({ createdAt: -1 }).lean<any[]>();
  const people = await peopleById(notes.map((n) => n.actorId));
  res.json({ success: true, notes: notes.map((n) => ({ ...n, actor: people.get(String(n.actorId)) })) });
});

// ── Interviews & scorecards (A13) ────────────────────────────────────────

const interviewZ = z.object({
  stageId: z.string().max(40).optional(),
  interviewerIds: z.array(objectIdZ).min(1).max(10),
  mode: z.enum(INTERVIEW_MODES),
  durationMin: z.number().int().min(5).max(480),
  slots: z.array(isoZ).min(1).max(6),
  candidatePicks: z.boolean().default(false),
  location: z.string().max(300).optional(),
  message: z.string().max(4000).optional(),
  timezone: z.string().max(60).optional(),
});

router.post("/applications/:appId/interviews", guard, async (req: Request, res: Response) => {
  const { userId, orgId, email } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(interviewZ, req.body, res);
  if (!body) return;
  if (app.status !== "active") return bad(res, 409, `This candidate is ${app.status}.`);
  const job = await JobPosting.findById(app.jobId);
  if (!job) return bad(res, 404, "Job not found");
  const stage =
    (body.stageId && jobs.stageById(job, body.stageId)) ||
    (app.stageCategory === "interview" ? jobs.stageById(job, app.stageId) : jobs.firstStageOfCategory(job, "interview"));
  const slots = body.slots.map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  if (slots.some((s) => s <= now)) return bad(res, 400, "Interview times must be in the future.");

  // One live interview per round. Without this every click minted another
  // meeting, and the candidate (who is shown the round's interviews) got a
  // stack of links for the same round. An interview that is already over, or
  // slots that have all passed, don't block — that's how a no-show or an
  // unanswered invite gets a new time.
  const sameRound = await JobInterview.find({
    applicationId: app._id,
    stageId: stage?.id || "",
    status: { $in: ["scheduled", "awaiting_candidate"] },
  });
  const live = sameRound.find((iv) =>
    iv.status === "scheduled"
      ? !!iv.scheduledAt && iv.scheduledAt.getTime() + iv.durationMin * 60000 > now.getTime()
      : iv.slots.some((s) => s > now)
  );
  if (live) {
    return bad(
      res,
      409,
      live.status === "scheduled"
        ? `${stage?.name || "This round"} is already scheduled for ${jobs.formatWhen(live.scheduledAt!, live.timezone)}. Cancel it before scheduling another.`
        : `${stage?.name || "This round"} is waiting for the candidate to pick a time. Cancel it before sending new times.`
    );
  }
  // Invites whose times all passed are replaced by this one.
  const stale = sameRound.filter((iv) => iv.status === "awaiting_candidate");
  if (stale.length) {
    await JobInterview.updateMany({ _id: { $in: stale.map((iv) => iv._id) } }, { $set: { status: "cancelled" } });
  }

  const actor = (await peopleById([userId])).get(userId);
  const scheduledAt = body.candidatePicks ? undefined : slots[0];
  const meetingUrl =
    body.mode === "video" && scheduledAt
      ? await jobs.createInterviewMeet({
          orgId,
          hostEmail: email || actor?.email || "",
          title: `${job.title} · ${app.profile?.fullName || "Interview"}`,
          start: scheduledAt,
          durationMin: body.durationMin,
        })
      : undefined;

  const interview = await JobInterview.create({
    orgId,
    jobId: job._id,
    applicationId: app._id,
    candidateId: app.candidateId,
    stageId: stage?.id || "",
    roundLabel: stage?.name || "Interview",
    interviewerIds: body.interviewerIds,
    mode: body.mode,
    durationMin: body.durationMin,
    timezone: body.timezone,
    slots: body.candidatePicks ? slots : [],
    candidatePicks: body.candidatePicks,
    scheduledAt,
    meetingUrl,
    location: body.location,
    message: body.message,
    status: body.candidatePicks ? "awaiting_candidate" : "scheduled",
    createdBy: userId,
  });

  if (stage && stage.id !== app.stageId && jobs.STAGE_RANK[stage.category] >= jobs.STAGE_RANK[app.stageCategory]) {
    await moveApplication(app, job, stage.id, userId, actor?.name);
  }

  const org = await orgInfo(orgId);
  const interviewers = await peopleById(body.interviewerIds);
  const withWho = [...interviewers.values()].map((p) => p.name).join(", ");
  const modeText = body.mode === "video" ? "Video call" : body.mode === "phone" ? "Phone call" : "In person";
  const details = body.candidatePicks
    ? `Please choose one of these times in Garage (${body.durationMin} min · ${modeText}):\n${slots
        .map((s) => `• ${jobs.formatWhen(s, body.timezone)}`)
        .join("\n")}\n\n${jobs.frontendUrl("/workspace")}`
    : `When: ${jobs.formatWhen(scheduledAt!, body.timezone)} (${body.durationMin} min)\nHow: ${modeText}${
        meetingUrl ? `\nJoin: ${meetingUrl}` : ""
      }${body.location ? `\nWhere: ${body.location}` : ""}${withWho ? `\nWith: ${withWho}` : ""}${
        body.message ? `\n\n${body.message}` : ""
      }`;
  await jobs.sendCandidateEmail({
    orgId,
    kind: "interview_invite",
    to: app.profile?.email,
    vars: { candidate_name: app.profile?.fullName || "there", job_title: job.title, company: org.name, interview_details: details },
  });
  await jobs.logActivity({
    app,
    type: "interview_scheduled",
    text: body.candidatePicks
      ? `${stage?.name || "Interview"}: ${slots.length} slots offered to the candidate`
      : `${stage?.name || "Interview"} scheduled for ${jobs.formatWhen(scheduledAt!, body.timezone)}${withWho ? ` with ${withWho}` : ""}`,
    actorId: userId,
    data: { interviewId: String(interview._id) },
  });
  res.status(201).json({ success: true, interview });
});

async function loadInterview(res: Response, id: string) {
  if (!jobs.isObjectId(id)) {
    bad(res, 404, "Interview not found");
    return null;
  }
  const iv = await JobInterview.findOne({ _id: id, orgId: ctx(res).orgId });
  if (!iv) bad(res, 404, "Interview not found");
  return iv;
}

router.get("/interviews/:id", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const iv = await loadInterview(res, String(req.params.id));
  if (!iv) return;
  const [app, job] = await Promise.all([
    JobApplication.findById(iv.applicationId).lean<any>(),
    JobPosting.findById(iv.jobId).select("title skills stages").lean<any>(),
  ]);
  const previous = await JobInterview.find({
    applicationId: iv.applicationId,
    _id: { $ne: iv._id },
    status: { $ne: "cancelled" },
  })
    .sort({ createdAt: 1 })
    .lean<any[]>();
  const mine = iv.scorecards.find((s) => String(s.interviewerId) === userId);
  const iSubmitted = !!mine?.submittedAt;
  const people = await peopleById([
    ...iv.interviewerIds,
    ...iv.scorecards.map((s) => s.interviewerId),
    app?.referral?.referrerId,
  ]);
  res.json({
    success: true,
    interview: {
      ...iv.toObject(),
      interviewers: iv.interviewerIds.map((id) => people.get(String(id))).filter(Boolean),
      scorecards: iSubmitted
        ? iv.scorecards.filter((s) => s.submittedAt).map((s) => ({ ...(s as any).toObject?.() ?? s, interviewer: people.get(String(s.interviewerId)) }))
        : [],
    },
    myScorecard: mine || null,
    othersHidden: !iSubmitted,
    application: app
      ? {
          _id: String(app._id),
          profile: app.profile,
          matchScore: app.matchScore,
          quiz: app.quiz,
          matchedSkills: app.matchedSkills,
          referral: app.referral
            ? { affiliateId: app.referral.affiliateId, name: people.get(String(app.referral.referrerId))?.name }
            : null,
        }
      : null,
    job: job ? { _id: String(job._id), title: job.title, skills: job.skills } : null,
    previousRounds: previous.map((p) => {
      const submitted = (p.scorecards || []).filter((s: any) => s.submittedAt);
      const avg = submitted.length
        ? submitted.reduce(
            (s: number, c: any) => s + (c.ratings?.length ? c.ratings.reduce((x: number, r: any) => x + r.score, 0) / c.ratings.length : 0),
            0
          ) / submitted.length
        : null;
      return { _id: String(p._id), roundLabel: p.roundLabel, status: p.status, average: avg, recommendation: submitted[0]?.recommendation };
    }),
  });
});

router.patch("/interviews/:id", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const iv = await loadInterview(res, String(req.params.id));
  if (!iv) return;
  const body = parse(
    z.object({ status: z.enum(["cancelled", "completed"]).optional(), scheduledAt: isoZ.optional() }),
    req.body,
    res
  );
  if (!body) return;
  if (body.scheduledAt) {
    const when = new Date(body.scheduledAt);
    if (when <= new Date()) return bad(res, 400, "Pick a future time.");
    iv.scheduledAt = when;
    iv.status = "scheduled";
  }
  if (body.status) iv.status = body.status;
  await iv.save();
  if (body.status === "cancelled") await jobs.cancelInterviewMeet(iv.meetingUrl);
  const app = await JobApplication.findById(iv.applicationId);
  if (app && body.status === "cancelled") {
    await jobs.logActivity({ app, type: "interview_cancelled", text: `${iv.roundLabel} cancelled`, actorId: userId });
  }
  res.json({ success: true, interview: iv });
});

router.post("/interviews/:id/scorecard", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const iv = await loadInterview(res, String(req.params.id));
  if (!iv) return;
  const body = parse(
    z.object({
      ratings: z
        .array(z.object({ criterion: z.string().min(1).max(120), score: z.number().int().min(1).max(5), note: z.string().max(2000).optional() }))
        .max(12),
      recommendation: z.enum(RECOMMENDATIONS).optional(),
      privateNote: z.string().max(4000).optional(),
      submit: z.boolean().default(false),
    }),
    req.body,
    res
  );
  if (!body) return;
  if (body.submit && (!body.ratings.length || !body.recommendation)) {
    return bad(res, 400, "Rate at least one criterion and choose a recommendation before submitting.");
  }
  const existing = iv.scorecards.find((s) => String(s.interviewerId) === userId);
  if (existing?.submittedAt) return bad(res, 409, "You already submitted this scorecard.");
  const card = {
    interviewerId: new Types.ObjectId(userId),
    ratings: body.ratings,
    recommendation: body.recommendation,
    privateNote: body.privateNote,
    submittedAt: body.submit ? new Date() : undefined,
  };
  iv.scorecards = [...iv.scorecards.filter((s) => String(s.interviewerId) !== userId), card as any];
  const expected = new Set(iv.interviewerIds.map(String));
  const submittedBy = new Set(iv.scorecards.filter((s) => s.submittedAt).map((s) => String(s.interviewerId)));
  if (
    iv.status === "scheduled" &&
    iv.scheduledAt &&
    iv.scheduledAt <= new Date() &&
    [...expected].every((id) => submittedBy.has(id))
  ) {
    iv.status = "completed";
  }
  await iv.save();
  if (body.submit) {
    const app = await JobApplication.findById(iv.applicationId);
    const actor = (await peopleById([userId])).get(userId);
    if (app) {
      await jobs.logActivity({
        app,
        type: "scorecard_submitted",
        text: `${actor?.name || "An interviewer"} submitted a ${iv.roundLabel} scorecard · ${String(body.recommendation).replace("_", " ")}`,
        actorId: userId,
        data: { interviewId: String(iv._id) },
      });
    }
  }
  res.json({ success: true, interview: iv });
});

// ── Offers & hiring (A14) ────────────────────────────────────────────────

router.post("/applications/:appId/offers", guard, async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(
    z.object({
      role: z.string().min(1).max(160),
      ctc: z.number().min(0),
      currency: z.string().min(3).max(6),
      joiningDate: isoZ.optional(),
      expiresAt: isoZ.optional(),
      letter: z.object({ url: z.string().url(), name: z.string().max(200), size: z.number().optional() }).optional(),
      message: z.string().max(4000).optional(),
    }),
    req.body,
    res
  );
  if (!body) return;
  if (app.status !== "active") return bad(res, 409, `This candidate is ${app.status}.`);
  const job = await JobPosting.findById(app.jobId);
  if (!job) return bad(res, 404, "Job not found");

  await JobOffer.updateMany({ applicationId: app._id, status: "sent" }, { $set: { status: "withdrawn" } });
  const offer = await JobOffer.create({
    orgId,
    jobId: job._id,
    applicationId: app._id,
    candidateId: app.candidateId,
    role: body.role,
    ctc: body.ctc,
    currency: body.currency.toUpperCase(),
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : undefined,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    letter: body.letter,
    message: body.message,
    status: "sent",
    createdBy: userId,
  });

  const actor = (await peopleById([userId])).get(userId);
  const offerStage = jobs.firstStageOfCategory(job, "offer");
  if (offerStage && jobs.STAGE_RANK[app.stageCategory] < jobs.STAGE_RANK.offer) {
    await moveApplication(app, job, offerStage.id, userId, actor?.name);
  }
  const org = await orgInfo(orgId);
  await jobs.sendCandidateEmail({
    orgId,
    kind: "offer",
    to: app.profile?.email,
    vars: {
      candidate_name: app.profile?.fullName || "there",
      job_title: job.title,
      company: org.name,
      offer_link: jobs.frontendUrl("/workspace"),
    },
  });
  await jobs.logActivity({
    app,
    type: "offer_sent",
    text: `Offer sent · ${offer.currency} ${offer.ctc.toLocaleString("en-US")}`,
    actorId: userId,
    data: { offerId: String(offer._id) },
  });
  res.status(201).json({ success: true, offer });
});

router.patch("/offers/:id", guard, async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(res);
  if (!jobs.isObjectId(String(req.params.id))) return bad(res, 404, "Offer not found");
  const offer = await JobOffer.findOne({ _id: req.params.id, orgId });
  if (!offer) return bad(res, 404, "Offer not found");
  const body = parse(z.object({ status: z.literal("withdrawn") }), req.body, res);
  if (!body) return;
  if (offer.status !== "sent") return bad(res, 409, `This offer is ${offer.status}.`);
  offer.status = "withdrawn";
  await offer.save();
  const app = await JobApplication.findById(offer.applicationId);
  if (app) await jobs.logActivity({ app, type: "offer_declined", text: "Offer withdrawn", actorId: userId });
  res.json({ success: true, offer });
});

router.post("/applications/:appId/hire", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(z.object({ joiningDate: isoZ }), req.body, res);
  if (!body) return;
  if (app.status !== "active") return bad(res, 409, `This candidate is ${app.status}.`);
  const job = await JobPosting.findById(app.jobId);
  if (!job) return bad(res, 404, "Job not found");
  const hiredStage = jobs.firstStageOfCategory(job, "hired") || job.stages[job.stages.length - 1];
  const joiningDate = new Date(body.joiningDate);
  const actor = (await peopleById([userId])).get(userId);

  app.status = "hired";
  app.stageId = hiredStage.id;
  app.stageCategory = "hired";
  app.maxStageRank = jobs.STAGE_RANK.hired;
  app.stageEnteredAt = new Date();
  app.hiredAt = new Date();
  app.joiningDate = joiningDate;
  await app.save();

  const reward = await createRewardForHire(job, app, joiningDate, userId);
  await jobs.logActivity({
    app,
    type: "hired",
    text: `Hired${actor?.name ? ` by ${actor.name}` : ""} · joining ${jobs.formatWhen(joiningDate).split(",").slice(0, 2).join(",")}`,
    actorId: userId,
    data: reward ? { rewardId: String(reward._id) } : undefined,
  });

  let filled = false;
  const hires = await JobApplication.countDocuments({ jobId: job._id, status: "hired" });
  if (job.autoCloseOnHires && hires >= job.openings && OPEN_STATUSES.includes(job.status)) {
    await JobPosting.updateOne({ _id: job._id }, { $set: { status: "filled", closedAt: new Date() } });
    await releaseJobHold(job._id, "all openings filled").catch(() => 0);
    filled = true;
  }
  res.json({ success: true, application: app, reward, filled });
});

router.post("/applications/:appId/joining-date", guard, async (req: Request, res: Response) => {
  const { userId } = ctx(res);
  const app = await loadApp(res, String(req.params.appId));
  if (!app) return;
  const body = parse(z.object({ joiningDate: isoZ }), req.body, res);
  if (!body) return;
  if (app.status !== "hired") return bad(res, 409, "Only hired candidates have a joining date.");
  app.joiningDate = new Date(body.joiningDate);
  await app.save();
  await rescheduleReward(app._id, app.joiningDate);
  await jobs.logActivity({ app, type: "hired", text: "Joining date updated", actorId: userId });
  res.json({ success: true, application: app, reward: await JobReward.findOne({ applicationId: app._id }) });
});

// ── Referral payouts (A15) ───────────────────────────────────────────────

router.get("/payouts", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const org = new Types.ObjectId(orgId);
  const tab = String(req.query.status || "all");
  const filter: Record<string, any> = { orgId: org };
  if (tab === "in_guarantee") filter.status = { $in: ["in_guarantee", "processing", "payment_due", "failed"] };
  else if (tab === "paid") filter.status = "paid";
  else if (tab === "refunded") filter.status = { $in: ["cancelled", "refund_due"] };

  const [rewards, sums, holdJobs] = await Promise.all([
    tab === "held" ? Promise.resolve([] as any[]) : JobReward.find(filter).sort({ createdAt: -1 }).limit(500).lean<any[]>(),
    JobReward.aggregate([{ $match: { orgId: org } }, { $group: { _id: "$status", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    JobPosting.find({ orgId, deletedAt: null, "reward.heldAmount": { $gt: 0 } })
      .select("title status openings reward")
      .sort({ updatedAt: -1 })
      .lean<any[]>(),
  ]);
  const sum = (...statuses: string[]) =>
    sums.filter((s: any) => statuses.includes(s._id)).reduce((a: any, s: any) => ({ amount: a.amount + s.amount, count: a.count + s.n }), { amount: 0, count: 0 });

  const apps = await JobApplication.find({ _id: { $in: rewards.map((r) => r.applicationId) } })
    .select("profile")
    .lean<any[]>();
  const appName = new Map(apps.map((a) => [String(a._id), a.profile?.fullName]));
  const jobDocs = await JobPosting.find({ _id: { $in: rewards.map((r) => r.jobId) } }).select("title").lean<any[]>();
  const jobTitle = new Map(jobDocs.map((j) => [String(j._id), j.title]));
  const people = await peopleById([...rewards.map((r) => r.referrerId), ...rewards.map((r) => r.candidateId)]);
  const now = Date.now();

  res.json({
    success: true,
    metrics: {
      held: {
        amount: Math.round(holdJobs.reduce((s, j) => s + (j.reward?.heldAmount || 0), 0) * 100) / 100,
        jobs: holdJobs.length,
      },
      inGuarantee: sum("in_guarantee", "processing", "payment_due", "failed"),
      paid: sum("paid"),
      refunded: sum("cancelled", "refund_due"),
    },
    rewards: rewards.map((r) => {
      const span = new Date(r.guaranteeEndsAt).getTime() - new Date(r.joinedAt).getTime();
      const progress = span > 0 ? Math.min(100, Math.max(0, Math.round(((now - new Date(r.joinedAt).getTime()) / span) * 100))) : 100;
      return {
        _id: String(r._id),
        hire: { name: appName.get(String(r.applicationId)) || people.get(String(r.candidateId))?.name || "Hire", applicationId: String(r.applicationId) },
        job: { _id: String(r.jobId), title: jobTitle.get(String(r.jobId)) || "Job" },
        referrer: { name: people.get(String(r.referrerId))?.name || "Affiliate", affiliateId: people.get(String(r.referrerId))?.affiliateId },
        amount: r.amount,
        funding: r.funding,
        joinedAt: r.joinedAt,
        guaranteeEndsAt: r.guaranteeEndsAt,
        status: r.status,
        progress,
        paidAt: r.paidAt,
        paidAmount: r.paidAmount,
        returnedAmount: r.returnedAmount,
        lastError: r.lastError,
      };
    }),
    holds: holdJobs.map((j) => ({
      jobId: String(j._id),
      title: j.title,
      status: j.status,
      openings: j.openings,
      rewardAmount: j.reward?.amount || 0,
      heldAmount: j.reward?.heldAmount || 0,
    })),
  });
});

router.get("/payouts/:id", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  if (!jobs.isObjectId(String(req.params.id))) return bad(res, 404, "Reward not found");
  const reward = await JobReward.findOne({ _id: req.params.id, orgId }).lean<any>();
  if (!reward) return bad(res, 404, "Reward not found");
  const [app, job, split, preview] = await Promise.all([
    JobApplication.findById(reward.applicationId).select("profile").lean<any>(),
    JobPosting.findById(reward.jobId).select("title").lean<any>(),
    paidRewardSplit(reward.distributionId),
    rewardSplitPreview(reward.amount),
  ]);
  const people = await peopleById([reward.referrerId, split?.direct?.userId]);
  res.json({
    success: true,
    reward: {
      ...reward,
      hire: { name: app?.profile?.fullName || "Hire" },
      job: { title: job?.title || "Job" },
      referrer: people.get(String(reward.referrerId)) || null,
    },
    split: split ? { ...split, directRecipient: split.direct ? people.get(split.direct.userId) || null : null } : null,
    preview,
  });
});

router.post("/payouts/:id/left-early", guard, async (req: Request, res: Response) => {
  const { orgId, userId } = ctx(res);
  if (!jobs.isObjectId(String(req.params.id))) return bad(res, 404, "Reward not found");
  const existing = await JobReward.findOne({ _id: req.params.id, orgId });
  if (!existing) return bad(res, 404, "Reward not found");
  const body = parse(z.object({ reason: z.string().max(300).optional() }), req.body || {}, res);
  if (!body) return;
  const reward = await cancelRewardLeftEarly(String(existing._id), body.reason || "Hire left during the guarantee period");
  if (!reward) return bad(res, 409, `This reward is ${existing.status}.`);
  const app = await JobApplication.findById(existing.applicationId);
  if (app) {
    await jobs.logActivity({
      app,
      type: "left_early",
      text: reward.status === "refund_due" ? "Left early after payout · refund due from referrer" : "Left early · referral reward cancelled",
      actorId: userId,
    });
  }
  res.json({ success: true, reward });
});

// ── Talent pool (A16) ────────────────────────────────────────────────────

router.get("/talent-pool", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const now = new Date();
  const rows = await JobApplication.aggregate([
    {
      $match: {
        orgId: new Types.ObjectId(orgId),
        isDraft: false,
        talentPoolConsent: true,
        $or: [{ consentUntil: { $exists: false } }, { consentUntil: null }, { consentUntil: { $gt: now } }],
      },
    },
    { $sort: { appliedAt: -1 } },
    { $group: { _id: "$candidateId", app: { $first: "$$ROOT" }, applications: { $sum: 1 } } },
    { $limit: 2000 },
  ]);
  const apps = rows.map((r: any) => ({ ...r.app, applications: r.applications }));
  const [people, jobDocs] = await Promise.all([
    peopleById(apps.map((a) => a.candidateId)),
    JobPosting.find({ _id: { $in: apps.map((a) => a.jobId) } }).select("title stages").lean<any[]>(),
  ]);
  const jobById = new Map(jobDocs.map((j) => [String(j._id), j]));

  const q = String(req.query.q || "").trim().toLowerCase();
  const tag = String(req.query.tag || "");
  const minExp = Number(req.query.minExp || 0);
  const maxExp = Number(req.query.maxExp || 0);
  const location = String(req.query.location || "").trim().toLowerCase();
  const withinDays = Number(req.query.appliedWithin || 0);

  const candidates = apps
    .map((a) => {
      const job = jobById.get(String(a.jobId));
      const stage = job?.stages?.find((s: any) => s.id === a.stageId);
      const person = people.get(String(a.candidateId));
      return {
        candidateId: String(a.candidateId),
        applicationId: String(a._id),
        name: a.profile?.fullName || person?.name || "Candidate",
        email: a.profile?.email || person?.email,
        avatar: person?.avatar,
        title: a.profile?.title,
        location: a.profile?.location,
        experienceYears: a.profile?.experienceYears,
        topSkills: (a.matchedSkills || []).slice(0, 3),
        lastJob: { _id: String(a.jobId), title: job?.title || "Deleted job" },
        lastStage: stage?.name || a.stageCategory,
        status: a.status,
        tags: a.tags || [],
        consentUntil: a.consentUntil,
        appliedAt: a.appliedAt,
        applications: a.applications,
      };
    })
    .filter((c) => {
      if (q && ![c.name, c.email, c.title, c.location, ...c.topSkills, ...c.tags].join(" ").toLowerCase().includes(q)) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (minExp && !((c.experienceYears ?? -1) >= minExp)) return false;
      if (maxExp && !((c.experienceYears ?? Infinity) <= maxExp)) return false;
      if (location && !(c.location || "").toLowerCase().includes(location)) return false;
      if (withinDays && !(c.appliedAt && new Date(c.appliedAt).getTime() >= Date.now() - withinDays * 86400000)) return false;
      return true;
    });

  const liveJobs = await JobPosting.find({ orgId, status: "live", deletedAt: null }).select("title").lean<any[]>();
  res.json({
    success: true,
    candidates,
    total: candidates.length,
    tags: [...new Set(apps.flatMap((a) => a.tags || []))].sort(),
    liveJobs: liveJobs.map((j) => ({ _id: String(j._id), title: j.title })),
  });
});

router.post("/talent-pool/invite", guard, async (req: Request, res: Response) => {
  const { orgId, userId } = ctx(res);
  const body = parse(z.object({ candidateIds: z.array(objectIdZ).min(1).max(200), jobId: objectIdZ }), req.body, res);
  if (!body) return;
  const job = await JobPosting.findOne({ _id: body.jobId, orgId, status: "live", deletedAt: null });
  if (!job) return bad(res, 404, "Pick a live job to invite candidates to.");
  const org = await orgInfo(orgId);
  const url = jobs.publicJobUrl(org.slug, job.slug);
  const from = await senderForOrg(orgId);
  let sent = 0;
  for (const candidateId of body.candidateIds) {
    const app = await JobApplication.findOne({ orgId, candidateId, talentPoolConsent: true, isDraft: false }).sort({ appliedAt: -1 });
    if (!app) continue;
    const already = await JobApplication.exists({ jobId: job._id, candidateId });
    if (already) continue;
    const to = app.profile?.email || (await User.findById(candidateId).select("email").lean<any>())?.email;
    if (!to) continue;
    const name = app.profile?.fullName || "there";
    const text = `Hi ${name},\n\n${org.name} thought of you for a new role: ${job.title}.\n\nTake a look and apply here:\n${url}\n\n${org.name}`;
    await sendMail(
      to,
      `${org.name} invites you to apply: ${job.title}`,
      `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</div>`,
      text,
      from
    ).catch(() => {});
    await jobs.logActivity({ app, type: "invited", text: `Invited to apply for ${job.title}`, actorId: userId, touch: false });
    sent++;
  }
  res.json({ success: true, sent });
});

// ── Job analytics (A17) ──────────────────────────────────────────────────

router.get("/jobs/:id/analytics", guard, async (req: Request, res: Response) => {
  const job = await loadJob(res, String(req.params.id));
  if (!job) return;
  const days = Math.min(365, Math.max(7, Number(req.query.days || 30)));
  const since = new Date(Date.now() - days * 86400000);
  since.setUTCHours(0, 0, 0, 0);

  const [viewSeries, appSeries, submitted, drafts, hires, rewards, sourceRows, referrerRows] = await Promise.all([
    JobEvent.aggregate([
      { $match: { jobId: job._id, type: "view", createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]),
    JobApplication.aggregate([
      { $match: { jobId: job._id, isDraft: false, appliedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedAt" } }, n: { $sum: 1 } } },
    ]),
    JobApplication.find({ jobId: job._id, isDraft: false }).select("appliedAt hiredAt source status referral furthestPage").lean<any[]>(),
    JobApplication.find({ jobId: job._id, isDraft: true }).select("furthestPage").lean<any[]>(),
    JobApplication.countDocuments({ jobId: job._id, status: "hired" }),
    JobReward.find({ jobId: job._id, status: { $in: ["in_guarantee", "processing", "paid", "payment_due"] } }).select("amount").lean<any[]>(),
    JobApplication.aggregate([
      { $match: { jobId: job._id, isDraft: false } },
      {
        $group: {
          _id: "$source",
          applicants: { $sum: 1 },
          hires: { $sum: { $cond: [{ $eq: ["$status", "hired"] }, 1, 0] } },
          rewarded: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "hired"] }, { $ifNull: ["$referral.referrerId", false] }] }, 1, 0] } },
        },
      },
    ]),
    JobApplication.aggregate([
      { $match: { jobId: job._id, isDraft: false, "referral.referrerId": { $exists: true } } },
      {
        $group: {
          _id: "$referral.referrerId",
          applicants: { $sum: 1 },
          hires: { $sum: { $cond: [{ $eq: ["$status", "hired"] }, 1, 0] } },
        },
      },
      { $sort: { hires: -1, applicants: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const series: Array<{ date: string; views: number; applications: number }> = [];
  const vMap = new Map(viewSeries.map((r: any) => [r._id, r.n]));
  const aMap = new Map(appSeries.map((r: any) => [r._id, r.n]));
  for (let d = new Date(since); d <= new Date(); d = new Date(d.getTime() + 86400000)) {
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, views: vMap.get(key) || 0, applications: aMap.get(key) || 0 });
  }

  // Drop-off: how many people reached each page (submitted applications reached every page).
  const pages = job.form?.pages || [];
  const reached = pages.map((p, i) => ({
    pageId: p.id,
    title: p.title || `Page ${i + 1}`,
    count: submitted.length + drafts.filter((d) => (d.furthestPage || 0) >= i).length,
  }));
  let worst: { title: string; drop: number } | null = null;
  for (let i = 1; i < reached.length; i++) {
    const prev = reached[i - 1].count;
    const drop = prev > 0 ? (prev - reached[i].count) / prev : 0;
    if (drop > 0 && (!worst || drop > worst.drop)) worst = { title: reached[i].title, drop };
  }

  const hiredApps = submitted.filter((a) => a.status === "hired" && a.hiredAt && a.appliedAt);
  const timeToHire = hiredApps.length
    ? hiredApps.reduce((s, a) => s + (new Date(a.hiredAt).getTime() - new Date(a.appliedAt).getTime()), 0) / hiredApps.length / 86400000
    : null;
  const costPerHire = hires ? rewards.reduce((s, r) => s + r.amount, 0) / hires : null;
  const people = await peopleById(referrerRows.map((r: any) => r._id));
  const views = job.stats?.views || 0;

  res.json({
    success: true,
    totals: {
      views,
      applyStarts: job.stats?.applyStarts || 0,
      applications: submitted.length,
      applyRate: views ? Math.round((submitted.length / views) * 1000) / 10 : null,
      timeToHireDays: timeToHire === null ? null : Math.round(timeToHire),
      costPerHire: costPerHire === null ? null : Math.round(costPerHire * 100) / 100,
      hires,
    },
    series,
    dropoff: { pages: reached, worst: worst ? { title: worst.title, dropPercent: Math.round(worst.drop * 100) } : null },
    sources: sourceRows.map((r: any) => ({ source: r._id, applicants: r.applicants, hires: r.hires, rewarded: r.rewarded })),
    topReferrers: referrerRows.map((r: any) => ({
      userId: String(r._id),
      name: people.get(String(r._id))?.name || "Affiliate",
      avatar: people.get(String(r._id))?.avatar,
      applicants: r.applicants,
      hires: r.hires,
    })),
  });
});

// ── Settings (A18) ───────────────────────────────────────────────────────

router.get("/settings", guard, async (_req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const [settings, org] = await Promise.all([jobs.getJobsSettings(orgId), orgInfo(orgId)]);
  res.json({
    success: true,
    settings,
    org,
    careersUrl: jobs.frontendUrl(`/jobs/${org.slug}`),
    consentMinimum: jobs.consentLabel(org.name),
  });
});

router.put("/settings/careers-page", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(
    z.object({
      coverImage: z.string().url().max(1000).nullable().optional(),
      headline: z.string().max(200).optional(),
      about: z.string().max(4000).optional(),
      culturePhotos: z.array(z.string().url().max(1000)).max(12).optional(),
      perks: z.array(z.string().min(1).max(60)).max(20).optional(),
      showRewards: z.boolean().optional(),
    }),
    req.body,
    res
  );
  if (!body) return;
  const settings = await jobs.getJobsSettings(orgId);
  const cp: any = settings.careersPage;
  if (body.coverImage !== undefined) cp.coverImage = body.coverImage || undefined;
  if (body.headline !== undefined) cp.headline = body.headline;
  if (body.about !== undefined) cp.about = body.about;
  if (body.culturePhotos) cp.culturePhotos = body.culturePhotos;
  if (body.perks) cp.perks = body.perks;
  if (body.showRewards !== undefined) cp.showRewards = body.showRewards;
  settings.markModified("careersPage");
  await settings.save();
  res.json({ success: true, settings });
});

router.put("/settings/email-templates", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(
    z.object({
      templates: z
        .array(
          z.object({
            id: shortId,
            name: z.string().min(1).max(120),
            kind: z.enum(EMAIL_TEMPLATE_KINDS),
            subject: z.string().max(300),
            body: z.string().max(20000),
          })
        )
        .max(50),
    }),
    req.body,
    res
  );
  if (!body) return;
  const settings = await jobs.getJobsSettings(orgId);
  settings.emailTemplates = body.templates as any;
  await settings.save();
  res.json({ success: true, settings });
});

router.put("/settings/rejection-reasons", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(
    z.object({ reasons: z.array(z.object({ id: shortId, label: z.string().min(1).max(120) })).max(50) }),
    req.body,
    res
  );
  if (!body) return;
  const settings = await jobs.getJobsSettings(orgId);
  settings.rejectionReasons = body.reasons;
  await settings.save();
  res.json({ success: true, settings });
});

router.post("/settings/saved-forms", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(z.object({ name: z.string().min(1).max(120), pages: z.array(pageZ).min(1).max(20) }), req.body, res);
  if (!body) return;
  const settings = await jobs.getJobsSettings(orgId);
  settings.savedForms.push({ id: jobs.newId("frm_"), name: body.name, pages: body.pages, createdAt: new Date() } as any);
  settings.markModified("savedForms");
  await settings.save();
  res.status(201).json({ success: true, settings });
});

router.delete("/settings/saved-forms/:formId", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const settings = await jobs.getJobsSettings(orgId);
  settings.savedForms = settings.savedForms.filter((f) => f.id !== req.params.formId);
  settings.markModified("savedForms");
  await settings.save();
  res.json({ success: true, settings });
});

router.put("/settings/default-pipeline", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(
    z.object({
      stages: z.array(z.object({ name: z.string().min(1).max(80), category: z.enum(STAGE_CATEGORIES), ownerId: objectIdZ.optional().nullable() })).max(15),
    }),
    req.body,
    res
  );
  if (!body) return;
  if (body.stages.length && (body.stages[0].category !== "applied" || body.stages[body.stages.length - 1].category !== "hired")) {
    return bad(res, 400, "The pipeline must start with Applied and end with Hired.");
  }
  const settings = await jobs.getJobsSettings(orgId);
  settings.defaultPipeline = { stages: body.stages };
  settings.markModified("defaultPipeline");
  await settings.save();
  res.json({ success: true, settings });
});

router.put("/settings/privacy", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(
    z.object({
      retentionMonths: z.number().int().min(1).max(120),
      allowDeletionRequests: z.boolean(),
      consentAddition: z.string().max(4000),
    }),
    req.body,
    res
  );
  if (!body) return;
  const settings = await jobs.getJobsSettings(orgId);
  settings.privacy = body;
  await settings.save();
  res.json({ success: true, settings });
});

// ── Reward preview & AI ──────────────────────────────────────────────────

router.get("/reward-preview", guard, async (req: Request, res: Response) => {
  const amount = Math.max(0, Math.min(100000, Number(req.query.amount || 0)));
  const preview = await rewardSplitPreview(amount);
  if (!preview) return bad(res, 503, "The commission plan is not available right now.");
  res.json({ success: true, preview });
});

router.post("/ai/description", guard, async (req: Request, res: Response) => {
  const { orgId } = ctx(res);
  const body = parse(
    z.object({
      title: z.string().min(1).max(160),
      department: z.string().max(80).optional(),
      seniority: z.string().max(80).optional(),
      tone: z.enum(["professional", "friendly", "bold"]).default("professional"),
      notes: z.string().max(2000).optional(),
      skills: z.array(z.string().max(60)).max(30).default([]),
      workplace: z.string().max(40).optional(),
      locations: z.array(z.string().max(120)).max(20).default([]),
      employmentType: z.string().max(40).optional(),
    }),
    req.body,
    res
  );
  if (!body) return;
  if (!env.OPENAI_API_KEY) return bad(res, 503, "AI writing is not configured on the server.");
  const org = await orgInfo(orgId);
  const prompt = `Write a job description for "${body.title}" at ${org.name}.
Department: ${body.department || "not specified"}. Seniority: ${body.seniority || "not specified"}.
Employment: ${body.employmentType || "not specified"}. Workplace: ${body.workplace || "not specified"}. Locations: ${body.locations.join(", ") || "not specified"}.
Skills: ${body.skills.join(", ") || "not specified"}.
Tone: ${body.tone}. Extra notes from the founder: ${body.notes || "none"}.
Return JSON with keys aboutRole (2-3 sentences), responsibilities (4-6 bullet points), requirements (4-6 bullet points), niceToHave (2-3 bullet points), offer (3-5 bullet points), suggestedSkills (up to 6 short skill names not already listed).
Each bullet list is an array of short strings. Do not invent salary figures, benefits amounts or facts about the company that weren't given.`;
  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const c = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const parsed = JSON.parse(c.choices[0]?.message?.content || "{}");
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 10) : []);
    const html = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${i.replace(/</g, "&lt;")}</li>`).join("")}</ul>` : "");
    res.json({
      success: true,
      draft: {
        aboutRole: `<p>${String(parsed.aboutRole || "").replace(/</g, "&lt;")}</p>`,
        responsibilities: html(list(parsed.responsibilities)),
        requirements: html(list(parsed.requirements)),
        niceToHave: html(list(parsed.niceToHave)),
        offer: html(list(parsed.offer)),
      },
      suggestedSkills: list(parsed.suggestedSkills).slice(0, 6),
    });
  } catch (err: any) {
    console.error("[jobs] AI description failed:", err?.message);
    return bad(res, 502, "Couldn't generate a draft right now. Try again in a moment.");
  }
});

export default router;
