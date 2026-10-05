/**
 * Multi-account support — sign in as more than one person and move between
 * them, the way Gmail does.
 *
 * The app has always kept exactly one session: a JWT in `garage_tok`, the
 * active org in `garage_org_id`, and a user object in the persisted auth store
 * (plus the `auth-token` / `user-data` cookies the /api routes read). Every
 * consumer reaches it through `lib/auth`'s `getToken()`. Rather than teach all
 * of that about multiple users, those keys stay as THE ACTIVE SESSION and a
 * ledger sits beside them.
 *
 * Switching is then just: copy the chosen row into the session keys and
 * hard-navigate so the whole app rehydrates as that account. Nothing else has
 * to know other sessions exist.
 *
 * The active account is shared across tabs, which is what this app already
 * assumed — the session is in localStorage, and `garage:token-change` /
 * `garage:logout` exist so other surfaces follow along. (Networkchain's web
 * app pins the active account per-tab instead, because a live Catch Up in
 * another tab must not change identity underneath itself.)
 */

const REGISTRY_KEY = "garage_accounts";
const ADDING_KEY = "garage_adding_account"; // sessionStorage — per tab

/** Live-session keys, owned by lib/auth. Duplicated to avoid an import cycle. */
const TOKEN_KEY = "garage_tok";
const ORG_KEY = "garage_org_id";

export interface StoredAccount {
  userId: string;
  token: string;
  orgId: string | null;
  /** Shown in the switcher — kept so a row renders without a fetch. */
  name?: string;
  email?: string;
  profilePicture?: string;
  /** Ordering: most recently used first, like every account switcher. */
  lastUsedAt: number;
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

/** Minimal JWT payload decode (no verification — the server verifies). */
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Has this account's JWT expired?
 *
 * A ledger row outlives its token — nothing prunes it when the JWT lapses — so
 * "signed in" and "usable" are different questions, and the difference starts
 * mattering the moment a second account exists.
 *
 * A token that can't be parsed, or that carries no `exp`, counts as expired:
 * it can't be used against the API either way, and treating it as live would
 * strand the app on an account that 401s every request.
 */
export function isAccountExpired(account: StoredAccount, toleranceSeconds = 0): boolean {
  const exp = parseJwt(account.token)?.exp;
  if (typeof exp !== "number") return true;
  return Math.floor(Date.now() / 1000) >= exp - toleranceSeconds;
}

function readRegistry(): StoredAccount[] {
  if (!hasWindow()) return [];
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const arr = raw ? (JSON.parse(raw) as StoredAccount[]) : [];
    return Array.isArray(arr) ? arr.filter((a) => a?.userId && a?.token) : [];
  } catch {
    // A corrupt ledger must not lock anyone out — worst case the switcher is
    // empty and the live session still works, because it lives in its own keys.
    return [];
  }
}

function writeRegistry(accounts: StoredAccount[]): void {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(accounts));
  } catch {
    // Quota, or a blocked store. Failing to remember an account is survivable;
    // throwing here would break the sign-in that triggered it.
  }
}

/** Every remembered account, most recently used first. */
export function listAccounts(): StoredAccount[] {
  return [...readRegistry()].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
}

/** The user id of the live session, read from its token. */
export function activeUserId(): string | null {
  if (!hasWindow()) return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return (parseJwt(token)?.userId as string) || null;
}

/**
 * Record the session that is live right now, so it can be returned to.
 *
 * Identity defaults to the JWT's own claims, which already carry userId, name
 * and email — so this can be called from anywhere that has just written a
 * token, without a round-trip.
 */
export function rememberAccount(params: {
  token: string;
  orgId?: string | null;
  name?: string;
  email?: string;
  profilePicture?: string;
}): StoredAccount[] {
  if (!hasWindow() || !params.token) return listAccounts();
  const claims = parseJwt(params.token) || {};
  const userId = (claims.userId as string) || "";
  if (!userId) return listAccounts();

  const accounts = readRegistry();
  const existing = accounts.find((a) => a.userId === userId);
  const row: StoredAccount = {
    userId,
    token: params.token,
    orgId: params.orgId ?? (claims.orgId as string) ?? existing?.orgId ?? null,
    // Never blank out a name we already had with an undefined from a partial
    // payload — a switcher row with no name is a mystery to whoever reads it.
    name: params.name ?? (claims.name as string) ?? existing?.name,
    email: params.email ?? (claims.email as string) ?? existing?.email,
    profilePicture: params.profilePicture ?? existing?.profilePicture,
    lastUsedAt: Date.now(),
  };
  writeRegistry([row, ...accounts.filter((a) => a.userId !== userId)]);
  return listAccounts();
}

