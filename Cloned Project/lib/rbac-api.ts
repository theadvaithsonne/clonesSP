/**
 * Module RBAC client — talks to the backend `/rbac` routes.
 *
 * Two rules drive every call in here (see `RBAC_API.md`):
 *   1. A grant is an *offer*. `POST /rbac/grants` creates a pending grant with a
 *      24h expiry; the member's access only turns on when they accept it.
 *   2. A revoke is an *act*. `DELETE .../permissions/:module` applies instantly
 *      and cancels any live offer for that module.
 *
 * The shared `api()` helper flattens error bodies to a message string, but the
 * grant lifecycle needs the machine-readable `code` (`GRANT_EXPIRED`,
 * `GRANT_NOT_PENDING`, `SELF_ASSIGN`, …) to render the right recovery UI, so
 * this module wraps `fetch` directly and throws `RbacError` instead.
 */
import { API_URL } from "./api";
import { getToken, getOrgId, getUserDataFromToken } from "./auth";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Module keys are server-owned — never hardcode them, read `/rbac/modules`. */
export type ModuleKey = string;

export type RbacModule = { key: ModuleKey; label: string };

/** Binary per module: `true` = module admin, `false` = no access. */
export type ModulePermissions = Record<ModuleKey, boolean>;

export type PendingGrantCell = { grantId: string; expiresAt: string };

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  profilePicture?: string;
  role: string;
  permissions: ModulePermissions;
  /** Live (unanswered) offers, keyed by module. */
  pending: Record<ModuleKey, PendingGrantCell>;
  /** `false` for founders — render the row locked. */
  editable: boolean;
  isSelf: boolean;
  guest?: boolean;
};

