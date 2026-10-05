import { garageAdminApi } from "@/lib/api";

export type IgniteStatus = "not_scheduled" | "scheduled" | "started" | "completed";

/** The only place the wire enum becomes display text. */
export const IGNITE_STATUS_LABEL: Record<IgniteStatus, string> = {
  not_scheduled: "Not Scheduled",
  scheduled: "Scheduled",
  started: "Started",
  completed: "Completed",
};

export type IgniteCallAdmin = {
  name: string | null;
  email: string | null;
  profilePicture: string | null;
};

export type IgniteCallSummary = {
  id: string;
  adminId: string;
  admin: IgniteCallAdmin | null;
  ncScheduleId: string;
  ncRoomId: string;
  title: string;
  scheduledAt: string;
  status: IgniteStatus;
  startedAt: string | null;
  endedAt: string | null;
  historyCount: number;
  /** Set when an operator marked this call complete by hand. */
  manuallyCompletedAt?: string | null;
};

/**
 * A catch-up hosted by an admin, offered as a pick target in the Ignite call
 * picker. Does NOT carry attendees — that field was removed from the backend
 * response because it leaked every attendee email of every catch-up an admin
 * hosts. Nothing in the UI needs it.
 */
export type AdminCatchup = {
  scheduleId: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  startedAt: string | null;
  durationMinutes: number;
  timeZone: string | null;
};

export type IgniteCallRelated = {
  call: { id: string; title: string; manuallyCompletedAt?: string | null };
  related: {
    status: IgniteStatus;
    scheduledAt: string;
    startedAt: string | null;
    endedAt: string | null;
    // Projected on the backend to exactly these fields — no attendees,
    // orgId or description (see MINOR 8: that leaked every attendee email
    // of every catch-up the host runs).
    schedule: {
      _id: string;
      roomId: string;
      title: string;
      scheduledAt: string;
      startedAt: string | null;
      durationMinutes: number;
      timeZone?: string | null;
    };
    sessions: {
      _id: string;
      startedAt: string;
      endedAt: string | null;
      durationSeconds?: number;
      participants?: { name?: string; identity?: string; isHost?: boolean }[];
    }[];
    recordings: {
      id: string;
      displayName?: string;
      size?: number;
      duration?: number;
      createdAt: string;
      url: string | null;
    }[];
    noteSessions: {
      _id: string;
      title?: string;
      startedAt: string;
      endedAt: string | null;
      status: string;
      participants?: { name?: string; email?: string }[];
      transcript: {
        fullText: string;
        segments?: {
          speaker: string;
          speakerName?: string;
          startTime: number;
          endTime: number;
          text: string;
          confidence?: number;
        }[];
      } | null;
      summary: {
        overview: string;
        keyTopics: string[];
        actionItems: { description: string; assignee?: string; deadline?: string }[];
        decisions: string[];
        questions: string[];
        markdownSummary: string;
      } | null;
    }[];
  } | null;
  unavailableReason?: string;
};

/** Step 2 of the picker. `host: null` = this admin has no NetworkChains account. */
export function listAdminCatchups(adminId: string) {
  return garageAdminApi<{
    data: { host: { userId: string; name?: string; email?: string } | null; schedules: AdminCatchup[] };
  }>(`/garage-admin/admins/${encodeURIComponent(adminId)}/catchups`).then((r) => r.data);
}

export function attachIgniteCall(
  userId: string,
  body: {
    adminId: string;
    ncScheduleId?: string;
    createSchedule?: {
      title: string;
      scheduledAt: string;
      durationMinutes?: number;
      timeZone?: string;
      description?: string;
    };
  },
) {
  return garageAdminApi<{ data: IgniteCallSummary }>(
    `/garage-admin/users/${encodeURIComponent(userId)}/ignite-call`,
    { method: "POST", body: JSON.stringify(body) },
  ).then((r) => r.data);
}

export function detachIgniteCall(userId: string, id: string) {
  return garageAdminApi<{ data: { id: string } }>(
    `/garage-admin/users/${encodeURIComponent(userId)}/ignite-call/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  ).then((r) => r.data);
}

/**
 * Move an attached Ignite call. The backend updates NetworkChains (which
 * re-syncs the Google invite) and then our snapshot. A call that has already
 * started is rejected — you cannot move a meeting that ran.
 */
export function rescheduleIgniteCall(
  userId: string,
  id: string,
  body: {
    title?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    timeZone?: string;
  },
) {
  return garageAdminApi<{
    data: {
      id: string;
      ncScheduleId: string;
      title: string;
      scheduledAt: string;
      durationMinutes: number;
    };
  }>(
    `/garage-admin/users/${encodeURIComponent(userId)}/ignite-call/${encodeURIComponent(id)}/reschedule`,
    { method: "PATCH", body: JSON.stringify(body) },
  ).then((r) => r.data);
}

/**
 * Manually mark a call complete (or undo it). Used when the call happened
 * off-platform, or the room never stamped a session, so the derived status
 * cannot see that it finished.
 */
export function setIgniteCallCompleted(userId: string, id: string, completed: boolean) {
  return garageAdminApi<{ data: { id: string; manuallyCompletedAt: string | null } }>(
    `/garage-admin/users/${encodeURIComponent(userId)}/ignite-call/${encodeURIComponent(id)}/complete`,
    { method: "POST", body: JSON.stringify({ completed }) },
  ).then((r) => r.data);
}

export function listIgniteCalls(userId: string) {
  return garageAdminApi<{
    data: {
      calls: (Omit<IgniteCallSummary, "status" | "startedAt" | "endedAt" | "historyCount"> & {
        detachedAt: string | null;
      })[];
    };
  }>(`/garage-admin/users/${encodeURIComponent(userId)}/ignite-calls`).then((r) => r.data.calls);
}

export function getIgniteCallRelated(id: string) {
  return garageAdminApi<{ data: IgniteCallRelated }>(
    `/garage-admin/ignite-call/${encodeURIComponent(id)}/related`,
  ).then((r) => r.data);
}
