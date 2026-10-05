// Labels and small lookups shared by the Jobs screens.

import type {
  ApplicationSource,
  EmploymentType,
  JobFieldType,
  JobStatus,
  StageCategory,
  TeamRole,
  WorkplaceType,
  FormField,
  FormPage,
} from "./types";

export const JOB_PAGES = {
  overview: "Founder:Jobs",
  postings: "Founder:Jobs:Postings",
  wizard: "Founder:Jobs:New",
  job: "Founder:Jobs:Job",
  scorecard: "Founder:Jobs:Scorecard",
  applications: "Founder:Jobs:Applications",
  talentPool: "Founder:Jobs:TalentPool",
  payouts: "Founder:Jobs:Payouts",
  settings: "Founder:Jobs:Settings",
} as const;

export const STATUS_META: Record<JobStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "rgba(161,161,170,0.12)", fg: "#a1a1aa" },
  scheduled: { label: "Scheduled", bg: "rgba(96,165,250,0.12)", fg: "#93c5fd" },
  live: { label: "Live", bg: "rgba(34,197,94,0.12)", fg: "#4ade80" },
  paused: { label: "Paused", bg: "rgba(245,158,11,0.12)", fg: "#fbbf24" },
  closed: { label: "Closed", bg: "rgba(161,161,170,0.12)", fg: "#a1a1aa" },
  filled: { label: "Filled", bg: "rgba(167,139,250,0.14)", fg: "#c4b5fd" },
  expired: { label: "Expired", bg: "rgba(248,113,113,0.12)", fg: "#f87171" },
};

export const STAGE_CATEGORIES: StageCategory[] = [
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "hired",
];

export const CATEGORY_META: Record<StageCategory, { label: string; color: string }> = {
  applied: { label: "Applied", color: "#60a5fa" },
  screening: { label: "Screening", color: "#818cf8" },
  assessment: { label: "Assessment", color: "#a78bfa" },
  interview: { label: "Interview", color: "#f59e0b" },
  offer: { label: "Offer", color: "#fb923c" },
  hired: { label: "Hired", color: "#22c55e" },
};

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  garage_hq: "Garage HQ",
  university: "Garage University",
  public_link: "Public link",
  careers_page: "Careers page",
  referral: "Referral",
  talent_pool: "Talent pool",
};

export const SOURCE_COLORS: Record<ApplicationSource, string> = {
  referral: "var(--brand)",
  garage_hq: "#60a5fa",
  university: "#818cf8",
  public_link: "#71717a",
  careers_page: "#a1a1aa",
  talent_pool: "#22c55e",
};

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  hybrid: "Hybrid",
  remote: "Remote",
  onsite: "On-site",
};

export const TEAM_ROLE_META: Record<TeamRole, { label: string; access: string }> = {
  hiring_manager: { label: "Hiring manager", access: "Full access" },
  recruiter: { label: "Recruiter", access: "Manage candidates" },
  interviewer: { label: "Interviewer", access: "Assigned candidates only" },
};

export const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

/** The field library, grouped the way the builder's palette shows it. */
export const FIELD_GROUPS: Array<{ title: string; types: Array<{ type: JobFieldType; label: string }> }> = [
  {
    title: "Basic",
    types: [
      { type: "short_text", label: "Short text" },
      { type: "long_text", label: "Long text" },
      { type: "number", label: "Number" },
      { type: "email", label: "Email" },
      { type: "phone", label: "Phone" },
      { type: "date", label: "Date" },
      { type: "url", label: "URL / link" },
    ],
  },
  {
    title: "Choice",
    types: [
      { type: "single_choice", label: "Single choice" },
      { type: "checkboxes", label: "Checkboxes" },
      { type: "dropdown", label: "Dropdown" },
      { type: "yes_no", label: "Yes / No" },
      { type: "rating", label: "Rating scale" },
      { type: "ranking", label: "Ranking" },
    ],
  },
  {
    title: "Files",
    types: [
      { type: "resume", label: "Resume / CV" },
      { type: "file_upload", label: "File upload" },
      { type: "portfolio_link", label: "Portfolio link" },
      { type: "video_answer", label: "Video answer" },
    ],
  },
  {
    title: "Assessment",
    types: [{ type: "quiz_mcq", label: "Scored quiz MCQ" }],
  },
  {
    title: "Profile · auto-filled",
    types: [
      { type: "profile_full_name", label: "Full name" },
      { type: "profile_email", label: "Email" },
      { type: "profile_phone", label: "Phone" },
      { type: "profile_location", label: "Current location" },
      { type: "profile_company", label: "Current company" },
      { type: "profile_experience", label: "Total experience" },
      { type: "profile_current_ctc", label: "Current CTC" },
      { type: "profile_expected_ctc", label: "Expected CTC" },
      { type: "profile_notice_period", label: "Notice period" },
      { type: "profile_linkedin", label: "LinkedIn" },
    ],
  },
  {
    title: "Layout",
    types: [
      { type: "section_heading", label: "Section heading" },
      { type: "info_text", label: "Info text" },
      { type: "declaration", label: "Declaration / consent" },
    ],
  },
];

