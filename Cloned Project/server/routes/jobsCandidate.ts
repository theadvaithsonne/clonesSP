// src/routes/jobsCandidate.ts
//
// Candidate + public API for Garage Jobs, mounted at /jobs (after
// /jobs/founder, so the founder router never falls through to these routes).
//
//   /jobs/public/*   no login — careers pages, public job pages, view tracking
//   /jobs/*          signed-in members — discover, apply, my applications
//
// Candidates only ever see their own applications, and only the coarse stage
// category — never the office's stage names, notes, scores or match score.
// Guards are attached per route because this router shares the /jobs prefix.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, softAuth, AuthUser } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { JobPosting, IJobPosting, EMPLOYMENT_TYPES, WORKPLACE_TYPES } from "../models/jobPosting.model";
import { SavedJob } from "../models/savedJob.model";
import { JobAlert, ALERT_FREQUENCIES } from "../models/jobAlert.model";
import { JobApplication, IJobAnswer } from "../models/jobApplication.model";
import { JobInterview } from "../models/jobInterview.model";
import { JobOffer } from "../models/jobOffer.model";
import { JobEvent } from "../models/jobEvent.model";
import * as jobs from "../services/jobs";
import { rewardSplitPreview } from "../services/jobRewards";
import { setReferredByAffiliateId } from "../services/affiliate";
import {
  buildJobSearchFilter,
  criteriaFromQuery,
  normalizeCriteria,
  summarizeCriteria,
  LIVE_HQ_FILTER,
} from "../services/jobSearch";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────

function bad(res: Response, status: number, error: string, extra?: Record<string, any>) {
  return res.status(status).json({ success: false, error, ...(extra || {}) });
}

function me(req: Request): AuthUser {
  return (req as any).user as AuthUser;
}

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const r = schema.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    bad(res, 400, `${issue.path.join(".") || "body"}: ${issue.message}`);
    return null;
  }
  return r.data;
}

async function orgBySlug(slug: string) {
  const bySlug = await Organization.findOne({ slug }).select("name slug icon city country description").lean<any>();
  if (bySlug) return bySlug;
  if (jobs.isObjectId(slug)) {
    return Organization.findById(slug).select("name slug icon city country description").lean<any>();
  }
  return null;
}

async function orgsById(ids: Array<string | Types.ObjectId>) {
  const unique = [...new Set(ids.map(String))].filter(jobs.isObjectId);
  const orgs = await Organization.find({ _id: { $in: unique } }).select("name slug icon city country").lean<any[]>();
  return new Map(orgs.map((o) => [String(o._id), o]));
}

const CLOSED = ["closed", "filled", "expired"];

/** What a job card / job page shows to candidates. No hiring internals. */
function publicJob(job: any, org: any, extra: Record<string, any> = {}) {
  return {
    _id: String(job._id),
    slug: job.slug,
    title: job.title,
    department: job.department,
    status: job.status,
    isOpen: job.status === "live",
    employmentType: job.employmentType,
    workplace: job.workplace,
    officeDays: job.officeDays,
    locations: job.locations || [],
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    joining: job.joining,
    salary: job.salary?.show
      ? { currency: job.salary.currency, min: job.salary.min, max: job.salary.max, period: job.salary.period }
      : null,
    skills: job.skills || [],
    publishedAt: job.publishedAt,
    closesAt: job.closesAt,
    closedAt: job.closedAt,
    org: org
      ? {
          _id: String(org._id),
          name: org.name,
          slug: org.slug || String(org._id),
          icon: org.icon,
          city: org.city,
          country: org.country,
          description: org.description,
        }
      : null,
    reward: job.reward?.enabled && job.reward.amount > 0 ? { amount: job.reward.amount, guaranteeDays: job.reward.guaranteeDays } : null,
    ...extra,
  };
}

function jobDetail(job: any) {
  return {
    description: job.description,
    education: job.education,
    perks: job.perks || [],
    /** Candidates see the process as stage categories, not the office's stage names. */
    process: [...new Set((job.stages || []).map((s: any) => s.category))].filter((c) => c !== "hired"),
    formPages: (job.form?.pages || []).length,
    estimatedMinutes: Math.max(
      3,
      Math.round(
        (job.form?.pages || []).reduce(
          (s: number, p: any) => s + (p.timeLimitMinutes || 0) + (p.fields || []).length * 0.6,
          0
        )
      )
    ),
  };
}

async function applicantCount(jobId: Types.ObjectId | string) {
  return JobApplication.countDocuments({ jobId, isDraft: false });
}

// ── Public (no login) ────────────────────────────────────────────────────

