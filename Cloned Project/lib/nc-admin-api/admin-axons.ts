/**
 * Super-admin Axon directory + merge tooling API client (PR E.1 + E.2), ported
 * from the NC web app.
 *
 * Identical surface to networkchains-web-app `lib/api/admin-axons.ts` so the
 * ported pages import the same names — only the transport changed: auth now
 * comes from ./auth (garage→NC silent elevation) instead of the NC OTP flow.
 *
 * The admin axon surfaces are always available to super admins; a 404
 * `{ok:false,error:"Not found"}` means the requested axon/merge-log genuinely
 * doesn't exist (see `AxonSurfaceDisabledError`) — NC's own client special-cased
 * that status before its generic envelope check, so this port preserves the
 * same remap on top of the shared `ncAdminFetch` transport (see `axonRequest`
 * below).
 */

import { ncAdminFetch, NcAdminApiError } from "./auth";

// ── Raw Axon shape (admin-only, un-redacted) ──────────────────────────────────

export type AxonStatus = "active" | "merged_into" | "erased";

export interface AxonEmail {
  value: string;
  normalized: string;
  verified?: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface AxonPhone {
  value: string;
  e164?: string;
  digits: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface AxonSocialProfile {
  platform: string;
  url?: string;
  username?: string;
  externalId?: string;
  imageUrl?: string;
  headline?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface AxonEnrichmentChannel {
  profileUrl?: string;
  source?: string;
  actorId?: string;
  fetchedAt?: string;
  lastAttemptAt?: string;
  costCents?: number;
  summary?: string;
  highlights?: string[];
  rawDigest?: string;
  findingsHash?: string;
  contributor?: { orgId?: string; userId?: string };
  status?: string;
}

export interface AxonEnrichmentRun {
  provider?: string;
  source?: string;
  fetchedAt?: string;
  costCents?: number;
  contributorOrgId?: string;
  contributorUserId?: string;
  profileUrl?: string;
  highlightCount?: number;
  findingsHash?: string;
}

/** The full un-redacted Axon mongoose doc (admin-only). */
export interface RawAxon {
  _id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  headline?: string;
  location?: string;
  emails?: AxonEmail[];
  phones?: AxonPhone[];
  socialProfiles?: AxonSocialProfile[];
  matchKeys?: string[];
  keyStrength?: Record<string, "strong" | "weak" | "role">;
  professional?: unknown;
  experiences?: unknown[];
  educations?: unknown[];
  skills?: unknown[];
  certifications?: unknown[];
  awards?: unknown[];
  publications?: unknown[];
  projects?: unknown[];
  languages?: unknown[];
  volunteer?: unknown[];
  interests?: unknown[];
  about?: string;
  enrichment?: {
    linkedin?: AxonEnrichmentChannel;
    facebook?: AxonEnrichmentChannel;
    instagram?: AxonEnrichmentChannel;
  };
  fieldProvenance?: Record<string, unknown>;
  enrichmentRuns?: AxonEnrichmentRun[];
  mergedInto?: string;
  status: AxonStatus;
  erasureReason?: string;
  erasedAt?: string;
  contributorCount: number;
  projectionGen?: number;
  schemaVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** A back-index row: who is linked to an axon. */
export interface AxonLink {
  _id: string;
  axonId: string;
  userId: string;
  /** Resolved from the User doc server-side (admin, un-redacted). May be absent
   *  if the user was deleted. */
  userName?: string;
  userEmail?: string;
  orgId?: string;
  contactId?: string;
  synapseId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── List / detail responses ───────────────────────────────────────────────────

export type AxonSort =
  | "contributorCount"
  | "updatedAt"
  | "createdAt"
  | "displayName";

export interface AxonListData {
  items: RawAxon[];
  total: number;
  limit: number;
  skip: number;
}

export interface AxonDetailData {
  axon: RawAxon;
  contributors: AxonLink[];
}

// ── Merge / unmerge ───────────────────────────────────────────────────────────

export type MergeOutcome = "merge" | "noop_same" | "disputed" | "missing";

export interface ForwardMergeImpact {
  outcome: MergeOutcome;
  survivorId?: string;
  retiredId?: string;
  contactsToMove?: number;
  synapsesToMove?: number;
  linksToMove?: number;
  keysAddedToSurvivor?: string[];
}

export type MergeStatus =
  | "merged"
  | "noop_same"
  | "noop_already_merged"
  | "lock_unavailable"
  | "quarantined"
  | "disabled";

export interface MergeResult {
  status: MergeStatus;
  survivorId?: string;
  retiredId?: string;
  logId?: string;
}

export type MergeDryRunResponse = { dryRun: true; impact: ForwardMergeImpact };
export type MergeConfirmResponse = { dryRun: false; result: MergeResult };

export type UnmergeStatus =
  | "reverted"
  | "dry_run"
  | "not_applied"
  | "state_mismatch";

export interface MergeImpact {
  logId: string;
  survivorId: string;
  retiredId: string;
  synapsesToMove: number;
  contactsToMove: number;
  linksToMove: number;
  keysRemovedFromSurvivor: string[];
}

export interface UnmergeResult {
  status: UnmergeStatus;
  impact?: MergeImpact;
}

export type UnmergeResponse = { dryRun: boolean; result: UnmergeResult };

// ── Errors ──────────────────────────────────────────────────────────────────

/** Thrown when an axon admin route returns 404 — the requested axon/merge-log
 *  doesn't exist. Callers show a generic not-found state. */
export class AxonSurfaceDisabledError extends Error {
  constructor(message = "Axon not found") {
    super(message);
    this.name = "AxonSurfaceDisabledError";
  }
}

// ── Fetch helpers (shared NC admin transport) ─────────────────────────────────

/**
 * Wraps `ncAdminFetch` (which already unwraps `{ok,data}` and applies the
 * `json.ok === false` / missing-`data` envelope check) with the one axon-only
 * behaviour that transport doesn't know about: a 404 means "not found", not a
 * generic failure. `ncAdminFetch` preserves the HTTP status on the
 * `NcAdminApiError` it throws, so catch that and remap status 404 specifically —
 * every other status (including a 401 that survives auth.ts's own one-shot
 * re-elevation-and-retry) continues to propagate as `NcAdminApiError` /
 * `NcAdminUnauthorizedError` for the caller to handle.
 */
async function axonRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NcAdminApiError && e.status === 404) {
      throw new AxonSurfaceDisabledError(e.message || "Not found");
    }
    throw e;
  }
}

function getAxon<T>(path: string): Promise<T> {
  return axonRequest(() => ncAdminFetch<T>(path));
}

function postAxon<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return axonRequest(() =>
    ncAdminFetch<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export interface AxonListParams {
  q?: string;
  status?: AxonStatus;
  limit?: number;
  skip?: number;
  sort?: AxonSort;
  /** Sort direction. Sent as `sortOrder`; harmless if the backend defaults it. */
  order?: "asc" | "desc";
  reason?: string;
}

export function listAxons(params: AxonListParams = {}): Promise<AxonListData> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.skip != null) qs.set("skip", String(params.skip));
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("sortOrder", params.order);
  if (params.reason) qs.set("reason", params.reason);
  const s = qs.toString();
  return getAxon<AxonListData>(`/admin/axons${s ? `?${s}` : ""}`);
}

export function getAxonDetail(
  id: string,
  reason?: string,
): Promise<AxonDetailData> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return getAxon<AxonDetailData>(
    `/admin/axons/${encodeURIComponent(id)}${qs}`,
  );
}