/**
 * Seed the ledger from the live session, for a user who signed in before
 * multi-account existed. Idempotent, and a no-op once they have a row.
 */
export function seedFromLiveSession(): StoredAccount[] {
  if (!hasWindow()) return [];
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return listAccounts();
  const userId = (parseJwt(token)?.userId as string) || "";
  if (!userId || readRegistry().some((a) => a.userId === userId)) return listAccounts();
  return rememberAccount({ token, orgId: localStorage.getItem(ORG_KEY) });
}

/**
 * Patch just the avatar on a row.
 *
 * Deliberately not `rememberAccount`: that stamps `lastUsedAt`, and learning
 * what someone's face looks like is not the same as using their account — it
 * would reorder the switcher underneath the person reading it.
 *
 * Returns true when something actually changed, so callers can avoid a
 * re-render (and a render loop) on the common no-op.
 */
export function setAccountPicture(userId: string, profilePicture: string): boolean {
  if (!hasWindow() || !userId || !profilePicture) return false;
  const accounts = readRegistry();
  const row = accounts.find((a) => a.userId === userId);
  if (!row || row.profilePicture === profilePicture) return false;
  writeRegistry(
    accounts.map((a) => (a.userId === userId ? { ...a, profilePicture } : a))
  );
  return true;
}

/** One row, without touching the live session. */
export function findAccount(userId: string): StoredAccount | null {
  return readRegistry().find((a) => a.userId === userId) ?? null;
}

/**
 * Make `userId` the live session by copying its row into the session keys.
 *
 * Returns the account it activated, or null when there is no such row or its
 * token has lapsed — callers must check BEFORE tearing anything down, or a
 * failed switch leaves the app signed out of everything. A lapsed row is
 * dropped here rather than activated: activating it would hand the app a
 * session that 401s every request.
 */
export function activateAccount(userId: string): StoredAccount | null {
  const target = findAccount(userId);
  if (!target) return null;
  if (isAccountExpired(target)) {
    forgetAccount(userId);
    return null;
  }
  localStorage.setItem(TOKEN_KEY, target.token);
  if (target.orgId) localStorage.setItem(ORG_KEY, target.orgId);
  else localStorage.removeItem(ORG_KEY);
  writeRegistry(
    readRegistry().map((a) => (a.userId === userId ? { ...a, lastUsedAt: Date.now() } : a))
  );
  return target;
}

/** Drop one account from the ledger (signing out of it). */
export function forgetAccount(userId: string): StoredAccount[] {
  writeRegistry(readRegistry().filter((a) => a.userId !== userId));
  return listAccounts();
}

/** Forget everything — a full sign-out, not a per-account one. */
export function clearAccounts(): void {
  if (hasWindow()) localStorage.removeItem(REGISTRY_KEY);
}

/**
 * "Add account" flow flag (per-tab).
 *
 * The login screen bounces an already-authenticated visitor straight into the
 * workspace, which is right for everyone except someone who came there
 * deliberately to add a second account. The switcher sets this, the login and
 * verify screens honour it, and verify clears it on success.
 */
export function beginAddAccount(): void {
  if (hasWindow()) sessionStorage.setItem(ADDING_KEY, "1");
}

export function isAddingAccount(): boolean {
  return hasWindow() && sessionStorage.getItem(ADDING_KEY) === "1";
}

export function endAddAccount(): void {
  if (hasWindow()) sessionStorage.removeItem(ADDING_KEY);
}

/**
 * The freshest remembered account that still works, activated — used when the
 * active one is signed out or has lapsed.
 *
 * Walking the list rather than taking the first row retires dead accounts as a
 * side effect (activateAccount drops a lapsed row), so this returns an account
 * the app can genuinely run as, or null when there is none.
 */
export function activateNextUsableAccount(): StoredAccount | null {
  for (const candidate of listAccounts()) {
    const activated = activateAccount(candidate.userId);
    if (activated) return activated;
  }
  return null;
}
