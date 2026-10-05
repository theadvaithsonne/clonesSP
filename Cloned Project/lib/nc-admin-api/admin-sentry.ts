/**
 * Admin Sentry error-viewer API client, ported from the NC web app. Talks to
 * contacts-backend's /admin/sentry/* proxy (which holds the Sentry read token
 * server-side), read-only.
 *
 * Identical surface to networkchains-web-app `lib/api/admin-sentry.ts` so the
 * ported pages import the same names — only the transport changed: auth now
 * comes from ./auth (garage→NC silent elevation) instead of the NC OTP flow.
 */

import { ncAdminFetchRaw, NcAdminApiError } from "./auth";

// ── Models (Sentry shapes — deep event fields kept loose on purpose) ──────────

export interface SentryProject {
  key: string;
  label: string;
  slug: string;
  /** Product tag from SENTRY_PROJECTS — powers the NetworkChains/Garage switch.
   *  Older backends omit it; treat missing as "networkchains". */
  product?: string;
}

export interface SentryIssueMetadata {
  type?: string;
  value?: string;
  filename?: string;
  function?: string;
  title?: string;
}

export interface SentryIssue {
  id: string;
  shortId?: string;
  title: string;
  culprit?: string;
  permalink?: string;
  level?: string;
  status?: string;
  isUnhandled?: boolean;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  metadata?: SentryIssueMetadata;
  project?: { id?: string; name?: string; slug?: string };
}

/** One stack frame (fields are all best-effort across platforms). */
export interface SentryFrame {
  filename?: string;
  absPath?: string;
  module?: string;
  package?: string;
  function?: string;
  rawFunction?: string;
  lineNo?: number | null;
  colNo?: number | null;
  inApp?: boolean;
  /** [[lineNo, sourceLine], …] — pre/error/post source context. */
  context?: Array<[number, string]>;
  vars?: Record<string, unknown> | null;
  platform?: string;
}

export interface SentryStacktrace {
  frames?: SentryFrame[];
  framesOmitted?: [number, number] | null;
  hasSystemFrames?: boolean;
}

export interface SentryExceptionValue {
  type?: string;
  value?: string;
  module?: string;
  threadId?: number | null;
  stacktrace?: SentryStacktrace | null;
  rawStacktrace?: SentryStacktrace | null;
  mechanism?: { type?: string; handled?: boolean; description?: string } | null;
}

export interface SentryBreadcrumb {
  timestamp?: string | number;
  type?: string;
  category?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown> | null;
}

export interface SentryRequestEntry {
  url?: string;
  method?: string;
  query?: Array<[string, string]> | string | null;
  data?: unknown;
  headers?: Array<[string, string]> | null;
  cookies?: Array<[string, string]> | null;
  env?: Record<string, unknown> | null;
  fragment?: string | null;
}

/** An event `entries[]` item — discriminated by `type` at render time. */
export interface SentryEntry {
  type: string;
  data: unknown;
}

export interface SentryEvent {
  id: string;
  eventID?: string;
  groupID?: string;
  title?: string;
  message?: string | null;
  platform?: string;
  dateCreated?: string;
  dateReceived?: string;
  size?: number;
  tags?: Array<{ key: string; value: string }>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
    ip_address?: string;
    name?: string;
    [k: string]: unknown;
  } | null;
  contexts?: Record<string, Record<string, unknown>>;
  sdk?: { name?: string; version?: string } | null;
  release?: { version?: string; shortVersion?: string } | string | null;
  environment?: string | null;
  dist?: string | null;
  entries?: SentryEntry[];
  metadata?: SentryIssueMetadata;
  [k: string]: unknown;
}

// ── Typed entry accessors (walk entries[] tolerantly) ─────────────────────────

export function exceptionValues(event: SentryEvent): SentryExceptionValue[] {
  const entry = event.entries?.find((e) => e.type === "exception");
  const data = entry?.data as { values?: SentryExceptionValue[] } | undefined;
  return data?.values ?? [];
}

/**
 * The replay id attached to an event, if the SDK captured one.
 *
 * Sentry records it in two places depending on SDK and version — a `replayId`
 * tag and a `replay` context — and which one is present varies, so both are
 * checked rather than assuming.
 */
export function replayIdOf(event: SentryEvent | null): string | null {
  if (!event) return null;
  const fromContext = event.contexts?.replay?.replay_id;
  if (typeof fromContext === "string" && fromContext) return fromContext;
  const tag = event.tags?.find(
    (t) => t.key === "replayId" || t.key === "replay_id",
  );
  return tag?.value || null;
}

