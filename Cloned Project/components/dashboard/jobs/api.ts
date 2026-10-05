// Typed client for the Garage Jobs API (garagenew-backend /jobs/founder and
// /jobs). Nothing else in the app should hand-build these URLs.
//
// Unlike `api()` in lib/api, failures keep the whole JSON body: publishing
// answers 402 with the wallet balance, and submitting a form answers 422 with
// per-field errors — the screens need those, not just the message.

import { API_URL } from "@/lib/api";
import { getOrgId, getToken } from "@/lib/auth";
import type {
  AnalyticsResponse,
  ApplicationsResponse,
  CandidateProfileResponse,
  InterviewDetailResponse,
  Job,
  JobDetailResponse,
  OfficeMember,
  Offer,
  OverviewResponse,
  PayoutDetailResponse,
  PayoutsResponse,
  PipelineResponse,
  PostingsResponse,
  RewardSplitPreview,
  SettingsResponse,
  JobsSettings,
  StageCategory,
  TalentPoolResponse,
  EmailTemplate,
  FormPage,
  Interview,
  Reward,
  Application,
} from "./types";

export class JobsApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown>
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const base = (API_URL || "http://localhost:4000").replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new JobsApiError("Couldn't reach the server. Check your connection and try again.", 0, {});
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "";
    throw new JobsApiError(message || `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
};

const F = "/jobs/founder";
const body = (b: unknown) => JSON.stringify(b ?? {});

// ── Founder: overview & postings ─────────────────────────────────────────

export const getOverview = (jobId?: string) => request<OverviewResponse>(`${F}/overview${qs({ jobId })}`);

export const getPostings = (params: {
  status?: string;
  q?: string;
  department?: string;
  location?: string;
  postedBy?: string;
  sort?: string;
  page?: number;
}) => request<PostingsResponse>(`${F}/postings${qs(params)}`);

// ── Founder: jobs ────────────────────────────────────────────────────────

export const createJob = (title?: string) =>
  request<{ success: boolean; job: Job }>(`${F}/jobs`, { method: "POST", body: body({ title }) });

export const getJob = (id: string) => request<JobDetailResponse>(`${F}/jobs/${id}`);

export const updateJob = (id: string, patch: Record<string, unknown>) =>
  request<{ success: boolean; job: Job; problems: string[] }>(`${F}/jobs/${id}`, {
    method: "PATCH",
    body: body(patch),
  });

export const publishJob = (id: string) =>
  request<{ success: boolean; job: Job; publicUrl: string; heldAmount: number }>(`${F}/jobs/${id}/publish`, {
    method: "POST",
  });

export const pauseJob = (id: string) => request<{ success: boolean; job: Job }>(`${F}/jobs/${id}/pause`, { method: "POST" });
export const resumeJob = (id: string) => request<{ success: boolean; job: Job }>(`${F}/jobs/${id}/resume`, { method: "POST" });
export const closeJob = (id: string) =>
  request<{ success: boolean; job: Job; released: number }>(`${F}/jobs/${id}/close`, { method: "POST" });
export const duplicateJob = (id: string) =>
  request<{ success: boolean; job: Job }>(`${F}/jobs/${id}/duplicate`, { method: "POST" });
export const deleteJob = (id: string) => request<{ success: boolean }>(`${F}/jobs/${id}`, { method: "DELETE" });

export const getPipeline = (
  id: string,
  params: { q?: string; source?: string; minMatch?: number; tag?: string; sort?: string } = {}
) => request<PipelineResponse>(`${F}/jobs/${id}/pipeline${qs(params)}`);

export const getJobAnalytics = (id: string, days = 30) =>
  request<AnalyticsResponse>(`${F}/jobs/${id}/analytics${qs({ days })}`);

export const getRewardPreview = (amount: number) =>
  request<{ success: boolean; preview: RewardSplitPreview }>(`${F}/reward-preview${qs({ amount })}`);

export const generateDescription = (payload: {
  title: string;
  department?: string;
  seniority?: string;
  tone: "professional" | "friendly" | "bold";
  notes?: string;
  skills: string[];
  workplace?: string;
  locations: string[];
  employmentType?: string;
}) =>
  request<{
    success: boolean;
    draft: Job["description"];
    suggestedSkills: string[];
  }>(`${F}/ai/description`, { method: "POST", body: body(payload) });

// ── Founder: applications ────────────────────────────────────────────────

export type ApplicationQuery = {
  jobId?: string;
  stage?: StageCategory | "";
  status?: string;
  source?: string;
  minMatch?: number;
  appliedWithin?: number;
  tag?: string;
  q?: string;
  view?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

export const getApplications = (params: ApplicationQuery) =>
  request<ApplicationsResponse>(`${F}/applications${qs(params)}`);

/** CSV of the filtered list (or of `ids`) — fetched with the auth header, saved as a file. */
export async function downloadApplicationsCsv(params: ApplicationQuery & { ids?: string[] }) {
  const token = getToken();
  const base = (API_URL || "http://localhost:4000").replace(/\/+$/, "");
  const { ids, ...rest } = params;
  const res = await fetch(`${base}${F}/applications/export${qs({ ...rest, ids: ids?.join(",") })}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new JobsApiError("Couldn't export the applications.", res.status, {});
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const bulkApplications = (payload: {
  ids: string[];
  action: "move" | "reject" | "tag" | "untag" | "star" | "unstar" | "email";
  category?: StageCategory;
  tag?: string;
  reason?: string;
  subject?: string;
  body?: string;
}) =>
  request<{ success: boolean; updated: number; skipped?: string[] }>(`${F}/applications/bulk`, {
    method: "POST",
    body: body(payload),
  });

export const getCandidateProfile = (appId: string) =>
  request<CandidateProfileResponse>(`${F}/applications/${appId}`);

export const updateApplication = (appId: string, patch: { tags?: string[]; starred?: boolean }) =>
  request<{ success: boolean; application: Application }>(`${F}/applications/${appId}`, {
    method: "PATCH",
    body: body(patch),
  });

export const moveApplication = (appId: string, payload: { stageId: string; note?: string; notifyTeam?: boolean }) =>
  request<{ success: boolean; application: Application }>(`${F}/applications/${appId}/move`, {
    method: "POST",
    body: body(payload),
  });

export const rejectApplication = (appId: string, payload: { reason?: string; note?: string; sendEmail?: boolean }) =>
  request<{ success: boolean; application: Application }>(`${F}/applications/${appId}/reject`, {
    method: "POST",
    body: body(payload),
  });

export const restoreApplication = (appId: string) =>
  request<{ success: boolean; application: Application }>(`${F}/applications/${appId}/restore`, { method: "POST" });

export const addNote = (appId: string, text: string, mentions: string[]) =>
  request<{ success: boolean; notes: CandidateProfileResponse["notes"] }>(`${F}/applications/${appId}/notes`, {
    method: "POST",
    body: body({ text, mentions }),
  });

export const scheduleInterview = (
  appId: string,
  payload: {
    stageId?: string;
    interviewerIds: string[];
    mode: "video" | "in_person" | "phone";
    durationMin: number;
    slots: string[];
    candidatePicks: boolean;
    location?: string;
    message?: string;
    timezone?: string;
  }
) =>
  request<{ success: boolean; interview: Interview }>(`${F}/applications/${appId}/interviews`, {
    method: "POST",
    body: body(payload),
  });

export const getInterview = (id: string) => request<InterviewDetailResponse>(`${F}/interviews/${id}`);

export const updateInterview = (id: string, patch: { status?: "cancelled" | "completed"; scheduledAt?: string }) =>
  request<{ success: boolean; interview: Interview }>(`${F}/interviews/${id}`, { method: "PATCH", body: body(patch) });

export const saveScorecard = (
  id: string,
  payload: {
    ratings: Array<{ criterion: string; score: number; note?: string }>;
    recommendation?: "strong_no" | "no" | "yes" | "strong_yes";
    privateNote?: string;
    submit: boolean;
  }
) => request<{ success: boolean; interview: Interview }>(`${F}/interviews/${id}/scorecard`, { method: "POST", body: body(payload) });

export const createOffer = (
  appId: string,
  payload: {
    role: string;
    ctc: number;
    currency: string;
    joiningDate?: string;
    expiresAt?: string;
    letter?: { url: string; name: string; size?: number };
    message?: string;
  }
) => request<{ success: boolean; offer: Offer }>(`${F}/applications/${appId}/offers`, { method: "POST", body: body(payload) });

export const withdrawOffer = (offerId: string) =>
  request<{ success: boolean; offer: Offer }>(`${F}/offers/${offerId}`, { method: "PATCH", body: body({ status: "withdrawn" }) });

export const hireApplication = (appId: string, joiningDate: string) =>
  request<{ success: boolean; application: Application; reward: Reward | null; filled: boolean }>(
    `${F}/applications/${appId}/hire`,
    { method: "POST", body: body({ joiningDate }) }
  );

export const updateJoiningDate = (appId: string, joiningDate: string) =>
  request<{ success: boolean; application: Application; reward: Reward | null }>(
    `${F}/applications/${appId}/joining-date`,
    { method: "POST", body: body({ joiningDate }) }
  );

// ── Founder: payouts & talent pool ───────────────────────────────────────

export const getPayouts = (status = "all") => request<PayoutsResponse>(`${F}/payouts${qs({ status })}`);
export const getPayout = (id: string) => request<PayoutDetailResponse>(`${F}/payouts/${id}`);
export const markLeftEarly = (id: string, reason?: string) =>
  request<{ success: boolean; reward: Reward }>(`${F}/payouts/${id}/left-early`, { method: "POST", body: body({ reason }) });

export const getTalentPool = (params: {
  q?: string;
  tag?: string;
  minExp?: number;
  maxExp?: number;
  location?: string;
  appliedWithin?: number;
}) => request<TalentPoolResponse>(`${F}/talent-pool${qs(params)}`);

export const inviteFromTalentPool = (candidateIds: string[], jobId: string) =>
  request<{ success: boolean; sent: number }>(`${F}/talent-pool/invite`, {
    method: "POST",
    body: body({ candidateIds, jobId }),
  });

// ── Founder: settings ────────────────────────────────────────────────────

/** Settings writes answer with the saved settings only (no office / URLs). */
export type SettingsSaveResponse = { success: boolean; settings: JobsSettings };

export const getSettings = () => request<SettingsResponse>(`${F}/settings`);

export const saveCareersPage = (payload: {
  coverImage?: string | null;
  headline?: string;
  about?: string;
  culturePhotos?: string[];
  perks?: string[];
  showRewards?: boolean;
}) => request<SettingsSaveResponse>(`${F}/settings/careers-page`, { method: "PUT", body: body(payload) });

export const saveEmailTemplates = (templates: EmailTemplate[]) =>
  request<SettingsSaveResponse>(`${F}/settings/email-templates`, { method: "PUT", body: body({ templates }) });

export const saveRejectionReasons = (reasons: Array<{ id: string; label: string }>) =>
  request<SettingsSaveResponse>(`${F}/settings/rejection-reasons`, { method: "PUT", body: body({ reasons }) });

export const saveForm = (name: string, pages: FormPage[]) =>
  request<SettingsSaveResponse>(`${F}/settings/saved-forms`, { method: "POST", body: body({ name, pages }) });

export const deleteSavedForm = (formId: string) =>
  request<SettingsSaveResponse>(`${F}/settings/saved-forms/${formId}`, { method: "DELETE" });

export const saveDefaultPipeline = (stages: Array<{ name: string; category: StageCategory; ownerId?: string | null }>) =>
  request<SettingsSaveResponse>(`${F}/settings/default-pipeline`, { method: "PUT", body: body({ stages }) });

export const savePrivacy = (payload: { retentionMonths: number; allowDeletionRequests: boolean; consentAddition: string }) =>
  request<SettingsSaveResponse>(`${F}/settings/privacy`, { method: "PUT", body: body(payload) });

// ── Existing Garage endpoints the Jobs screens read ──────────────────────

/** Office members — the only people who can join a hiring team. */
export async function getOfficeMembers(): Promise<OfficeMember[]> {
  const orgId = getOrgId();
  if (!orgId) return [];
  const res = await request<{ members: OfficeMember[] }>(`/team/list${qs({ orgId })}`);
  return (res.members || []).filter((m) => !m.guest);
}

/** The founder's GaragePay (USD store wallet) balance for this office. */
export async function getGaragePayBalance(): Promise<number> {
  const orgId = getOrgId();
  if (!orgId) return 0;
  try {
    const res = await request<{ balance?: number }>(`/wallet/store/balance${qs({ orgId, currency: "USD" })}`);
    return Number(res.balance || 0);
  } catch {
    return 0;
  }
}