/** Careers page: office profile + its open roles. */
router.get("/public/org/:orgSlug", async (req: Request, res: Response) => {
  const org = await orgBySlug(String(req.params.orgSlug));
  if (!org) return bad(res, 404, "Careers page not found");
  const [settings, open] = await Promise.all([
    jobs.readJobsSettings(String(org._id)),
    JobPosting.find({ orgId: org._id, status: "live", "channels.publicLink": true, deletedAt: null })
      .sort({ publishedAt: -1 })
      .lean<any[]>(),
  ]);
  const cp = settings.careersPage;
  res.json({
    success: true,
    org: { _id: String(org._id), name: org.name, slug: org.slug || String(org._id), icon: org.icon, city: org.city, country: org.country, description: org.description },
    careersPage: {
      coverImage: cp.coverImage,
      headline: cp.headline,
      about: cp.about,
      culturePhotos: cp.culturePhotos,
      perks: cp.perks,
    },
    jobs: open.map((j) => publicJob(j, org)).map((j) => (cp.showRewards ? j : { ...j, reward: null })),
  });
});

/** Public job page. `?ref=` resolves the referrer's name for "Referred by". */
router.get("/public/job/:orgSlug/:jobSlug", softAuth, async (req: Request, res: Response) => {
  const org = await orgBySlug(String(req.params.orgSlug));
  if (!org) return bad(res, 404, "Job not found");
  const job = await JobPosting.findOne({
    orgId: org._id,
    slug: String(req.params.jobSlug),
    deletedAt: null,
    status: { $in: ["live", ...CLOSED] },
  }).lean<any>();
  if (!job || !job.channels?.publicLink) return bad(res, 404, "Job not found");
  const settings = await jobs.readJobsSettings(String(org._id));
  const ref = String(req.query.ref || "").trim();
  const referrer = ref ? await User.findOne({ affiliateId: ref }).select("name profilePicture").lean<any>() : null;
  res.json({
    success: true,
    job: publicJob(job, org, {
      ...jobDetail(job),
      applicants: await applicantCount(job._id),
      reward: settings.careersPage.showRewards && job.reward?.enabled ? { amount: job.reward.amount, guaranteeDays: job.reward.guaranteeDays } : null,
    }),
    referrer: referrer ? { name: referrer.name, avatar: referrer.profilePicture, affiliateId: ref } : null,
  });
});

/** Count a view (job analytics). Best-effort and unauthenticated. */
router.post("/public/job/:jobId/view", softAuth, async (req: Request, res: Response) => {
  const id = String(req.params.jobId);
  if (!jobs.isObjectId(id)) return res.json({ success: true });
  const job = await JobPosting.findOne({ _id: id, status: "live", deletedAt: null }).select("orgId").lean<any>();
  if (!job) return res.json({ success: true });
  const source = String((req.body || {}).source || "").slice(0, 40) || undefined;
  const userId = me(req)?.userId;
  await Promise.all([
    JobPosting.updateOne({ _id: job._id }, { $inc: { "stats.views": 1 } }),
    JobEvent.create({ orgId: job.orgId, jobId: job._id, type: "view", userId: jobs.isObjectId(userId) ? userId : undefined, source }),
  ]).catch(() => {});
  res.json({ success: true });
});

// ── Discover (B1) ────────────────────────────────────────────────────────

router.get("/discover", requireAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
  // Same matching as job alerts (services/jobSearch.ts).
  const filter = await buildJobSearchFilter(criteriaFromQuery(req.query as Record<string, unknown>));

  const [rows, total, departments] = await Promise.all([
    JobPosting.find(filter)
      .sort(req.query.sort === "reward" ? { "reward.amount": -1, publishedAt: -1 } : { publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<any[]>(),
    JobPosting.countDocuments(filter),
    JobPosting.distinct("department", { ...LIVE_HQ_FILTER }),
  ]);
  const orgs = await orgsById(rows.map((r) => r.orgId));
  const ids = rows.map((r) => r._id);
  const [mine, saved] = await Promise.all([
    JobApplication.find({ candidateId: me(req).userId, jobId: { $in: ids } })
      .select("jobId isDraft status")
      .lean<any[]>(),
    SavedJob.find({ userId: me(req).userId, jobId: { $in: ids } }).select("jobId").lean<any[]>(),
  ]);
  const mineByJob = new Map(mine.map((a) => [String(a.jobId), a]));
  const savedIds = new Set(saved.map((s) => String(s.jobId)));
  res.json({
    success: true,
    jobs: rows.map((j) =>
      publicJob(j, orgs.get(String(j.orgId)), {
        myApplication: mineByJob.get(String(j._id))
          ? { isDraft: mineByJob.get(String(j._id)).isDraft, status: mineByJob.get(String(j._id)).status }
          : null,
        saved: savedIds.has(String(j._id)),
      })
    ),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    departments: (departments as string[]).filter(Boolean).sort(),
  });
});

/** Job page for signed-in members (B2), including the referral card. */
router.get("/view/:jobId", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.jobId);
  if (!jobs.isObjectId(id)) return bad(res, 404, "Job not found");
  const job = await JobPosting.findOne({ _id: id, deletedAt: null, status: { $in: ["live", ...CLOSED] } }).lean<any>();
  if (!job) return bad(res, 404, "Job not found");
  const [org, applicants, mine, user, preview] = await Promise.all([
    Organization.findById(job.orgId).select("name slug icon city country description").lean<any>(),
    applicantCount(job._id),
    JobApplication.findOne({ jobId: job._id, candidateId: me(req).userId }).select("isDraft status stageCategory reference").lean<any>(),
    User.findById(me(req).userId).select("affiliateId").lean<any>(),
    job.reward?.enabled && job.reward.amount > 0 ? rewardSplitPreview(job.reward.amount) : Promise.resolve(null),
  ]);
  const orgSlug = org?.slug || String(job.orgId);
  res.json({
    success: true,
    job: publicJob(job, org, { ...jobDetail(job), applicants, aboutCompany: org?.description }),
    myApplication: mine,
    referral:
      job.status === "live" && preview && user?.affiliateId
        ? {
            earn: preview.directAmount,
            guaranteeDays: job.reward.guaranteeDays,
            link: `${jobs.publicJobUrl(orgSlug, job.slug)}?ref=${encodeURIComponent(user.affiliateId)}`,
            affiliateId: user.affiliateId,
          }
        : null,
    publicUrl: job.channels?.publicLink ? jobs.publicJobUrl(orgSlug, job.slug) : null,
  });
});