export type MembersResponse = {
  rows: MemberRow[];
  modules: RbacModule[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type GrantStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | "applied";

export type GrantHistoryEntry = {
  grantId: string;
  module: ModuleKey;
  moduleLabel: string;
  action: "grant" | "revoke";
  status: GrantStatus;
  expiresAt?: string;
  respondedAt?: string;
  createdAt: string;
  member?: { id: string; name: string; email: string; profilePicture?: string };
  grantedBy?: { id: string; name: string; email: string; profilePicture?: string };
};

export type MemberDetail = MemberRow & { history: GrantHistoryEntry[] };

export type MyPermissions = {
  orgId: string;
  role: string;
  isFounder: boolean;
  guest: boolean;
  permissions: ModulePermissions;
  pendingCount: number;
};

export type MyGrant = {
  grantId: string;
  orgId: string;
  orgName: string;
  module: ModuleKey;
  moduleLabel: string;
  expiresAt: string;
  createdAt: string;
  grantedBy: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
};

export type CreateGrantsResult = {
  created: Array<{
    grantId: string;
    module: ModuleKey;
    expiresAt: string;
    status: GrantStatus;
  }>;
  alreadyPending: Array<{ grantId: string; module: ModuleKey; expiresAt: string }>;
  skipped: Array<{ userId?: string; module?: ModuleKey; reason: string }>;
};

export type BulkGrantsResult = {
  created: Array<{
    userId: string;
    grantId: string;
    module: ModuleKey;
    expiresAt: string;
  }>;
  skipped: Array<{ userId: string; reason: string }>;
  createdCount: number;
};

export type AuditResponse = {
  grants: GrantHistoryEntry[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export class RbacError extends Error {
  status: number;
  code?: string;
  module?: ModuleKey;

  constructor(message: string, status: number, code?: string, module?: ModuleKey) {
    super(message);
    this.name = "RbacError";
    this.status = status;
    this.code = code;
    this.module = module;
  }
}

async function rbacFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const base = (API_URL || "http://localhost:4000").replace(/\/+$/, "");
  const url = `${base}/${path.replace(/^\/+/, "")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new RbacError(`Failed to reach ${url}`, 0);
  }

  const text = await res.text();
  type Envelope = {
    data?: unknown;
    message?: string;
    error?: string;
    code?: string;
    module?: ModuleKey;
  };
  let body: Envelope | null = null;
  try {
    body = text ? (JSON.parse(text) as Envelope) : null;
  } catch {
    /* non-JSON error page */
  }

  if (!res.ok) {
    throw new RbacError(
      body?.message || body?.error || `Server error (${res.status})`,
      res.status,
      body?.code,
      body?.module
    );
  }

  return (body?.data ?? body) as T;
}

/**
 * Every founder endpoint is org-scoped. Prefer the persisted org id and fall
 * back to the one baked into the JWT (they diverge for a beat during an org
 * switch, before `garage:token-change` lands).
 */
export function currentOrgId(): string | null {
  return getOrgId() || getUserDataFromToken().orgId || null;
}

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export async function fetchModules(): Promise<RbacModule[]> {
  const data = await rbacFetch<{ modules: RbacModule[] }>("/rbac/modules");
  return data.modules || [];
}

/* ------------------------------------------------------------------ */
/* Member-facing                                                       */
/* ------------------------------------------------------------------ */

export async function fetchMyPermissions(orgId?: string | null): Promise<MyPermissions> {
  const org = orgId ?? currentOrgId();
  return rbacFetch<MyPermissions>(`/rbac/me${qs({ orgId: org })}`);
}

export async function fetchMyGrants(orgId?: string | null): Promise<MyGrant[]> {
  const org = orgId ?? currentOrgId();
  const data = await rbacFetch<{ grants: MyGrant[] }>(
    `/rbac/my-grants${qs({ orgId: org })}`
  );
  return data.grants || [];
}

export async function acceptGrant(grantId: string) {
  return rbacFetch<{ grantId: string; module: ModuleKey; status: GrantStatus }>(
    `/rbac/grants/${grantId}/accept`,
    { method: "POST" }
  );
}

export async function declineGrant(grantId: string) {
  return rbacFetch<{ grantId: string; module: ModuleKey; status: GrantStatus }>(
    `/rbac/grants/${grantId}/decline`,
    { method: "POST" }
  );
}

/* ------------------------------------------------------------------ */
/* Founder-facing — the permission table                               */
/* ------------------------------------------------------------------ */

export async function fetchMembers(params: {
  orgId?: string | null;
  search?: string;
  module?: ModuleKey;
  granted?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<MembersResponse> {
  const org = params.orgId ?? currentOrgId();
  return rbacFetch<MembersResponse>(
    `/rbac/members${qs({
      orgId: org,
      search: params.search,
      module: params.module,
      // `granted` is only meaningful alongside `module`; the backend reads
      // "false" as "members WITHOUT it" and anything else as "with it".
      granted: params.module && params.granted !== undefined ? String(params.granted) : undefined,
      page: params.page,
      limit: params.limit,
    })}`
  );
}

export async function fetchMemberDetail(
  userId: string,
  orgId?: string | null
): Promise<MemberDetail> {
  const org = orgId ?? currentOrgId();
  return rbacFetch<MemberDetail>(`/rbac/members/${userId}${qs({ orgId: org })}`);
}

/** Server page size cap for `/rbac/members`. */
const MEMBERS_MAX_LIMIT = 200;

/**
 * Every member in one array.
 *
 * The Team & Access table only shows people who hold a module or have a live
 * offer, and that predicate can only be evaluated against the whole roster —
 * server-side pagination would hand back a page of 50 that filters down to 2
 * and make the counts and empty states lie. It also backs email→userId
 * resolution in the invite dialog, since `POST /rbac/grants` takes ids only.
 */
export async function fetchAllMembers(orgId?: string | null): Promise<{
  rows: MemberRow[];
  modules: RbacModule[];
  total: number;
}> {
  const org = orgId ?? currentOrgId();
  const first = await fetchMembers({ orgId: org, page: 1, limit: MEMBERS_MAX_LIMIT });
  const rows = [...first.rows];

  let page = 1;
  let hasMore = first.hasMore;
  // Bounded so a backend that always reports hasMore cannot spin forever.
  while (hasMore && page < 25) {
    page += 1;
    const next = await fetchMembers({ orgId: org, page, limit: MEMBERS_MAX_LIMIT });
    rows.push(...next.rows);
    hasMore = next.hasMore && next.rows.length > 0;
  }

  return { rows, modules: first.modules || [], total: first.total ?? rows.length };
}

/* ------------------------------------------------------------------ */
/* Founder-facing — granting (creates offers, does not change access)  */
/* ------------------------------------------------------------------ */

export async function createGrants(
  userId: string,
  modules: ModuleKey[],
  orgId?: string | null
): Promise<CreateGrantsResult> {
  const org = orgId ?? currentOrgId();
  return rbacFetch<CreateGrantsResult>(`/rbac/grants${qs({ orgId: org })}`, {
    method: "POST",
    body: JSON.stringify({ userId, modules }),
  });
}

export async function createBulkGrants(
  userIds: string[],
  modules: ModuleKey[],
  orgId?: string | null
): Promise<BulkGrantsResult> {
  const org = orgId ?? currentOrgId();
  return rbacFetch<BulkGrantsResult>(`/rbac/grants/bulk${qs({ orgId: org })}`, {
    method: "POST",
    body: JSON.stringify({ userIds, modules }),
  });
}

/** Restarts the 24h clock — and revives an expired grant. */
export async function resendGrant(grantId: string, orgId?: string | null) {
  const org = orgId ?? currentOrgId();
  return rbacFetch<{ grantId: string; expiresAt: string }>(
    `/rbac/grants/${grantId}/resend${qs({ orgId: org })}`,
    { method: "POST" }
  );
}

/** Withdraw an unanswered offer → `cancelled`. */
export async function cancelGrant(grantId: string, orgId?: string | null) {
  const org = orgId ?? currentOrgId();
  return rbacFetch<{ grantId: string; status: GrantStatus }>(
    `/rbac/grants/${grantId}${qs({ orgId: org })}`,
    { method: "DELETE" }
  );
}

/* ------------------------------------------------------------------ */
/* Founder-facing — revoking (immediate)                               */
/* ------------------------------------------------------------------ */

export async function revokeModule(
  userId: string,
  module: ModuleKey,
  orgId?: string | null
) {
  const org = orgId ?? currentOrgId();
  return rbacFetch<{ userId: string; revoked: ModuleKey[]; cancelledPending: number }>(
    `/rbac/members/${userId}/permissions/${module}${qs({ orgId: org })}`,
    { method: "DELETE" }
  );
}

export async function revokeAllModules(userId: string, orgId?: string | null) {
  const org = orgId ?? currentOrgId();
  return rbacFetch<{ userId: string; revoked: ModuleKey[]; cancelledPending: number }>(
    `/rbac/members/${userId}/permissions${qs({ orgId: org })}`,
    { method: "DELETE" }
  );
}

/* ------------------------------------------------------------------ */
/* Founder-facing — audit trail                                        */
/* ------------------------------------------------------------------ */

export async function fetchAuditTrail(params: {
  orgId?: string | null;
  status?: GrantStatus;
  action?: "grant" | "revoke";
  module?: ModuleKey;
  userId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AuditResponse> {
  const org = params.orgId ?? currentOrgId();
  return rbacFetch<AuditResponse>(
    `/rbac/grants${qs({
      orgId: org,
      status: params.status,
      action: params.action,
      module: params.module,
      userId: params.userId,
      page: params.page,
      limit: params.limit,
    })}`
  );
}

/* ------------------------------------------------------------------ */
/* Cross-component invalidation                                        */
/* ------------------------------------------------------------------ */

/**
 * Anything that changes permissions or the pending queue fires this so the
 * sidebar, the inbox badge and the founder table all re-read without being
 * wired to each other.
 */
export const RBAC_CHANGED_EVENT = "rbac:changed";

export function notifyRbacChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RBAC_CHANGED_EVENT));
  }
}

/* ------------------------------------------------------------------ */
/* Expiry helpers                                                      */
/* ------------------------------------------------------------------ */

export function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/** Deliberately permissive — the server is the real validator. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** A row counts as "has access" if it holds a module or has a live offer. */
export function hasAnyAccess(row: MemberRow): boolean {
  return (
    Object.values(row.permissions || {}).some(Boolean) ||
    Object.keys(row.pending || {}).length > 0
  );
}

/** "23h 12m left" / "48m left" / "Expired" — for the 24h offer countdown. */
export function formatTimeLeft(expiresAt?: string | null): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  if (totalMinutes >= 1) return `${totalMinutes}m left`;
  return "<1m left";
}

/** "23h left" / "48m left" — the compact form that fits inside a table pill. */
export function formatTimeLeftShort(expiresAt?: string | null): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  if (hours >= 1) return `${hours}h left`;
  if (totalMinutes >= 1) return `${totalMinutes}m left`;
  return "<1m left";
}
