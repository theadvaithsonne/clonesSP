// src/services/jobs.ts
//
// Rules shared by every Garage Jobs route: who may manage an office's hiring,
// slugs, the default pipeline and application form, evaluating a submitted
// form (conditional fields, validation, knockouts, quiz scoring), the match
// score, the application activity log and candidate emails.
//
// Money is NOT handled here — see services/jobRewards.ts, which only calls the
// existing wallet and Unilevel Plus services.

import crypto from "crypto";
import { Types } from "mongoose";
import {
  JobPosting,
  IJobPosting,
  IJobStage,
  IJobFormField,
  IJobFormPage,
  IJobFieldCondition,
  STAGE_CATEGORIES,
  StageCategory,
} from "../models/jobPosting.model";
import {
  JobApplication,
  IJobApplication,
  IJobAnswer,
} from "../models/jobApplication.model";
import { JobActivity, JobActivityType } from "../models/jobActivity.model";
import {
  JobsSettings,
  IJobsSettings,
  EmailTemplateKind,
} from "../models/jobsSettings.model";
import { User } from "../models/user.model";
import { findMembership } from "../utils/rbac";
import { hasFounderAccess } from "../utils/accessCheck";
import { sendMail, senderForOrg } from "./mailer";
import { env } from "../config/env";

// ── Small helpers ────────────────────────────────────────────────────────

export function newId(prefix = ""): string {
  return `${prefix}${crypto.randomBytes(5).toString("hex")}`;
}

export const STAGE_RANK: Record<StageCategory, number> = STAGE_CATEGORIES.reduce(
  (acc, c, i) => ({ ...acc, [c]: i }),
  {} as Record<StageCategory, number>
);