// ── Apply (B3) ───────────────────────────────────────────────────────────

const answerZ = z.object({
  fieldId: z.string().min(1).max(40),
  value: z
    .union([z.string().max(20000), z.number(), z.boolean(), z.array(z.string().max(500)).max(50), z.null()])
    .optional(),
  files: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        name: z.string().max(300),
        size: z.number().min(0).optional(),
        type: z.string().max(120).optional(),
      })
    )
    .max(10)
    .default([]),
});

const applyZ = z.object({
  answers: z.array(answerZ).max(300),
  page: z.number().int().min(0).max(50).optional(),
  ref: z.string().max(60).optional(),
  source: z.enum(["garage_hq", "university", "public_link", "careers_page", "talent_pool"]).optional(),
});

/** Keep only answers to fields that exist on this job's form. */
function cleanAnswers(job: IJobPosting, answers: z.infer<typeof answerZ>[]): IJobAnswer[] {
  const known = new Set(jobs.allFields(job).map((f) => f.id));
  const seen = new Set<string>();
  const out: IJobAnswer[] = [];
  for (const a of answers) {
    if (!known.has(a.fieldId) || seen.has(a.fieldId)) continue;
    seen.add(a.fieldId);
    out.push({ fieldId: a.fieldId, value: a.value ?? undefined, files: a.files || [] });
  }
  return out;
}

async function loadLiveJob(res: Response, id: string): Promise<IJobPosting | null> {
  if (!jobs.isObjectId(id)) {
    bad(res, 404, "Job not found");
    return null;
  }
  const job = await JobPosting.findOne({ _id: id, deletedAt: null });
  if (!job) {
    bad(res, 404, "Job not found");
    return null;
  }
  if (job.status !== "live") {
    bad(res, 410, "This job is no longer accepting applications.", { status: job.status });
    return null;
  }
  return job;
}

/** The form to fill in, the candidate's profile prefill, and any saved draft. */
router.get("/apply/:jobId", requireAuth, async (req: Request, res: Response) => {
  const job = await loadLiveJob(res, String(req.params.jobId));
  if (!job) return;
  const userId = me(req).userId;
  const [user, org, existing, settings] = await Promise.all([
    User.findById(userId).select("name email phone city designation profilePicture").lean<any>(),
    Organization.findById(job.orgId).select("name slug icon city").lean<any>(),
    JobApplication.findOne({ jobId: job._id, candidateId: userId }).lean<any>(),
    jobs.readJobsSettings(String(job.orgId)),
  ]);
  if (existing && !existing.isDraft) {
    return bad(res, 409, "You've already applied for this job.", { applicationId: String(existing._id) });
  }
  res.json({
    success: true,
    job: publicJob(job.toObject(), org, { form: job.form }),
    prefill: {
      profile_full_name: user?.name || "",
      profile_email: user?.email || "",
      profile_phone: user?.phone || "",
      profile_location: user?.city || "",
      title: user?.designation || "",
    },
    draft: existing
      ? { _id: String(existing._id), answers: existing.answers, furthestPage: existing.furthestPage }
      : null,
    consent: {
      minimum: jobs.consentLabel(org?.name || ""),
      addition: settings.privacy?.consentAddition || "",
    },
  });
});

