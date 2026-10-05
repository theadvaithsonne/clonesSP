// Downline member profile → Live Streams tab and its per-session drill-down.
//
//   GET /affiliate/downline/:userId/live-streams
//   GET /affiliate/downline/:userId/live-streams/:workshopId/sessions
//
// Rows are the streams the member REGISTERED for (not just the ones with a
// paid invoice line), so free streams appear too. Backed by its own backend
// service, deliberately independent of the founder console's stream table.
//
// Called with garageAdminApi, not api(): the admin panel is a separate
// session with no user JWT. Both routes are guarded by
// requireUserOrGarageAdmin, which accepts either — same reasoning as
// downline-profile-api.ts beside it. `youEarned*` is the CALLER's
// commission, so it is zero for an admin.

import { garageAdminApi } from "@/lib/api";

export type MemberStreamStatus =
  | "active"
  | "completed"
  | "deleted"
  | "not_started";

export type MemberStreamFrequency = "one_time" | "recurring";

/** "na" on a non-recurring stream — the design's NA cell. */
export type MemberStreamEnrollment = "na" | "once" | "per_session";

export interface MemberLiveStreamRow {
  /** Workshop id on a stream row; `<workshopId>:<sessionISO>` on a session row. */
  id: string;
  workshopId: string;
  /** Session rows only. */
  sessionNumber?: number;
  sessionDate?: string | null;

  name: string;
  thumbnail: string | null;
  office: { id: string; name: string; icon: string | null } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    avatar: string | null;
  } | null;
  /** Host first, then co-hosts (whoever actually ran a session). Same shape
   *  as createdBy — two distinct accounts can share a name, so the email is
   *  what tells them apart. */
  speakers: {
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    avatar: string | null;
  }[];

  frequency: MemberStreamFrequency;
  enrollmentType: MemberStreamEnrollment;
  status: MemberStreamStatus;

  /** Null on a RECURRING stream row — the cell renders the drill-down button
   *  instead, because a series has many dates. */
  dateTime: {
    date: string;
    startTime: string;
    endTime: string;
    timezone: string;
  } | null;

  /** Null on a per-session stream row — the price is charged per session, so
   *  the series has no single figure. Its session rows carry one. */
  enrollmentPrice: { isFree: boolean; price: number; currency: string } | null;

  compPlan: { level: number; percentage: number }[];
  /** CENTS. */
  youEarnedFromEnrollment: number;
  earnedCurrency: string;
  affiliateUrl: string | null;

  /** "not_applicable" until the session has actually been delivered — a
   *  future date can't have been missed. */
  attendance: "attended" | "not_attended" | "not_applicable";

  liveSelling: { purchases: number; volumeUsd: number; youEarnedUsd: number };

  /** The MEMBER's enrolment state, distinct from `status` (the stream's).
   *  Rendered as a tag on the existing name/session cell, not a column. */
  enrolment: "registered" | "cancelled";

  rating: number | null;
  review: string | null;
}

export async function fetchMemberLiveStreams(
  userId: string,
): Promise<{ rows: MemberLiveStreamRow[] }> {
  const res = await garageAdminApi<{ success: boolean; rows: MemberLiveStreamRow[] }>(
    `/affiliate/downline/${encodeURIComponent(userId)}/live-streams`,
  );
  return { rows: res.rows ?? [] };
}

export async function fetchMemberLiveStreamSessions(
  userId: string,
  workshopId: string,
): Promise<{ rows: MemberLiveStreamRow[]; workshopTitle: string | null }> {
  const res = await garageAdminApi<{
    success: boolean;
    rows: MemberLiveStreamRow[];
    workshopTitle: string | null;
  }>(
    `/affiliate/downline/${encodeURIComponent(userId)}/live-streams/${encodeURIComponent(workshopId)}/sessions`,
  );
  return { rows: res.rows ?? [], workshopTitle: res.workshopTitle ?? null };
}