/** Dry-run a forward merge (no mutation) — returns the impact diff. */
export function dryRunMerge(
  aId: string,
  bId: string,
  reason?: string,
): Promise<MergeDryRunResponse> {
  return postAxon<MergeDryRunResponse>(`/admin/axons/merge`, {
    aId,
    bId,
    ...(reason ? { reason } : {}),
  });
}

/** Confirm a forward merge. Returns the result (status + logId on success). */
export function confirmMerge(
  aId: string,
  bId: string,
  reason?: string,
): Promise<MergeConfirmResponse> {
  return postAxon<MergeConfirmResponse>(`/admin/axons/merge`, {
    aId,
    bId,
    confirm: true,
    ...(reason ? { reason } : {}),
  });
}

/** Dry-run an unmerge (no mutation) — returns the impact via UnmergeResult. */
export function dryRunUnmerge(
  logId: string,
  reason?: string,
): Promise<UnmergeResponse> {
  return postAxon<UnmergeResponse>(`/admin/axons/unmerge`, {
    logId,
    ...(reason ? { reason } : {}),
  });
}

/** Confirm an unmerge (reverts a prior merge by its merge-log id). */
export function confirmUnmerge(
  logId: string,
  reason?: string,
): Promise<UnmergeResponse> {
  return postAxon<UnmergeResponse>(`/admin/axons/unmerge`, {
    logId,
    confirm: true,
    ...(reason ? { reason } : {}),
  });
}

// ── Display helpers ───────────────────────────────────────────────────────────

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isValidObjectId(s: string): boolean {
  return OBJECT_ID_RE.test(s.trim());
}

/** Best-effort human label for an axon (falls back to identity then id). */
export function axonLabel(a: Pick<RawAxon, "displayName" | "firstName" | "lastName" | "headline" | "emails" | "_id">): string {
  if (a.displayName) return a.displayName;
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (a.emails && a.emails.length > 0) return a.emails[0].value;
  return a._id;
}