/** Save and finish later. The first save counts as an "apply start". */
router.put("/apply/:jobId/draft", requireAuth, async (req: Request, res: Response) => {
  const job = await loadLiveJob(res, String(req.params.jobId));
  if (!job) return;
  const body = parse(applyZ, req.body, res);
  if (!body) return;
  const userId = me(req).userId;
  const existing = await JobApplication.findOne({ jobId: job._id, candidateId: userId });
  if (existing && !existing.isDraft) return bad(res, 409, "You've already applied for this job.");
  const answers = cleanAnswers(job, body.answers);
  const furthest = Math.max(existing?.furthestPage || 0, body.page || 0);

  if (existing) {
    existing.answers = answers as any;
    existing.furthestPage = furthest;
    existing.lastActivityAt = new Date();
    await existing.save();
    return res.json({ success: true, draftId: String(existing._id) });
  }

  const org = await Organization.findById(job.orgId).select("name").lean<any>();
  try {
    const draft = await JobApplication.create({
      jobId: job._id,
      orgId: job.orgId,
      candidateId: userId,
      reference: jobs.applicationReference(org?.name || ""),
      isDraft: true,
      furthestPage: furthest,
      stageId: jobs.firstStage(job)?.id || "",
      stageCategory: "applied",
      answers,
      source: body.source || "garage_hq",
    });
    await Promise.all([
      JobPosting.updateOne({ _id: job._id }, { $inc: { "stats.applyStarts": 1 } }),
      JobEvent.create({ orgId: job.orgId, jobId: job._id, type: "apply_start", userId, source: body.source }),
    ]).catch(() => {});
    res.status(201).json({ success: true, draftId: String(draft._id) });
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 409, "Your draft was saved in another tab — reload to continue.");
    throw err;
  }
});

/** Submit the application: validate, knockouts, quiz, match score, referral. */
router.post("/apply/:jobId/submit", requireAuth, async (req: Request, res: Response) => {
  const job = await loadLiveJob(res, String(req.params.jobId));
  if (!job) return;
  const body = parse(applyZ, req.body, res);
  if (!body) return;
  const userId = me(req).userId;

  const existing = await JobApplication.findOne({ jobId: job._id, candidateId: userId });
  if (existing && !existing.isDraft) return bad(res, 409, "You've already applied for this job.");

  const answers = jobs.pruneHiddenAnswers(job, cleanAnswers(job, body.answers));
  const map = jobs.toAnswerMap(answers);
  const errors = jobs.validateAnswers(job, map);
  if (Object.keys(errors).length) {
    return bad(res, 422, "Some answers need attention.", { errors });
  }

  const [user, org, settings] = await Promise.all([
    User.findById(userId).select("name email phone city designation affiliateId").lean<any>(),
    Organization.findById(job.orgId).select("name").lean<any>(),
    jobs.readJobsSettings(String(job.orgId)),
  ]);

  const quiz = jobs.scoreQuiz(job, map);
  const knockout = jobs.findKnockout(job, map);
  const fromAnswers = jobs.profileFromAnswers(job, map);
  const profile = {
    fullName: fromAnswers.fullName || user?.name,
    email: fromAnswers.email || user?.email,
    phone: fromAnswers.phone || user?.phone,
    location: fromAnswers.location || user?.city,
    title: user?.designation,
    ...Object.fromEntries(Object.entries(fromAnswers).filter(([, v]) => v !== undefined && v !== "")),
  };
  const resumeField = jobs.allFields(job).find((f) => f.type === "resume");
  const resume = resumeField ? map.get(resumeField.id)?.files?.[0] : undefined;
  const poolConsent = jobs
    .allFields(job)
    .some((f) => f.type === "declaration" && f.talentPoolConsent && map.get(f.id)?.value === true);

  // Referral attribution: the existing affiliate flow (first real affiliate
  // wins, no self-referral) plus this application's own record of whose
  // link it came through, which is what makes a hire reward-eligible.
  let referral: { referrerId: Types.ObjectId; affiliateId: string } | undefined;
  const ref = (body.ref || "").trim();
  if (ref) {
    const referrer = await User.findOne({ affiliateId: ref }).select("_id").lean<any>();
    if (referrer && String(referrer._id) !== userId) {
      referral = { referrerId: referrer._id, affiliateId: ref };
      await setReferredByAffiliateId(userId, ref, String(job.orgId)).catch((e: any) =>
        console.error("[jobs] referral attribution failed:", e?.message)
      );
    }
  }

  const { score, matchedSkills } = jobs.computeMatch(job, { answers, profile, quiz } as any);
  const first = jobs.firstStage(job);
  const now = new Date();
  const doc = existing || new JobApplication({
    jobId: job._id,
    orgId: job.orgId,
    candidateId: userId,
    reference: jobs.applicationReference(org?.name || ""),
  });
  doc.isDraft = false;
  doc.furthestPage = Math.max(0, (job.form.pages || []).length - 1);
  doc.stageId = first?.id || "";
  doc.stageCategory = "applied";
  doc.maxStageRank = 0;
  doc.status = "active";
  doc.answers = answers as any;
  doc.profile = profile as any;
  doc.resume = resume as any;
  doc.source = referral ? "referral" : body.source || "garage_hq";
  doc.referral = referral as any;
  doc.matchScore = score;
  doc.matchedSkills = matchedSkills;
  doc.quiz = quiz as any;
  doc.knockout = knockout ? ({ triggered: true, fieldId: knockout.field.id, reason: knockout.reason } as any) : undefined;
  doc.talentPoolConsent = poolConsent;
  doc.consentUntil = poolConsent
    ? new Date(now.getTime() + (settings.privacy?.retentionMonths || 12) * 30 * 86400000)
    : undefined;
  doc.appliedAt = now;
  doc.stageEnteredAt = now;
  doc.lastActivityAt = now;
  doc.lastActivity = "Applied";
  try {
    await doc.save();
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 409, "You've already applied for this job.");
    throw err;
  }

  if (!existing) {
    await Promise.all([
      JobPosting.updateOne({ _id: job._id }, { $inc: { "stats.applyStarts": 1 } }),
      JobEvent.create({ orgId: job.orgId, jobId: job._id, type: "apply_start", userId, source: doc.source }),
    ]).catch(() => {});
  }

  await jobs.logActivity({
    app: doc,
    type: "applied",
    text: referral ? `Applied via ${referral.affiliateId}` : `Applied via ${doc.source.replace("_", " ")}`,
  });
  await jobs.logActivity({
    app: doc,
    type: "auto_scored",
    text: `Auto-scored ${score}%${quiz ? ` · quiz ${quiz.score}/${quiz.total} ${quiz.passed ? "passed" : "not passed"}` : ""}`,
    touch: false,
  });

  const company = org?.name || "The team";
  const vars = { candidate_name: profile.fullName || "there", job_title: job.title, company };
  if (job.candidateEmails?.applicationReceived) {
    await jobs.sendCandidateEmail({ orgId: String(job.orgId), kind: "application_received", to: profile.email, vars });
  }

  if (knockout && knockout.field.knockout?.moveToRejected !== false) {
    await jobs.logActivity({
      app: doc,
      type: "knockout",
      text: `Knockout: "${knockout.field.label}"${knockout.reason ? ` · ${knockout.reason}` : ""}`,
      touch: false,
    });
    await jobs.rejectApplicationWithEmail(doc, job, {
      reason: knockout.reason,
      sendEmail: true,
      delayEmail: knockout.field.knockout?.delayEmail !== false,
      logText: "Rejected automatically by a knockout question",
    });
    if (knockout.field.knockout?.notifyTeam) {
      await jobs.notifyUsersByEmail(
        String(job.orgId),
        job.team.map((t) => String(t.userId)),
        `Knockout: ${profile.fullName || "A candidate"} for ${job.title}`,
        `${profile.fullName || "A candidate"} answered a knockout question on ${job.title} and was rejected automatically.`
      );
    }
  } else {
    if (first) await jobs.runOnEnterActions(doc, job, first, vars);
    // "Quiz score ≥ N moves to <stage>" — evaluated now, because the quiz is
    // part of the application.
    if (quiz) {
      const rule = job.stages
        .flatMap((s) => s.autoActions || [])
        .filter((a) => a.trigger === "quiz_score_gte" && a.action === "move_to_stage" && a.targetStageId)
        .filter((a) => quiz.score >= (a.value || 0))
        .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
      if (rule?.targetStageId && jobs.stageById(job, rule.targetStageId)) {
        const target = jobs.stageById(job, rule.targetStageId)!;
        if (target.category !== "hired") await jobs.moveApplicationToStage(doc, job, target.id);
      }
    }
  }

  res.status(201).json({
    success: true,
    // Deliberately no status: a knockout rejection reaches the candidate
    // through My Applications once its (possibly delayed) email goes out.
    application: {
      _id: String(doc._id),
      reference: doc.reference,
      appliedAt: doc.appliedAt,
    },
  });
});

