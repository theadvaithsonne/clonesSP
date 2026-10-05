// Typed client for the candidate side of Garage Jobs (garagenew-backend
// routes/jobsCandidate.ts, mounted at /jobs). Failures keep the whole JSON
// body (JobsApiError.data): applying answers 409 with the existing
// applicationId, 410 when the job closed, and 422 with per-field errors.

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { JobsApiError } from "../api";
import type { Answer } from "../types";
import type {
  AlertCriteria,
  AlertFrequency,
  ApplyResponse,
  ApplySource,
  DiscoverResponse,
  JobAlert,
  JobViewResponse,
  MyApplication,
  PublicJob,
} from "./candidateTypes";

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

const qs = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
};

const body = (b: unknown) => JSON.stringify(b ?? {});

// ── Discover & job pages ─────────────────────────────────────────────────

export type DiscoverQuery = {
  q?: string;
  location?: string;
  /** Comma-separated lists. */
  workplace?: string;
  employmentType?: string;
  department?: string;
  experience?: number;
  salaryMin?: number;
  postedWithin?: number;
  sort?: "reward";
  page?: number;
  limit?: number;
};

export const discoverJobs = (params: DiscoverQuery) => request<DiscoverResponse>(`/jobs/discover${qs(params)}`);

export const getJobView = (jobId: string) => request<JobViewResponse>(`/jobs/view/${jobId}`);

/** Count a job view for the office's analytics. Best effort — never throws. */
export async function recordJobView(jobId: string, source?: string): Promise<void> {
  try {
    await request(`/jobs/public/job/${jobId}/view`, { method: "POST", body: body({ source }) });
  } catch {
    /* analytics only */
  }
}

// ── Apply ────────────────────────────────────────────────────────────────

export const getApply = (jobId: string) => request<ApplyResponse>(`/jobs/apply/${jobId}`);

type ApplyBody = { answers: Answer[]; page?: number; ref?: string; source?: ApplySource };

export const saveApplyDraft = (jobId: string, payload: ApplyBody) =>
  request<{ success: boolean; draftId: string }>(`/jobs/apply/${jobId}/draft`, { method: "PUT", body: body(payload) });

export const submitApplication = (jobId: string, payload: ApplyBody) =>
  request<{ success: boolean; application: { _id: string; reference: string; appliedAt: string } }>(
    `/jobs/apply/${jobId}/submit`,
    { method: "POST", body: body(payload) }
  );

// ── My applications ──────────────────────────────────────────────────────

export const getMyApplications = () => request<{ success: boolean; applications: MyApplication[] }>(`/jobs/me/applications`);

export const withdrawApplication = (id: string) =>
  request<{ success: boolean; deleted?: boolean }>(`/jobs/me/applications/${id}/withdraw`, { method: "POST" });

export const pickInterviewSlot = (interviewId: string, slot: string) =>
  request<{ success: boolean; interview: { _id: string; scheduledAt: string; status: string } }>(
    `/jobs/me/interviews/${interviewId}/pick`,
    { method: "POST", body: body({ slot }) }
  );

export const respondToOffer = (offerId: string, accept: boolean, reason?: string) =>
  request<{ success: boolean }>(`/jobs/me/offers/${offerId}/respond`, { method: "POST", body: body({ accept, reason }) });

// ── Saved jobs & alerts ──────────────────────────────────────────────────

export const getSavedJobs = () => request<{ success: boolean; jobs: PublicJob[] }>(`/jobs/me/saved`);
export const saveJob = (jobId: string) => request<{ success: boolean }>(`/jobs/me/saved`, { method: "POST", body: body({ jobId }) });
export const unsaveJob = (jobId: string) => request<{ success: boolean }>(`/jobs/me/saved/${jobId}`, { method: "DELETE" });

export const getAlerts = () => request<{ success: boolean; alerts: JobAlert[] }>(`/jobs/me/alerts`);

export const createAlert = (payload: { name?: string; criteria: AlertCriteria; frequency: AlertFrequency; weekday?: number }) =>
  request<{ success: boolean; alert: JobAlert }>(`/jobs/me/alerts`, { method: "POST", body: body(payload) });

export const updateAlert = (
  id: string,
  patch: Partial<{ name: string; criteria: AlertCriteria; frequency: AlertFrequency; weekday: number; active: boolean }>
) => request<{ success: boolean; alert: JobAlert }>(`/jobs/me/alerts/${id}`, { method: "PATCH", body: body(patch) });

export const deleteAlert = (id: string) => request<{ success: boolean }>(`/jobs/me/alerts/${id}`, { method: "DELETE" });