export const FIELD_LABELS: Record<JobFieldType, string> = Object.fromEntries(
  FIELD_GROUPS.flatMap((g) => g.types.map((t) => [t.type, t.label]))
) as Record<JobFieldType, string>;

export const CHOICE_TYPES: JobFieldType[] = ["single_choice", "checkboxes", "dropdown", "ranking", "quiz_mcq"];
export const FILE_TYPES: JobFieldType[] = ["resume", "file_upload", "video_answer"];
export const LAYOUT_TYPES: JobFieldType[] = ["section_heading", "info_text"];

export function newId(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}${rand}`;
}

/** A fresh field of `type` with sensible defaults for the builder. */
export function makeField(type: JobFieldType): FormField {
  const base: FormField = {
    id: newId("fld_"),
    type,
    label: FIELD_LABELS[type] || "Question",
    required: false,
    locked: false,
    options: [],
    fileTypes: [],
    multiple: false,
    parseResume: false,
    talentPoolConsent: false,
  };
  if (CHOICE_TYPES.includes(type)) {
    base.options = [
      { id: newId("opt_"), label: "Option 1" },
      { id: newId("opt_"), label: "Option 2" },
    ];
  }
  if (type === "quiz_mcq") base.label = "Question";
  if (type === "resume") {
    base.fileTypes = ["pdf", "docx"];
    base.maxSizeMb = 10;
    base.required = true;
  }
  if (type === "file_upload") {
    base.fileTypes = ["pdf", "docx", "png", "jpg"];
    base.maxSizeMb = 10;
  }
  if (type === "video_answer") {
    base.fileTypes = ["mp4", "mov", "webm"];
    base.maxSizeMb = 100;
  }
  if (type === "rating") base.scaleMax = 5;
  if (type === "declaration") base.label = "I confirm the information I've provided is accurate.";
  if (type === "section_heading") base.label = "Section heading";
  if (type === "info_text") base.label = "Add some context for candidates.";
  return base;
}

/**
 * Starter structures for the application form. These are layouts, not
 * content — every question is the founder's to edit.
 */
export const FORM_TEMPLATES: Array<{ id: string; name: string; description: string; build: (consent: string) => FormPage[] }> = [
  {
    id: "simple",
    name: "Simple application",
    description: "Profile, resume and consent",
    build: (consent) => [
      page("About you", [
        req(makeField("profile_full_name")),
        req(makeField("profile_email")),
        req(makeField("profile_phone")),
        makeField("profile_location"),
      ]),
      page("Your work", [makeField("resume")]),
      consentPage(consent),
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio review",
    description: "Adds portfolio link, case studies and a long answer",
    build: (consent) => [
      page("About you", [
        req(makeField("profile_full_name")),
        req(makeField("profile_email")),
        req(makeField("profile_phone")),
        makeField("profile_location"),
        makeField("profile_experience"),
        makeField("profile_notice_period"),
      ]),
      page("Your work", [
        makeField("resume"),
        req(makeField("portfolio_link")),
        { ...makeField("file_upload"), label: "Case studies", multiple: true },
        { ...makeField("long_text"), label: "Tell us about a project you're proud of", maxLength: 1500 },
      ]),
      consentPage(consent),
    ],
  },
  {
    id: "graduate",
    name: "Graduate role",
    description: "Education-first, with a short motivation answer",
    build: (consent) => [
      page("About you", [
        req(makeField("profile_full_name")),
        req(makeField("profile_email")),
        req(makeField("profile_phone")),
        makeField("profile_location"),
      ]),
      page("Education", [
        { ...makeField("short_text"), label: "Highest qualification", required: true },
        { ...makeField("short_text"), label: "Institution" },
        { ...makeField("number"), label: "Year of graduation" },
        makeField("resume"),
      ]),
      page("Motivation", [{ ...makeField("long_text"), label: "Why this role?", required: true, maxLength: 1000 }]),
      consentPage(consent),
    ],
  },
  {
    id: "engineering",
    name: "Engineering screen",
    description: "Experience, links and a timed quiz page",
    build: (consent) => [
      page("About you", [
        req(makeField("profile_full_name")),
        req(makeField("profile_email")),
        req(makeField("profile_phone")),
        makeField("profile_experience"),
        makeField("profile_expected_ctc"),
        makeField("profile_notice_period"),
      ]),
      page("Your work", [
        makeField("resume"),
        { ...makeField("url"), label: "GitHub or code sample" },
        makeField("profile_linkedin"),
      ]),
      { ...page("Technical quiz", [makeField("quiz_mcq"), makeField("quiz_mcq")]), timeLimitMinutes: 10, passMark: 1 },
      consentPage(consent),
    ],
  },
];

function page(title: string, fields: FormField[]): FormPage {
  return { id: newId("pg_"), title, fields };
}

function req(f: FormField): FormField {
  return { ...f, required: true };
}

function consentPage(consent: string): FormPage {
  return page("Declaration", [
    { ...makeField("declaration"), label: consent, required: true, locked: true },
    { ...makeField("declaration"), label: "Keep me in the talent pool for future roles.", talentPoolConsent: true },
  ]);
}