// ── My applications (B5) ─────────────────────────────────────────────────

router.get("/me/applications", requireAuth, async (req: Request, res: Response) => {
  const userId = me(req).userId;
  const apps = await JobApplication.find({ candidateId: userId }).sort({ updatedAt: -1 }).limit(200).lean<any[]>();
  const [jobDocs, interviews, offers] = await Promise.all([
    JobPosting.find({ _id: { $in: apps.map((a) => a.jobId) } }).select("title slug orgId locations workplace status form.pages.id stages").lean<any[]>(),
    JobInterview.find({ applicationId: { $in: apps.map((a) => a._id) }, status: { $in: ["scheduled", "awaiting_candidate"] } })
      .sort({ scheduledAt: 1 })
      .lean<any[]>(),
    JobOffer.find({ applicationId: { $in: apps.map((a) => a._id) }, status: { $in: ["sent", "accepted", "declined", "expired"] } })
      .sort({ createdAt: -1 })
      .lean<any[]>(),
  ]);
  const jobById = new Map(jobDocs.map((j) => [String(j._id), j]));
  const orgs = await orgsById(jobDocs.map((j) => j.orgId));
  const now = Date.now();

  res.json({
    success: true,
    applications: apps.map((a) => {
      const job = jobById.get(String(a.jobId));
      const org = job ? orgs.get(String(job.orgId)) : null;
      // Every live round, same set the hiring team sees: picks waiting on the
      // candidate first, then upcoming by time, then past ones (newest first).
      const ivs =
        a.status === "active"
          ? interviews
              .filter((i) => String(i.applicationId) === String(a._id))
              .map((i) => {
                const at = i.scheduledAt ? new Date(i.scheduledAt).getTime() : 0;
                const over = i.status === "scheduled" && at + (i.durationMin || 0) * 60000 < now;
                return { i, at, rank: i.status === "awaiting_candidate" ? 0 : over ? 2 : 1 };
              })
              .sort((x, y) => x.rank - y.rank || (x.rank === 2 ? y.at - x.at : x.at - y.at))
              .map(({ i }) => ({
                _id: String(i._id),
                status: i.status,
                roundLabel: "Interview",
                scheduledAt: i.scheduledAt,
                durationMin: i.durationMin,
                mode: i.mode,
                location: i.location,
                slots: i.status === "awaiting_candidate" ? i.slots : [],
                meetingUrl:
                  i.meetingUrl && i.scheduledAt && new Date(i.scheduledAt).getTime() - now <= 10 * 60000 ? i.meetingUrl : null,
              }))
          : [];
      const offer = offers.find((o) => String(o.applicationId) === String(a._id));
      const rejected = a.status === "rejected";
      // A delayed rejection stays invisible to the candidate until its email goes out.
      const showRejected = rejected && (!a.rejection?.emailDueAt || new Date(a.rejection.emailDueAt).getTime() <= now || a.rejection?.emailSentAt);
      return {
        _id: String(a._id),
        reference: a.reference,
        isDraft: a.isDraft,
        draftProgress: a.isDraft ? { page: (a.furthestPage || 0) + 1, pages: job?.form?.pages?.length || 1 } : null,
        status: rejected && !showRejected ? "active" : a.status,
        stageCategory: rejected && !showRejected ? a.stageCategory : a.stageCategory,
        process: [...new Set((job?.stages || []).map((s: any) => s.category))].filter((c) => c !== "hired"),
        appliedAt: a.appliedAt,
        job: job
          ? { _id: String(job._id), title: job.title, slug: job.slug, status: job.status, locations: job.locations, workplace: job.workplace }
          : null,
        org: org ? { _id: String(org._id), name: org.name, slug: org.slug || String(org._id), icon: org.icon } : null,
        // `interview` stays for clients that only read one.
        interview: ivs[0] || null,
        interviews: ivs,
        offer: offer
          ? {
              _id: String(offer._id),
              status: offer.status,
              role: offer.role,
              ctc: offer.ctc,
              currency: offer.currency,
              joiningDate: offer.joiningDate,
              expiresAt: offer.expiresAt,
              letter: offer.letter,
              message: offer.message,
            }
          : null,
      };
    }),
  });
});