/**
 * Where to watch an issue's replays in Sentry.
 *
 * Built by appending to the issue's own permalink rather than composing a URL
 * from the org slug: Sentry serves orgs on both sentry.io/organizations/<org>
 * and <org>.sentry.io, and has moved the standalone replay route between
 * top-level and /explore. The permalink is whatever Sentry itself considers
 * canonical for this install, and the issue's replays tab has been a stable
 * sub-route of it — so this keeps working when those change.
 */
export function issueReplaysUrl(permalink: string | null | undefined): string | null {
  if (!permalink) return null;
  return `${permalink.replace(/\/$/, "")}/replays/`;
}

export function breadcrumbs(event: SentryEvent): SentryBreadcrumb[] {
  const entry = event.entries?.find((e) => e.type === "breadcrumbs");
  const data = entry?.data as { values?: SentryBreadcrumb[] } | undefined;
  return data?.values ?? [];
}

export function requestEntry(event: SentryEvent): SentryRequestEntry | null {
  const entry = event.entries?.find((e) => e.type === "request");
  return (entry?.data as SentryRequestEntry | undefined) ?? null;
}

export function messageEntry(event: SentryEvent): string | null {
  const entry = event.entries?.find((e) => e.type === "message");
  const data = entry?.data as { formatted?: string; message?: string } | undefined;
  return data?.formatted ?? data?.message ?? null;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface IssuesPage {
  issues: SentryIssue[];
  nextCursor: string | null;
}
export interface EventsPage {
  events: SentryEvent[];
  nextCursor: string | null;
}

export type SentrySort = "date" | "new" | "priority" | "freq" | "user" | "trends";
export type SentryStatsPeriod = "1h" | "24h" | "7d" | "14d" | "30d" | "90d";

// ── Errors ────────────────────────────────────────────────────────────────────

/** Thrown when the backend reports Sentry isn't configured / not reachable /
 *  the token is bad — the page renders a specific empty state per `reason`. */
export class SentryUnavailableError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "SentryUnavailableError";
  }
}

const UNAVAILABLE = new Set([
  "sentry_not_configured",
  "sentry_auth",
  "sentry_upstream",
  "sentry_unreachable",
]);

/**
 * Sentry endpoints use contacts-backend's `{ ok, data }` envelope AND overload
 * `error` with the unavailable-reason codes above (Sentry unconfigured / bad
 * token / upstream error / unreachable) instead of a generic failure — and
 * per the task brief, the unavailable case ships as an actual **503**, not a
 * 200 with `ok:false`. `ncAdminFetchRaw` throws a generic `NcAdminApiError`
 * for any non-2xx response before this function ever sees the body, so the
 * unavailable-reason string only survives inside that error's `.message`
 * (`ncAdminFetchRaw` sets it from `json.error`). Catch it and remap. The
 * post-success checks below cover the same envelope guard `ncAdminFetch`
 * applies internally, for the case where the backend instead answers 200
 * with `ok:false` / an `error` field.
 */
async function get<T>(path: string): Promise<T> {
  let json: { ok?: boolean; data?: T; error?: string };
  try {
    json = await ncAdminFetchRaw<{ ok?: boolean; data?: T; error?: string }>(path);
  } catch (e) {
    if (e instanceof NcAdminApiError && e.message && UNAVAILABLE.has(e.message)) {
      throw new SentryUnavailableError(e.message);
    }
    throw e;
  }
  if (json.error && UNAVAILABLE.has(json.error)) {
    throw new SentryUnavailableError(json.error);
  }
  if (json.ok === false || json.data === undefined) {
    throw new NcAdminApiError(json.error || "Request failed", 200);
  }
  return json.data;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export function listProjects(): Promise<{ projects: SentryProject[] }> {
  return get<{ projects: SentryProject[] }>(`/admin/sentry/projects`);
}

export interface IssueListParams {
  project: string;
  query?: string;
  sort?: SentrySort;
  statsPeriod?: SentryStatsPeriod;
  cursor?: string;
}

export function listIssues(params: IssueListParams): Promise<IssuesPage> {
  const qs = new URLSearchParams();
  qs.set("project", params.project);
  if (params.query) qs.set("query", params.query);
  if (params.sort) qs.set("sort", params.sort);
  if (params.statsPeriod) qs.set("statsPeriod", params.statsPeriod);
  if (params.cursor) qs.set("cursor", params.cursor);
  return get<IssuesPage>(`/admin/sentry/issues?${qs.toString()}`);
}

export function getIssue(id: string): Promise<{ issue: SentryIssue }> {
  return get<{ issue: SentryIssue }>(`/admin/sentry/issues/${encodeURIComponent(id)}`);
}

export function getLatestEvent(id: string): Promise<{ event: SentryEvent }> {
  return get<{ event: SentryEvent }>(
    `/admin/sentry/issues/${encodeURIComponent(id)}/events/latest`
  );
}

export function listEvents(id: string, cursor?: string): Promise<EventsPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return get<EventsPage>(`/admin/sentry/issues/${encodeURIComponent(id)}/events${qs}`);
}

