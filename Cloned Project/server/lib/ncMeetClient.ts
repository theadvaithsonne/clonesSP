/**
 * Thin client for contacts-backend's Garage service endpoints
 * (`/service/garage/meet/*`). Auth is a shared service token — see that
 * repo's middleware/garageService.ts.
 *
 * Every call has a hard timeout: the affiliates list enriches rows through
 * this client, and a hung NetworkChains must degrade the column, not stall
 * the admin table.
 */
const NC_BASE = process.env.NC_BACKEND_URL || "https://backend.networkchains.com";
const SERVICE_TOKEN = process.env.GARAGE_SERVICE_TOKEN || "";
const TIMEOUT_MS = 8000;

export class NcMeetError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NcMeetError";
    this.status = status;
  }
}

async function ncFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SERVICE_TOKEN) {
    throw new NcMeetError("GARAGE_SERVICE_TOKEN is not configured", 503);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${NC_BASE}/service/garage/meet${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": SERVICE_TOKEN,
        ...(init.headers || {}),
      },
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: T; error?: string }
      | null;
    if (!res.ok || !body?.ok) {
      throw new NcMeetError(body?.error || `NetworkChains request failed`, res.status);
    }
    return body.data as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface NcHost { userId: string; orgId: string; name?: string; email?: string }
export interface NcScheduleSummary {
  scheduleId: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  startedAt: string | null;
  durationMinutes: number;
  timeZone: string | null;
}
export interface NcScheduleStatus {
  scheduleId: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  isLive: boolean;
  status: "not_scheduled" | "scheduled" | "started" | "completed";
}

export const ncHostByEmail = (email: string) =>
  ncFetch<{ user: NcHost | null }>(`/host-by-email?email=${encodeURIComponent(email)}`);

export const ncHostSchedules = (ncUserId: string, days = 60) =>
  ncFetch<{ schedules: NcScheduleSummary[] }>(
    `/hosts/${encodeURIComponent(ncUserId)}/schedules?days=${days}`,
  );

export const ncCreateSchedule = (
  ncUserId: string,
  body: {
    title: string;
    scheduledAt: string;
    durationMinutes?: number;
    timeZone?: string;
    description?: string;
    attendees?: { email: string; displayName?: string }[];
  },
) =>
  ncFetch<NcScheduleSummary & { meetLink: string }>(
    `/hosts/${encodeURIComponent(ncUserId)}/schedules`,
    { method: "POST", body: JSON.stringify(body) },
  );

export const ncAddAttendee = (scheduleId: string, email: string, displayName?: string) =>
  ncFetch<{ added: boolean; attendees: { email: string; displayName?: string }[] }>(
    `/schedules/${encodeURIComponent(scheduleId)}/attendees`,
    { method: "POST", body: JSON.stringify({ email, displayName }) },
  );

export const ncScheduleStatuses = (scheduleIds: string[]) =>
  ncFetch<{ statuses: NcScheduleStatus[] }>(`/schedules/status`, {
    method: "POST",
    body: JSON.stringify({ scheduleIds }),
  });

export const ncRescheduleSchedule = (
  scheduleId: string,
  body: {
    title?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    timeZone?: string;
    description?: string;
  },
) =>
  ncFetch<NcScheduleSummary>(`/schedules/${encodeURIComponent(scheduleId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const ncScheduleRelated = (scheduleId: string) =>
  ncFetch<Record<string, unknown>>(
    `/schedules/${encodeURIComponent(scheduleId)}/related`,
  );