router.post("/me/applications/:id/withdraw", requireAuth, async (req: Request, res: Response) => {
  const userId = me(req).userId;
  if (!jobs.isObjectId(String(req.params.id))) return bad(res, 404, "Application not found");
  const app = await JobApplication.findOne({ _id: req.params.id, candidateId: userId });
  if (!app) return bad(res, 404, "Application not found");
  if (app.isDraft) {
    await JobApplication.deleteOne({ _id: app._id });
    return res.json({ success: true, deleted: true });
  }
  if (app.status !== "active") return bad(res, 409, "This application can't be withdrawn.");
  app.status = "withdrawn";
  await app.save();
  await jobs.logActivity({ app, type: "withdrawn", text: "Candidate withdrew their application", actorId: userId });
  res.json({ success: true });
});

router.post("/me/interviews/:id/pick", requireAuth, async (req: Request, res: Response) => {
  const userId = me(req).userId;
  if (!jobs.isObjectId(String(req.params.id))) return bad(res, 404, "Interview not found");
  const body = parse(z.object({ slot: z.string().datetime({ offset: true }) }), req.body, res);
  if (!body) return;
  const iv = await JobInterview.findOne({ _id: req.params.id, candidateId: userId });
  if (!iv) return bad(res, 404, "Interview not found");
  if (iv.status !== "awaiting_candidate") return bad(res, 409, "This interview is already scheduled.");
  const slot = new Date(body.slot);
  const offered = iv.slots.find((s) => Math.abs(new Date(s).getTime() - slot.getTime()) < 60000);
  if (!offered) return bad(res, 400, "Pick one of the offered times.");
  if (offered <= new Date()) return bad(res, 400, "That time has already passed.");

  const creator = await User.findById(iv.createdBy).select("email").lean<any>();
  const job = await JobPosting.findById(iv.jobId).select("title team orgId").lean<any>();
  const app = await JobApplication.findById(iv.applicationId);
  const claimed = await JobInterview.findOneAndUpdate(
    { _id: iv._id, status: "awaiting_candidate" },
    { $set: { status: "scheduled", scheduledAt: offered } },
    { new: true }
  );
  if (!claimed) return bad(res, 409, "This interview is already scheduled.");
  if (claimed.mode === "video" && creator?.email) {
    const url = await jobs.createInterviewMeet({
      orgId: String(iv.orgId),
      hostEmail: creator.email,
      title: `${job?.title || "Interview"} · ${app?.profile?.fullName || "Candidate"}`,
      start: offered,
      durationMin: claimed.durationMin,
    });
    if (url) {
      claimed.meetingUrl = url;
      await claimed.save();
    }
  }
  if (app) {
    await jobs.logActivity({
      app,
      type: "interview_slot_picked",
      text: `Candidate picked ${jobs.formatWhen(offered, claimed.timezone)}`,
      data: { interviewId: String(iv._id) },
    });
  }
  await jobs.notifyUsersByEmail(
    String(iv.orgId),
    claimed.interviewerIds.map(String),
    `Interview booked: ${app?.profile?.fullName || "Candidate"} · ${job?.title || ""}`,
    `${app?.profile?.fullName || "The candidate"} picked ${jobs.formatWhen(offered, claimed.timezone)} (${claimed.durationMin} min).${claimed.meetingUrl ? `\n\nJoin: ${claimed.meetingUrl}` : ""}`
  );
  res.json({ success: true, interview: { _id: String(claimed._id), scheduledAt: claimed.scheduledAt, status: claimed.status } });
});