export function getEvent(id: string, eventId: string): Promise<{ event: SentryEvent }> {
  return get<{ event: SentryEvent }>(
    `/admin/sentry/issues/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`
  );
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const LEVEL_COLOR: Record<string, string> = {
  fatal: "bg-red-500/15 text-red-300 border-red-500/30",
  error: "bg-red-500/15 text-red-300 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  debug: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export function levelClass(level?: string): string {
  return LEVEL_COLOR[level ?? ""] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

export function relTime(iso?: string | number): string {
  if (iso == null) return "—";
  const t = typeof iso === "number" ? iso * 1000 : Date.parse(iso);
  if (Number.isNaN(t)) return String(iso);
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── "Who + what" resolver ─────────────────────────────────────────────────────

/** Resolved actor for an event: who triggered it and on what client. */
export interface EventActor {
  /** Signed-in email, when the event carried an authenticated user. */
  email: string | null;
  /** Non-IP user id (e.g. Mongo _id), when present. */
  userId: string | null;
  ip: string | null;
  /** True when there was no authenticated identity → treat as a guest. */
  isGuest: boolean;
  /** "Chrome 131" etc., or null when the client can't be determined. */
  browser: string | null;
  /** "macOS 14" etc. */
  os: string | null;
  /** Mobile device model/family, when the event exposes one. */
  device: string | null;
  /**
   * Whether we could determine the END USER's client at all. False for
   * server-side worker/cron/build errors that have no request + no browser
   * context (their os/device contexts describe the SERVER, not the user).
   */
  clientKnown: boolean;
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|:/;
function ctxOf(event: SentryEvent, key: string): Record<string, unknown> | undefined {
  const c = event.contexts?.[key];
  return c && typeof c === "object" ? (c as Record<string, unknown>) : undefined;
}
function nameVer(name?: unknown, version?: unknown): string | null {
  const n = typeof name === "string" && name ? name : null;
  if (!n) return null;
  const v =
    typeof version === "string" && version
      ? version
      : typeof version === "number"
        ? String(version)
        : null;
  return v ? `${n} ${v}` : n;
}
function headerVal(event: SentryEvent, name: string): string | null {
  const req = requestEntry(event);
  const headers = Array.isArray(req?.headers) ? req!.headers : [];
  const hit = headers.find(([k]) => String(k).toLowerCase() === name.toLowerCase());
  return hit ? String(hit[1]) : null;
}
/** Minimal User-Agent parse for backend events (no browser context). */
function parseUA(ua: string): { browser: string | null; os: string | null; mobile: boolean } {
  const m = ua.match(/(Edg|EdgA|OPR|SamsungBrowser|Chrome|CriOS|Firefox|FxiOS|Version).*?[/ ]([\d.]+)/);
  const rename: Record<string, string> = {
    Edg: "Edge",
    EdgA: "Edge",
    OPR: "Opera",
    CriOS: "Chrome",
    FxiOS: "Firefox",
    Version: "Safari",
    SamsungBrowser: "Samsung Internet",
  };
  const browser = m ? `${rename[m[1]] ?? m[1]} ${m[2].split(".")[0]}` : null;
  let os: string | null = null;
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua);
  return { browser, os, mobile };
}

export function resolveActor(event: SentryEvent): EventActor {
  const u = (event.user ?? {}) as Record<string, unknown>;
  const email = typeof u.email === "string" && u.email ? u.email : null;
  const rawId = u.id != null ? String(u.id) : null;
  const userId = rawId && !IP_RE.test(rawId) ? rawId : null;
  const ip = typeof u.ip_address === "string" && u.ip_address ? u.ip_address : null;
  const isGuest = !email && !userId;

  let browser: string | null = null;
  let os: string | null = null;
  let device: string | null = null;
  let clientKnown = false;

  const bctx = ctxOf(event, "browser");
  if (bctx?.name) {
    // Frontend/browser event — the os/device contexts ARE the user's machine.
    browser = nameVer(bctx.name, bctx.version);
    const octx = ctxOf(event, "os") ?? ctxOf(event, "client_os");
    os = nameVer(octx?.name, octx?.version);
    const dctx = ctxOf(event, "device");
    device = nameVer(dctx?.model ?? dctx?.family ?? dctx?.name, undefined);
    clientKnown = true;
  } else {
    // Backend event — os/device describe the SERVER; the only end-user signal
    // is the request User-Agent. Fall back to the raw UA if we can't parse it.
    const ua = headerVal(event, "user-agent");
    if (ua) {
      const p = parseUA(ua);
      browser = p.browser ?? ua.slice(0, 80);
      os = p.os;
      clientKnown = true;
    }
  }

  return { email, userId, ip, isGuest, browser, os, device, clientKnown };
}