export function stripHtml(html: string | undefined | null): string {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isObjectId(id: unknown): id is string {
  return typeof id === "string" && Types.ObjectId.isValid(id);
}

// ── Access ───────────────────────────────────────────────────────────────

/**
 * Founders (and stakeholders granted full access) manage an office's jobs.
 * Checked against the membership record, never against an org id the client
 * sent, so a query-string org can't be used to reach another office's hiring.
 */
export async function canManageJobs(userId: string, orgId: string): Promise<boolean> {
  if (!isObjectId(userId) || !isObjectId(orgId)) return false;
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean<any>();
  if (!user) return false;
  if (
    user.organization?.toString() === orgId &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return true;
  }
  const membership = findMembership(user.organizations, orgId);
  return !!membership && hasFounderAccess(membership);
}

// ── Slugs & references ───────────────────────────────────────────────────

export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/**
 * A slug free within the office at the moment of the call. The unique
 * `{orgId, slug}` index is the real guard; callers retry on duplicate key.
 */
export async function uniqueJobSlug(
  orgId: string,
  title: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(title) || "job";
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await JobPosting.findOne({
      orgId,
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select("_id")
      .lean();
    if (!clash) return candidate;
  }
  return `${base}-${newId()}`;
}

/** "Northwind Labs" → "NW-APP-48213". Display only; not used as a key. */
export function applicationReference(orgName: string): string {
  const words = (orgName || "").split(/\s+/).filter(Boolean);
  let initials = words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (initials.length < 2) initials = (orgName || "GA").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  if (initials.length < 2) initials = "GA";
  return `${initials}-APP-${crypto.randomInt(10000, 99999)}`;
}

// ── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_STAGE_NAMES: Array<[string, StageCategory]> = [
  ["Applied", "applied"],
  ["Screening", "screening"],
  ["Assessment", "assessment"],
  ["Interview", "interview"],
  ["Offer", "offer"],
  ["Hired", "hired"],
];

export function builtInStages(): IJobStage[] {
  return DEFAULT_STAGE_NAMES.map(([name, category]) => ({
    id: newId("stg_"),
    name,
    category,
    autoActions: [],
  })) as IJobStage[];
}

/** The office's saved default pipeline, else the built-in six stages. */
export function defaultStagesFor(settings: IJobsSettings | null): IJobStage[] {
  const saved = settings?.defaultPipeline?.stages;
  if (Array.isArray(saved) && saved.length >= 2) {
    return saved.map((s: any) => ({
      id: newId("stg_"),
      name: String(s.name || "Stage"),
      category: (STAGE_CATEGORIES as readonly string[]).includes(s.category)
        ? s.category
        : "screening",
      ownerId: isObjectId(String(s.ownerId || "")) ? s.ownerId : undefined,
      autoActions: [],
    })) as IJobStage[];
  }
  return builtInStages();
}

function field(partial: Partial<IJobFormField> & Pick<IJobFormField, "type" | "label">): IJobFormField {
  return {
    id: newId("fld_"),
    helpText: undefined,
    required: false,
    locked: false,
    options: [],
    fileTypes: [],
    multiple: false,
    parseResume: false,
    talentPoolConsent: false,
    ...partial,
  } as IJobFormField;
}

export function consentLabel(orgName: string): string {
  return `I consent to ${orgName || "this company"} processing my application data for recruitment purposes.`;
}

/**
 * Every new posting starts with the essentials a founder would otherwise add
 * by hand: profile fields, a resume and the consent declaration. The consent
 * field is locked — the minimum clause can't be removed or made optional.
 */
export function defaultFormPages(orgName: string): IJobFormPage[] {
  return [
    {
      id: newId("pg_"),
      title: "About you",
      description: "Profile fields · auto-filled",
      fields: [
        field({ type: "profile_full_name", label: "Full name", required: true }),
        field({ type: "profile_email", label: "Email", required: true }),
        field({ type: "profile_phone", label: "Phone", required: true }),
        field({ type: "profile_location", label: "Current location" }),
        field({ type: "profile_experience", label: "Total experience (years)" }),
      ],
    },
    {
      id: newId("pg_"),
      title: "Your work",
      description: "Work samples",
      fields: [
        field({
          type: "resume",
          label: "Resume / CV",
          required: true,
          fileTypes: ["pdf", "docx"],
          maxSizeMb: 10,
        }),
      ],
    },
    {
      id: newId("pg_"),
      title: "Declaration",
      description: "Candidate consent",
      fields: [
        field({
          type: "declaration",
          label: consentLabel(orgName),
          required: true,
          locked: true,
        }),
        field({
          type: "declaration",
          label: "Keep me in the talent pool for future roles.",
          talentPoolConsent: true,
        }),
      ],
    },
  ];
}

const DEFAULT_REJECTION_REASONS = [
  "Location mismatch",
  "Not enough experience",
  "Skills don't match the role",
  "Position filled",
  "Withdrew interest",
];

const DEFAULT_TEMPLATES: Array<{ kind: EmailTemplateKind; name: string; subject: string; body: string }> = [
  {
    kind: "application_received",
    name: "Application received",
    subject: "We received your application for {{job_title}}",
    body:
      "Hi {{candidate_name}},\n\nThanks for applying for {{job_title}} at {{company}}. The team will review your application and you'll get updates in Garage and by email.\n\n{{company}}",
  },
  {
    kind: "moved_to_interview",
    name: "Moved to interview",
    subject: "Next step for {{job_title}}: interview",
    body:
      "Hi {{candidate_name}},\n\nGood news — {{company}} would like to interview you for {{job_title}}. You'll receive an invite with the time and a link shortly.\n\n{{company}}",
  },
  {
    kind: "interview_invite",
    name: "Interview invite",
    subject: "Interview for {{job_title}} at {{company}}",
    body:
      "Hi {{candidate_name}},\n\nYou're invited to an interview for {{job_title}}.\n\n{{interview_details}}\n\n{{company}}",
  },
  {
    kind: "rejection",
    name: "Rejection",
    subject: "Your application for {{job_title}}",
    body:
      "Hi {{candidate_name}},\n\nThank you for your interest in {{job_title}} at {{company}}. After careful review, we've decided not to move forward with your application. We appreciate the time you invested and wish you the best.\n\n{{company}}",
  },
  {
    kind: "offer",
    name: "Offer",
    subject: "Your offer for {{job_title}} at {{company}}",
    body:
      "Hi {{candidate_name}},\n\n{{company}} has sent you an offer for {{job_title}}. Review and respond to it in Garage.\n\n{{offer_link}}\n\n{{company}}",
  },
];

/**
 * Settings for read-only paths (public pages, applying) — never writes. An
 * office that never opened Jobs settings gets the defaults in memory.
 */
export async function readJobsSettings(orgId: string): Promise<Pick<IJobsSettings, "careersPage" | "privacy">> {
  const found = await JobsSettings.findOne({ orgId }).select("careersPage privacy").lean<IJobsSettings>();
  return {
    careersPage: found?.careersPage || { culturePhotos: [], perks: [], showRewards: false },
    privacy: found?.privacy || { retentionMonths: 12, allowDeletionRequests: true, consentAddition: "" },
  };
}

/** The office's Jobs settings, created with sensible defaults on first read. */
export async function getJobsSettings(orgId: string): Promise<IJobsSettings> {
  const existing = await JobsSettings.findOne({ orgId });
  if (existing) return existing;
  try {
    return await JobsSettings.create({
      orgId,
      careersPage: { culturePhotos: [], perks: [], showRewards: false },
      emailTemplates: DEFAULT_TEMPLATES.map((t) => ({ id: newId("tpl_"), ...t })),
      rejectionReasons: DEFAULT_REJECTION_REASONS.map((label) => ({
        id: newId("rsn_"),
        label,
      })),
      savedForms: [],
      defaultPipeline: { stages: [] },
      privacy: { retentionMonths: 12, allowDeletionRequests: true, consentAddition: "" },
    });
  } catch (err: any) {
    // Two first reads raced on the unique orgId index — the other one won.
    if (err?.code === 11000) {
      const again = await JobsSettings.findOne({ orgId });
      if (again) return again;
    }
    throw err;
  }
}

// ── Stages ───────────────────────────────────────────────────────────────

export function stageById(job: Pick<IJobPosting, "stages">, id: string): IJobStage | undefined {
  return job.stages.find((s) => s.id === id);
}

export function firstStage(job: Pick<IJobPosting, "stages">): IJobStage | undefined {
  return job.stages[0];
}

export function nextStage(job: Pick<IJobPosting, "stages">, currentId: string): IJobStage | undefined {
  const i = job.stages.findIndex((s) => s.id === currentId);
  return i >= 0 ? job.stages[i + 1] : undefined;
}

export function firstStageOfCategory(
  job: Pick<IJobPosting, "stages">,
  category: StageCategory
): IJobStage | undefined {
  return job.stages.find((s) => s.category === category);
}

// ── Form evaluation ──────────────────────────────────────────────────────

export const PROFILE_FIELD_KEYS: Record<string, keyof IJobApplication["profile"]> = {
  profile_full_name: "fullName",
  profile_email: "email",
  profile_phone: "phone",
  profile_location: "location",
  profile_company: "company",
  profile_experience: "experienceYears",
  profile_current_ctc: "currentCtc",
  profile_expected_ctc: "expectedCtc",
  profile_notice_period: "noticePeriod",
  profile_linkedin: "linkedin",
};

const FILE_FIELD_TYPES = new Set(["resume", "file_upload", "video_answer"]);
const LAYOUT_FIELD_TYPES = new Set(["section_heading", "info_text"]);

export function allFields(job: Pick<IJobPosting, "form">): IJobFormField[] {
  return (job.form?.pages || []).flatMap((p) => p.fields || []);
}

export function answerableFieldCount(job: Pick<IJobPosting, "form">): number {
  return allFields(job).filter((f) => !LAYOUT_FIELD_TYPES.has(f.type)).length;
}

export type AnswerMap = Map<string, IJobAnswer>;

export function toAnswerMap(answers: IJobAnswer[] | undefined): AnswerMap {
  const m: AnswerMap = new Map();
  for (const a of answers || []) m.set(a.fieldId, a);
  return m;
}

function optionLabel(fieldDef: IJobFormField | undefined, value: unknown): string {
  if (!fieldDef) return String(value ?? "");
  const opt = fieldDef.options?.find((o) => o.id === value);
  return opt ? opt.label : String(value ?? "");
}

function isEmptyAnswer(fieldDef: IJobFormField, a: IJobAnswer | undefined): boolean {
  if (!a) return true;
  if (FILE_FIELD_TYPES.has(fieldDef.type)) return !a.files || a.files.length === 0;
  const v = a.value;
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (fieldDef.type === "declaration") return v !== true;
  return false;
}

export function conditionMet(
  cond: IJobFieldCondition,
  answers: AnswerMap,
  fieldsById: Map<string, IJobFormField>
): boolean {
  const a = answers.get(cond.fieldId);
  const src = fieldsById.get(cond.fieldId);
  if (!a || a.value === undefined || a.value === null || a.value === "") return false;
  const values = Array.isArray(a.value) ? a.value : [a.value];
  const want = String(cond.value ?? "").trim().toLowerCase();
  const asText = (v: unknown) => [String(v).toLowerCase(), optionLabel(src, v).toLowerCase()];
  switch (cond.operator) {
    case "equals":
      return values.some((v) => asText(v).includes(want));
    case "not_equals":
      return !values.some((v) => asText(v).includes(want));
    case "contains":
      return values.some((v) => asText(v).some((t) => t.includes(want)));
    case "greater_than":
      return Number(a.value) > Number(cond.value);
    case "less_than":
      return Number(a.value) < Number(cond.value);
    default:
      return false;
  }
}

/**
 * A conditional field is required only while its condition holds. With
 * "hide until met" it is also invisible until then; without it the candidate
 * sees it but may leave it blank.
 */
export function fieldState(
  f: IJobFormField,
  answers: AnswerMap,
  fieldsById: Map<string, IJobFormField>
): { visible: boolean; required: boolean } {
  if (!f.condition?.fieldId) return { visible: true, required: f.required };
  const met = conditionMet(f.condition, answers, fieldsById);
  return {
    visible: met || !f.condition.hideUntilMet,
    required: met && f.required,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+/i;

/** Field errors for one page (or every page when `pageIndex` is omitted). */
export function validateAnswers(
  job: Pick<IJobPosting, "form">,
  answers: AnswerMap,
  pageIndex?: number
): Record<string, string> {
  const errors: Record<string, string> = {};
  const fields = allFields(job);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const pages =
    pageIndex === undefined ? job.form.pages : job.form.pages.slice(pageIndex, pageIndex + 1);

  for (const page of pages) {
    for (const f of page.fields) {
      if (LAYOUT_FIELD_TYPES.has(f.type)) continue;
      const { visible, required } = fieldState(f, answers, byId);
      if (!visible) continue;
      const a = answers.get(f.id);
      if (isEmptyAnswer(f, a)) {
        if (required) {
          errors[f.id] =
            f.type === "declaration"
              ? "Please confirm to continue."
              : FILE_FIELD_TYPES.has(f.type)
                ? `${f.label || "This file"} is required.`
                : `${f.label || "This field"} is required.`;
        }
        continue;
      }
      const v = a!.value;
      if ((f.type === "email" || f.type === "profile_email") && !EMAIL_RE.test(String(v).trim())) {
        errors[f.id] = "Enter a valid email address.";
      } else if (
        (f.type === "url" || f.type === "portfolio_link" || f.type === "profile_linkedin") &&
        !URL_RE.test(String(v).trim())
      ) {
        errors[f.id] = "Enter a full link starting with https://";
      } else if (
        (f.type === "number" || f.type === "profile_experience") &&
        Number.isNaN(Number(v))
      ) {
        errors[f.id] = "Enter a number.";
      } else if (f.maxLength && typeof v === "string" && v.length > f.maxLength) {
        errors[f.id] = `Keep it under ${f.maxLength} characters.`;
      } else if (FILE_FIELD_TYPES.has(f.type) && f.maxSizeMb && a!.files?.length) {
        const tooBig = a!.files.find((file) => (file.size || 0) > f.maxSizeMb! * 1024 * 1024);
        if (tooBig) errors[f.id] = `${tooBig.name} is larger than ${f.maxSizeMb} MB.`;
      }
    }
  }
  return errors;
}

/** Drop answers to fields that are hidden and set to clear when hidden. */
export function pruneHiddenAnswers(
  job: Pick<IJobPosting, "form">,
  answers: IJobAnswer[]
): IJobAnswer[] {
  const map = toAnswerMap(answers);
  const fields = allFields(job);
  const byId = new Map(fields.map((f) => [f.id, f]));
  return answers.filter((a) => {
    const f = byId.get(a.fieldId);
    if (!f) return false;
    if (!f.condition?.fieldId || !f.condition.clearIfHidden) return true;
    return conditionMet(f.condition, map, byId);
  });
}

/** The first knockout rule the answers trip, if any. */
export function findKnockout(
  job: Pick<IJobPosting, "form">,
  answers: AnswerMap
): { field: IJobFormField; reason?: string } | null {
  for (const f of allFields(job)) {
    const ko = f.knockout;
    if (!ko?.enabled || !ko.answer) continue;
    const a = answers.get(f.id);
    if (!a || a.value === undefined || a.value === null) continue;
    const values = Array.isArray(a.value) ? a.value.map(String) : [String(a.value)];
    const normalized = values.map((v) =>
      v === "true" ? "yes" : v === "false" ? "no" : v.toLowerCase()
    );
    if (normalized.includes(ko.answer.toLowerCase())) {
      return { field: f, reason: ko.addReason ? ko.reason : undefined };
    }
  }
  return null;
}

export function scoreQuiz(
  job: Pick<IJobPosting, "form">,
  answers: AnswerMap
): { score: number; total: number; passed: boolean } | undefined {
  let total = 0;
  let score = 0;
  let passMark = 0;
  let hasPassMark = false;
  for (const page of job.form.pages) {
    const quizFields = page.fields.filter((f) => f.type === "quiz_mcq" && f.correctOptionId);
    if (!quizFields.length) continue;
    if (typeof page.passMark === "number") {
      passMark += page.passMark;
      hasPassMark = true;
    }
    for (const f of quizFields) {
      const pts = f.points && f.points > 0 ? f.points : 1;
      total += pts;
      if (answers.get(f.id)?.value === f.correctOptionId) score += pts;
    }
  }
  if (!total) return undefined;
  const passed = hasPassMark ? score >= passMark : score >= Math.ceil(total / 2);
  return { score, total, passed };
}

/** Pull the typed profile snapshot out of the profile_* answers. */
export function profileFromAnswers(
  job: Pick<IJobPosting, "form">,
  answers: AnswerMap
): IJobApplication["profile"] {
  const profile: Record<string, any> = {};
  for (const f of allFields(job)) {
    const key = PROFILE_FIELD_KEYS[f.type];
    if (!key) continue;
    const v = answers.get(f.id)?.value;
    if (v === undefined || v === null || v === "") continue;
    profile[key] = key === "experienceYears" ? Number(v) : String(v).trim();
  }
  return profile as IJobApplication["profile"];
}

// ── Match score ──────────────────────────────────────────────────────────

/**
 * A transparent 0–100 fit score from what the candidate submitted:
 *   skills     — how many of the job's skills appear in their answers
 *   experience — years against the job's range
 *   location   — remote roles always fit; otherwise a listed location match
 *   quiz       — share of quiz points earned, when the form has a quiz
 */
export function computeMatch(
  job: Pick<IJobPosting, "skills" | "experienceMin" | "experienceMax" | "workplace" | "locations" | "form">,
  app: Pick<IJobApplication, "answers" | "profile" | "quiz">
): { score: number; matchedSkills: string[] } {
  const corpus = [
    ...app.answers.flatMap((a) => {
      const v = a.value;
      if (Array.isArray(v)) return v.map(String);
      return v === undefined || v === null ? [] : [String(v)];
    }),
    ...app.answers.flatMap((a) => a.files.map((f) => f.name)),
    ...Object.values(app.profile || {}).map((v) => String(v ?? "")),
  ]
    .join(" \n ")
    .toLowerCase();

  const skills = (job.skills || []).filter(Boolean);
  const matchedSkills = skills.filter((s) => corpus.includes(s.toLowerCase()));
  const skillsScore = skills.length ? matchedSkills.length / skills.length : 1;

  const years = app.profile?.experienceYears;
  let expScore = 0.5;
  if (typeof years === "number" && !Number.isNaN(years)) {
    const min = job.experienceMin ?? 0;
    const max = job.experienceMax ?? Number.POSITIVE_INFINITY;
    if (years >= min && years <= max) expScore = 1;
    else if (years < min) expScore = Math.max(0, 1 - (min - years) / Math.max(1, min));
    else expScore = 0.8;
  }

  let locScore = 0.5;
  if (job.workplace === "remote") locScore = 1;
  else if (app.profile?.location) {
    const loc = app.profile.location.toLowerCase();
    const hit = (job.locations || []).some((l) => {
      const city = l.split(",")[0].trim().toLowerCase();
      return city && (loc.includes(city) || city.includes(loc.split(",")[0].trim()));
    });
    locScore = hit ? 1 : 0.3;
  }

  const quiz = app.quiz && app.quiz.total ? app.quiz.score / app.quiz.total : null;
  const raw =
    quiz === null
      ? skillsScore * 0.5 + expScore * 0.3 + locScore * 0.2
      : skillsScore * 0.4 + expScore * 0.25 + locScore * 0.15 + quiz * 0.2;

  return { score: Math.round(Math.min(1, Math.max(0, raw)) * 100), matchedSkills };
}

// ── Activity ─────────────────────────────────────────────────────────────

export async function logActivity(opts: {
  app: Pick<IJobApplication, "_id" | "orgId" | "jobId">;
  type: JobActivityType;
  text: string;
  actorId?: string | Types.ObjectId;
  data?: Record<string, any>;
  mentions?: string[];
  /** Update the application's "last activity" line (default true). */
  touch?: boolean;
}): Promise<void> {
  await JobActivity.create({
    orgId: opts.app.orgId,
    jobId: opts.app.jobId,
    applicationId: opts.app._id,
    actorId: opts.actorId || undefined,
    type: opts.type,
    text: opts.text,
    data: opts.data,
    mentions: (opts.mentions || []).filter(isObjectId),
  });
  if (opts.touch !== false) {
    await JobApplication.updateOne(
      { _id: opts.app._id },
      { $set: { lastActivityAt: new Date(), lastActivity: opts.text.slice(0, 140) } }
    );
  }
}

// ── URLs ─────────────────────────────────────────────────────────────────

export function frontendUrl(path: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}${path}`;
}

export function publicJobUrl(orgSlugOrId: string, jobSlug: string): string {
  return frontendUrl(`/jobs/${orgSlugOrId}/${jobSlug}`);
}

// ── Emails ───────────────────────────────────────────────────────────────

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) =>
    key in vars ? vars[key] : m
  );
}

function emailHtml(body: string): string {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#111;max-width:560px">${paragraphs}</div>`;
}

/**
 * Send a candidate email from the office's template of that kind (or the
 * explicit template id). Never throws — a failed email must not undo a stage
 * move or a hire.
 */
export async function sendCandidateEmail(opts: {
  orgId: string;
  kind: EmailTemplateKind;
  to: string | undefined;
  vars: Record<string, string>;
  templateId?: string;
}): Promise<boolean> {
  if (!opts.to || !EMAIL_RE.test(opts.to)) return false;
  try {
    const settings = await getJobsSettings(opts.orgId);
    const template =
      (opts.templateId && settings.emailTemplates.find((t) => t.id === opts.templateId)) ||
      settings.emailTemplates.find((t) => t.kind === opts.kind) ||
      (() => {
        const d = DEFAULT_TEMPLATES.find((t) => t.kind === opts.kind);
        return d ? { id: "default", ...d } : null;
      })();
    if (!template) return false;
    const subject = renderTemplate(template.subject, opts.vars);
    const body = renderTemplate(template.body, opts.vars);
    const from = await senderForOrg(opts.orgId);
    await sendMail(opts.to, subject, emailHtml(body), body, from);
    return true;
  } catch (err: any) {
    console.error(`[jobs] ${opts.kind} email to ${opts.to} failed:`, err?.message);
    return false;
  }
}

/** Plain notification to hiring-team members (knockouts, mentions). */
export async function notifyUsersByEmail(
  orgId: string,
  userIds: string[],
  subject: string,
  body: string
): Promise<void> {
  const ids = [...new Set(userIds.filter(isObjectId))];
  if (!ids.length) return;
  try {
    const users = await User.find({ _id: { $in: ids } }).select("email").lean<any[]>();
    const from = await senderForOrg(orgId);
    await Promise.all(
      users
        .filter((u) => u.email && EMAIL_RE.test(u.email))
        .map((u) => sendMail(u.email, subject, emailHtml(body), body, from).catch(() => {}))
    );
  } catch (err: any) {
    console.error("[jobs] team notification failed:", err?.message);
  }
}

// ── Stage moves & rejection ──────────────────────────────────────────────

async function orgName(orgId: string | Types.ObjectId): Promise<string> {
  const { Organization } = await import("../models/organization.model");
  const org = await Organization.findById(orgId).select("name").lean<any>();
  return org?.name || "The team";
}

function emailVars(app: Pick<IJobApplication, "profile">, job: Pick<IJobPosting, "title">, company: string) {
  return { candidate_name: app.profile?.fullName || "there", job_title: job.title, company };
}

/**
 * Move an application to a stage, log it, and run what entering the stage
 * triggers: the "moved to interview" email and the stage's on-enter actions.
 */
export async function moveApplicationToStage(
  app: IJobApplication,
  job: IJobPosting,
  stageId: string,
  actor?: { id?: string; name?: string }
): Promise<void> {
  const stage = stageById(job, stageId);
  if (!stage) throw new Error("Stage not found");
  const from = stageById(job, app.stageId);
  const prevCategory = app.stageCategory;
  app.stageId = stage.id;
  app.stageCategory = stage.category;
  app.stageEnteredAt = new Date();
  app.maxStageRank = Math.max(app.maxStageRank || 0, STAGE_RANK[stage.category]);
  await app.save();
  await logActivity({
    app,
    type: "stage_moved",
    text: `Moved to ${stage.name}${from ? ` from ${from.name}` : ""}${actor?.name ? ` by ${actor.name}` : ""}`,
    actorId: actor?.id,
    data: { from: from?.id, to: stage.id },
  });

  const company = await orgName(job.orgId);
  const vars = emailVars(app, job, company);
  if (stage.category === "interview" && prevCategory !== "interview" && job.candidateEmails?.movedToInterview) {
    await sendCandidateEmail({ orgId: String(job.orgId), kind: "moved_to_interview", to: app.profile?.email, vars });
  }
  await runOnEnterActions(app, job, stage, vars);
}

export async function runOnEnterActions(
  app: Pick<IJobApplication, "profile">,
  job: IJobPosting,
  stage: IJobStage,
  vars: Record<string, string>
): Promise<void> {
  for (const action of stage.autoActions || []) {
    if (action.trigger !== "on_enter") continue;
    if (action.action === "send_email") {
      await sendCandidateEmail({
        orgId: String(job.orgId),
        kind: "custom",
        templateId: action.emailTemplateId,
        to: app.profile?.email,
        vars,
      });
    } else if (action.action === "remind_owner" && stage.ownerId) {
      await notifyUsersByEmail(
        String(job.orgId),
        [String(stage.ownerId)],
        `${app.profile?.fullName || "A candidate"} entered ${stage.name}`,
        `${app.profile?.fullName || "A candidate"} moved to ${stage.name} for ${job.title}.`
      );
    }
  }
}

/**
 * Reject an application. The candidate email waits for the job's delay (the
 * sweeper sends it) unless the delay is zero or `immediate` is set.
 */
export async function rejectApplicationWithEmail(
  app: IJobApplication,
  job: IJobPosting,
  opts: {
    reason?: string;
    note?: string;
    actor?: { id?: string; name?: string };
    sendEmail: boolean;
    delayEmail?: boolean;
    logText?: string;
  }
): Promise<void> {
  const now = new Date();
  const emailOn = opts.sendEmail && job.candidateEmails?.rejection !== false;
  const delayH = opts.delayEmail === false ? 0 : job.candidateEmails?.rejectionDelayHours ?? 24;
  app.status = "rejected";
  app.rejection = {
    reason: opts.reason,
    note: opts.note,
    at: now,
    by: opts.actor?.id ? new Types.ObjectId(opts.actor.id) : undefined,
    emailDueAt: emailOn ? new Date(now.getTime() + delayH * 3600000) : undefined,
  } as any;
  await app.save();
  await logActivity({
    app,
    type: "rejected",
    text:
      opts.logText ||
      `Rejected${opts.reason ? ` · ${opts.reason}` : ""}${opts.actor?.name ? ` by ${opts.actor.name}` : ""}`,
    actorId: opts.actor?.id,
  });
  if (emailOn && delayH === 0) {
    const sent = await sendCandidateEmail({
      orgId: String(job.orgId),
      kind: "rejection",
      to: app.profile?.email,
      vars: emailVars(app, job, await orgName(job.orgId)),
    });
    if (sent) await JobApplication.updateOne({ _id: app._id }, { $set: { "rejection.emailSentAt": new Date() } });
  }
}

// ── Interview meetings ───────────────────────────────────────────────────

/**
 * A Garage meeting for a video interview, created the same way POST
 * /meet/create does (join code → LiveKit room → Meet row). Returns the join
 * link, or undefined if the meeting could not be created — the interview is
 * still scheduled, just without a link.
 */
export async function createInterviewMeet(opts: {
  orgId: string;
  hostEmail: string;
  title: string;
  start: Date;
  durationMin: number;
}): Promise<string | undefined> {
  try {
    const { Meet } = await import("../models/meet.model");
    const { generateMeetJoinCode, generateMeetAgoraChannel } = await import("../utils/meetCode");
    const { createRoom } = await import("./livekit");
    const joinCode = generateMeetJoinCode();
    const roomName = generateMeetAgoraChannel(joinCode);
    await createRoom(roomName);
    await Meet.create({
      orgId: new Types.ObjectId(opts.orgId),
      hostEmail: opts.hostEmail.toLowerCase().trim(),
      title: opts.title.slice(0, 200),
      startTime: opts.start,
      endTime: new Date(opts.start.getTime() + opts.durationMin * 60000),
      joinCode,
      agoraChannel: roomName,
      status: "scheduled",
      isHostVerified: false,
    });
    return frontendUrl(`/meet/join?code=${joinCode}`);
  } catch (err: any) {
    console.error("[jobs] creating interview meeting failed:", err?.message);
    return undefined;
  }
}

/** Kill a cancelled interview's meeting so its emailed link stops working. */
export async function cancelInterviewMeet(meetingUrl?: string): Promise<void> {
  const code = meetingUrl?.match(/[?&]code=([^&#]+)/)?.[1];
  if (!code) return;
  try {
    const { Meet } = await import("../models/meet.model");
    await Meet.updateOne({ joinCode: decodeURIComponent(code) }, { $set: { status: "cancelled" } });
  } catch (err: any) {
    console.error("[jobs] cancelling interview meeting failed:", err?.message);
  }
}

export function formatWhen(date: Date, timezone?: string): string {
  try {
    return date.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "UTC",
      timeZoneName: "short",
    });
  } catch {
    return date.toUTCString();
  }
}

// ── Publishing ───────────────────────────────────────────────────────────

/** What still blocks publishing — empty means ready. */
export function publishProblems(job: IJobPosting, now = new Date()): string[] {
  const problems: string[] = [];
  if (!job.title?.trim()) problems.push("Add a job title.");
  if (job.workplace !== "remote" && !job.locations?.length) problems.push("Add at least one location.");
  if (!stripHtml(job.description?.aboutRole)) problems.push("Describe the role in the job description.");
  if (
    typeof job.salary?.min === "number" &&
    typeof job.salary?.max === "number" &&
    job.salary.min > job.salary.max
  ) {
    problems.push("Salary minimum is higher than the maximum.");
  }
  if (!answerableFieldCount(job)) problems.push("Add at least one field to the application form.");
  if (job.stages.length < 2) problems.push("The pipeline needs at least two stages.");
  if (job.stages[0]?.category !== "applied") problems.push("The first stage must be Applied.");
  if (job.stages[job.stages.length - 1]?.category !== "hired") problems.push("The last stage must be Hired.");
  if (job.reward?.enabled && !(job.reward.amount > 0)) problems.push("Set the referral reward per hire.");
  if (!job.channels?.garageHq && !job.channels?.university && !job.channels?.publicLink) {
    problems.push("Choose at least one place for the job to appear.");
  }
  if (job.publishMode === "scheduled" && (!job.publishAt || job.publishAt <= now)) {
    problems.push("Pick a future date and time to publish.");
  }
  if (job.closesAt && job.closesAt <= now) problems.push("The closing date must be in the future.");
  if (
    job.closesAt &&
    job.publishMode === "scheduled" &&
    job.publishAt &&
    job.closesAt <= job.publishAt
  ) {
    problems.push("The closing date must be after the publish date.");
  }
  return problems;
}