router.post("/me/offers/:id/respond", requireAuth, async (req: Request, res: Response) => {
  const userId = me(req).userId;
  if (!jobs.isObjectId(String(req.params.id))) return bad(res, 404, "Offer not found");
  const body = parse(z.object({ accept: z.boolean(), reason: z.string().max(1000).optional() }), req.body, res);
  if (!body) return;
  const offer = await JobOffer.findOne({ _id: req.params.id, candidateId: userId });
  if (!offer) return bad(res, 404, "Offer not found");
  if (offer.status !== "sent") return bad(res, 409, `This offer is ${offer.status}.`);
  if (offer.expiresAt && offer.expiresAt <= new Date()) {
    offer.status = "expired";
    await offer.save();
    return bad(res, 410, "This offer has expired.");
  }
  offer.status = body.accept ? "accepted" : "declined";
  offer.respondedAt = new Date();
  if (!body.accept && body.reason) offer.declineReason = body.reason;
  await offer.save();
  const [app, job] = await Promise.all([
    JobApplication.findById(offer.applicationId),
    JobPosting.findById(offer.jobId).select("title team orgId").lean<any>(),
  ]);
  if (app) {
    await jobs.logActivity({
      app,
      type: body.accept ? "offer_accepted" : "offer_declined",
      text: body.accept ? "Candidate accepted the offer" : `Candidate declined the offer${body.reason ? ` · ${body.reason}` : ""}`,
      actorId: userId,
    });
  }
  if (job) {
    await jobs.notifyUsersByEmail(
      String(job.orgId),
      (job.team || []).map((t: any) => String(t.userId)),
      `${app?.profile?.fullName || "A candidate"} ${body.accept ? "accepted" : "declined"} the ${job.title} offer`,
      body.accept
        ? `${app?.profile?.fullName || "The candidate"} accepted the offer. Confirm the hire in Garage Jobs to set their joining date.`
        : `${app?.profile?.fullName || "The candidate"} declined the offer.${body.reason ? `\n\nReason: ${body.reason}` : ""}`
    );
  }
  res.json({ success: true, offer });
});

// ── Saved jobs & job alerts (B6) ─────────────────────────────────────────

router.get("/me/saved", requireAuth, async (req: Request, res: Response) => {
  const userId = me(req).userId;
  const saved = await SavedJob.find({ userId }).sort({ createdAt: -1 }).limit(500).lean<any[]>();
  const jobDocs = await JobPosting.find({
    _id: { $in: saved.map((s) => s.jobId) },
    deletedAt: null,
    status: { $ne: "draft" },
  }).lean<any[]>();
  const jobById = new Map(jobDocs.map((j) => [String(j._id), j]));
  const [orgs, mine] = await Promise.all([
    orgsById(jobDocs.map((j) => j.orgId)),
    JobApplication.find({ candidateId: userId, jobId: { $in: jobDocs.map((j) => j._id) } })
      .select("jobId isDraft status")
      .lean<any[]>(),
  ]);
  const mineByJob = new Map(mine.map((a) => [String(a.jobId), a]));
  res.json({
    success: true,
    jobs: saved
      .filter((s) => jobById.has(String(s.jobId)))
      .map((s) => {
        const job = jobById.get(String(s.jobId));
        const app = mineByJob.get(String(s.jobId));
        return publicJob(job, orgs.get(String(job.orgId)), {
          savedAt: s.createdAt,
          saved: true,
          myApplication: app ? { isDraft: app.isDraft, status: app.status } : null,
        });
      }),
  });
});

