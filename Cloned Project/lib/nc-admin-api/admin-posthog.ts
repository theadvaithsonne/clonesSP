/**
 * Admin PostHog session-replay API client, ported from the NC web app. Talks to
 * contacts-backend's /admin/posthog/* proxy (which holds the PostHog personal
 * API key server-side), using the admin OTP token there — same plumbing as
 * `admin-sentry.ts`. Read-only except `getEmbed`, which enables sharing on a
 * recording so the panel can iframe PostHog's own player.
 *
 * Identical surface to networkchains-web-app `lib/api/admin-posthog.ts` so the
 * ported page imports the same names — only the transport changed: auth now
 * comes from ./auth (garage→NC silent elevation) instead of the NC OTP flow.
 */

import { ncAdminFetchRaw, NcAdminApiError } from "./auth";

// ── Models (PostHog shapes — kept loose where fields vary by version) ─────────

export interface PostHogPerson {
  id?: string;
  name?: string;
  distinct_ids?: string[];
  properties?: Record<string, unknown>;
}

export interface PostHogRecording {
  id: string;
  distinct_id?: string;
  start_time?: string;
  end_time?: string;
  /** Total duration in seconds. */
  recording_duration?: number;
  active_seconds?: number;
  click_count?: number;
  keypress_count?: number;
  mouse_activity_count?: number;
  console_error_count?: number;
  console_warn_count?: number;
  start_url?: string;
  person?: PostHogPerson;
  viewed?: boolean;
}

export interface RecordingsPage {
  results: PostHogRecording[];
  has_next?: boolean;
}

export interface EmbedInfo {
  embedUrl: string;
  accessToken: string;
  /** Public, login-free link to the recording (PostHog's share URL). */
  shareUrl?: string;
  /** Opens the recording inside PostHog itself — where the Console tab shows
   *  the console.error() output the API doesn't expose. Needs a PostHog login. */
  posthogUrl?: string;
}

/** One distinct `$exception` captured during a session, already grouped by
 *  type+message server-side with its occurrence count and first/last seen. */
export interface SessionException {
  type: string;
  message: string;
  occurrences: number;
  firstSeen: string | null;
  lastSeen: string | null;
  url: string | null;
}

export interface PostHogStats {
  events7d: number;
  weeklyActiveUsers: number;
  views7d: number;
}

export class PostHogUnavailableError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "PostHogUnavailableError";
  }
}

// ── Fetch plumbing (mirrors admin-sentry.ts) ─────────────────────────────────

interface Envelope<T> {
  ok?: boolean;
  data?: T;
  error?: string;
  code?: string;
  /** PostHog's own message for an upstream failure — names the offending
   *  parameter in plain English. Surfaced in the UI so a broken filter is
   *  diagnosable instead of a flat "something went wrong". */
  detail?: string;
}

// Conditions where PostHog itself is unusable, so the page swaps to a
// full-panel "unavailable" state. `posthog_upstream` is deliberately NOT in
// here: that means PostHog answered and REJECTED our request — a bad filter,
// not an outage. Treating it as unavailable is what made a rejected search
// query render as "Couldn't reach PostHog" and blank the whole panel, hiding
// both the real reason and the list that was loading fine a moment earlier.
const UNAVAILABLE = new Set([
  "posthog_not_configured",
  "posthog_auth",
  "posthog_unreachable",
]);

/**
 * contacts-backend's /admin/posthog/* routes ship every "unavailable" reason
 * as a non-2xx status (503 for not-configured, 502 for auth/upstream/
 * unreachable) — same contract as /admin/sentry/*. `ncAdminFetchRaw` throws a
 * generic `NcAdminApiError` for any non-2xx response before this function
 * ever sees the body, carrying `json.error` as its message and `json.detail`
 * (when present) on `NcAdminApiError.detail` — so a `posthog_upstream`
 * rejection still surfaces PostHog's own message. Catch it, remap the
 * unavailable reasons to `PostHogUnavailableError`, and re-throw everything
 * else with `detail` folded back into the message. The post-success checks
 * below cover the same envelope guard `ncAdminFetch` applies internally, for
 * the case where the backend instead answers 200 with `ok:false` / an
 * `error` field — that path also carries `detail`, so it's preserved in the
 * thrown message.
 */
async function get<T>(path: string): Promise<T> {
  let json: Envelope<T>;
  try {
    json = await ncAdminFetchRaw<Envelope<T>>(path);
  } catch (e) {
    if (e instanceof NcAdminApiError && e.message && UNAVAILABLE.has(e.message)) {
      throw new PostHogUnavailableError(e.message);
    }
    if (e instanceof NcAdminApiError && e.detail) {
      throw new NcAdminApiError(`${e.message}: ${e.detail}`, e.status, e.detail);
    }
    throw e;
  }
  if (json.error && UNAVAILABLE.has(json.error)) {
    throw new PostHogUnavailableError(json.error);
  }
  if (json.ok === false || json.data === undefined) {
    const base = json.error || "Request failed";
    throw new NcAdminApiError(json.detail ? `${base}: ${json.detail}` : base, 200);
  }
  return json.data;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export function listRecordings(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  /** `app` super-property values to filter by (product switch). */
  apps?: string[];
  /** "web" | "mobile" — resolved server-side to a PostHog `$lib` filter.
   *  Omitted (or "all") means every platform. */
  device?: string;
}): Promise<RecordingsPage> {
  const q = new URLSearchParams();
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.offset) q.set("offset", String(opts.offset));
  if (opts?.search) q.set("search", opts.search);
  if (opts?.apps?.length) q.set("apps", opts.apps.join(","));
  if (opts?.device && opts.device !== "all") q.set("device", opts.device);
  const qs = q.toString();
  return get<RecordingsPage>(`/admin/posthog/recordings${qs ? `?${qs}` : ""}`);
}

/** The $exception events captured during one session. Distinct from the
 *  player's Console tab, which PostHog renders but does not expose over the
 *  API — this is the structured list the panel can actually show. */
export function listSessionExceptions(
  id: string,
): Promise<{ exceptions: SessionException[] }> {
  return get<{ exceptions: SessionException[] }>(
    `/admin/posthog/recordings/${encodeURIComponent(id)}/exceptions`,
  );
}

export function getRecording(id: string): Promise<PostHogRecording> {
  return get<PostHogRecording>(`/admin/posthog/recordings/${encodeURIComponent(id)}`);
}

/** Enables sharing on the recording and returns an embed URL for the iframe. */
export function getEmbed(id: string): Promise<EmbedInfo> {
  return get<EmbedInfo>(`/admin/posthog/recordings/${encodeURIComponent(id)}/embed`);
}

export function getStats(): Promise<PostHogStats> {
  return get<PostHogStats>(`/admin/posthog/stats`);
}