router.post("/me/saved", requireAuth, async (req: Request, res: Response) => {
  const body = parse(z.object({ jobId: z.string().refine(jobs.isObjectId, "Invalid job id") }), req.body, res);
  if (!body) return;
  const job = await JobPosting.findOne({ _id: body.jobId, deletedAt: null, status: { $ne: "draft" } })
    .select("_id")
    .lean();
  if (!job) return bad(res, 404, "Job not found");
  try {
    await SavedJob.create({ userId: me(req).userId, jobId: body.jobId });
  } catch (err: any) {
    // Already saved — saving is idempotent.
    if (err?.code !== 11000) throw err;
  }
  res.json({ success: true });
});

router.delete("/me/saved/:jobId", requireAuth, async (req: Request, res: Response) => {
  const jobId = String(req.params.jobId);
  if (!jobs.isObjectId(jobId)) return bad(res, 404, "Job not found");
  await SavedJob.deleteOne({ userId: me(req).userId, jobId });
  res.json({ success: true });
});

const alertCriteriaZ = z.object({
  q: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  workplace: z.array(z.enum(WORKPLACE_TYPES)).max(3).optional(),
  employmentType: z.array(z.enum(EMPLOYMENT_TYPES)).max(4).optional(),
  experience: z.number().min(0).max(60).optional(),
  salaryMin: z.number().min(0).max(1_000_000_000).optional(),
  department: z.string().max(80).optional(),
});

const MAX_ALERTS = 20;

/** Live postings matching an alert that went live since it last emailed. */
async function newMatchCount(alert: any): Promise<number> {
  const filter = await buildJobSearchFilter(alert.criteria || {}, {
    publishedAfter: alert.lastSentAt || alert.createdAt,
  });
  return JobPosting.countDocuments(filter);
}

function alertRow(alert: any, newMatches: number) {
  return {
    _id: String(alert._id),
    name: alert.name,
    criteria: alert.criteria || {},
    frequency: alert.frequency,
    weekday: alert.frequency === "weekly" ? alert.weekday : undefined,
    active: alert.active,
    newMatches,
    lastSentAt: alert.lastSentAt,
    createdAt: alert.createdAt,
  };
}

router.get("/me/alerts", requireAuth, async (req: Request, res: Response) => {
  const alerts = await JobAlert.find({ userId: me(req).userId }).sort({ createdAt: -1 }).lean<any[]>();
  const counts = await Promise.all(alerts.map((a) => newMatchCount(a).catch(() => 0)));
  res.json({ success: true, alerts: alerts.map((a, i) => alertRow(a, counts[i])) });
});

router.post("/me/alerts", requireAuth, async (req: Request, res: Response) => {
  const userId = me(req).userId;
  const body = parse(
    z.object({
      name: z.string().max(160).optional(),
      criteria: alertCriteriaZ,
      frequency: z.enum(ALERT_FREQUENCIES),
      weekday: z.number().int().min(0).max(6).optional(),
    }),
    req.body,
    res
  );
  if (!body) return;
  if ((await JobAlert.countDocuments({ userId })) >= MAX_ALERTS) {
    return bad(res, 409, `You can keep up to ${MAX_ALERTS} job alerts. Delete one to add another.`);
  }
  const criteria = normalizeCriteria(body.criteria);
  const alert = await JobAlert.create({
    userId,
    name: body.name?.trim() || summarizeCriteria(criteria),
    criteria,
    frequency: body.frequency,
    weekday: body.frequency === "weekly" ? body.weekday ?? 1 : undefined,
    active: true,
  });
  res.status(201).json({ success: true, alert: alertRow(alert.toObject(), await newMatchCount(alert).catch(() => 0)) });
});

router.patch("/me/alerts/:id", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!jobs.isObjectId(id)) return bad(res, 404, "Alert not found");
  const body = parse(
    z
      .object({
        name: z.string().max(160),
        criteria: alertCriteriaZ,
        frequency: z.enum(ALERT_FREQUENCIES),
        weekday: z.number().int().min(0).max(6),
        active: z.boolean(),
      })
      .partial(),
    req.body,
    res
  );
  if (!body) return;
  const alert = await JobAlert.findOne({ _id: id, userId: me(req).userId });
  if (!alert) return bad(res, 404, "Alert not found");
  if (body.criteria) {
    alert.criteria = normalizeCriteria(body.criteria);
    alert.markModified("criteria");
  }
  if (body.name !== undefined) alert.name = body.name.trim() || summarizeCriteria(alert.criteria || {});
  if (body.frequency) alert.frequency = body.frequency;
  if (body.weekday !== undefined) alert.weekday = body.weekday;
  if (alert.frequency === "weekly" && alert.weekday === undefined) alert.weekday = 1;
  if (alert.frequency !== "weekly") alert.weekday = undefined;
  if (body.active !== undefined) alert.active = body.active;
  await alert.save();
  res.json({ success: true, alert: alertRow(alert.toObject(), await newMatchCount(alert).catch(() => 0)) });
});

router.delete("/me/alerts/:id", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!jobs.isObjectId(id)) return bad(res, 404, "Alert not found");
  await JobAlert.deleteOne({ _id: id, userId: me(req).userId });
  res.json({ success: true });
});

export default router;
