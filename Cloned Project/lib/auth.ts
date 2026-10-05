import { forgetAccount, rememberAccount } from "@/lib/accounts";

const KEY = "garage_tok";
const ORG_KEY = "garage_org_id";
const ADMIN_KEY = "garage_admin_token";

export function saveToken(t: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, t);
    // The single choke point every sign-in path goes through, so it is also
    // where the multi-account ledger learns about a session. An account the
    // ledger never saw is one the switcher can't offer — including the very
    // first sign-in. Identity comes from the token's own claims.
    rememberAccount({ token: t, orgId: localStorage.getItem(ORG_KEY) });
    window.dispatchEvent(new CustomEvent("garage:token-change"));
  }
}
export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
}

/**
 * The garage-admin console's own session token (`garage_admin_token`, set by
 * `app/garage-admin/login/page.tsx`). Separate from the consumer session
 * above — an admin has no `garage_tok`. Exists so callers that hit
 * Garage-backend routes which now also accept an admin token (mapped to the
 * admin's own user record) can fall back to it when there is no consumer
 * session. Never used to replace `getToken()` itself.
 */
export function getAdminToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(ADMIN_KEY) : null;
}

/**
 * End the live session.
 *
 * Also drops the account from the multi-account ledger: a session the user has
 * just signed out of must not stay on offer in the switcher. Other accounts
 * are untouched — see `signOutActiveAccount` in lib/account-session, which is
 * what hands over to one of them.
 */
export function clearToken() {
  if (typeof window !== "undefined") {
    const tok = localStorage.getItem(KEY);
    const userId = tok ? getUserIdFromToken() : null;
    localStorage.removeItem(KEY);
    localStorage.removeItem(ORG_KEY);
    if (userId) forgetAccount(userId);
    window.dispatchEvent(new CustomEvent("garage:logout"));
  }
}

export function saveOrgId(orgId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ORG_KEY, orgId);
    // The ledger row is what a later switch restores from, so it has to carry
    // the org the user is actually in — otherwise switching away and back
    // silently returns them to whichever org they first signed into.
    const tok = localStorage.getItem(KEY);
    if (tok) rememberAccount({ token: tok, orgId });
    // The chrome is painted in the office's own accent colour — see
    // lib/brand-color-context. Switching office without a full reload has to
    // repaint it, otherwise the previous office's colour sticks.
    window.dispatchEvent(new CustomEvent("garage:org-change"));
  }
}
export function getOrgId(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(ORG_KEY) : null;
}
export function clearOrgId() {
  if (typeof window !== "undefined") localStorage.removeItem(ORG_KEY);
}
export function getUserIdFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const tok = getToken();
  if (!tok) return null;
  try {
    const payload = JSON.parse(
      atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.userId || null;
  } catch {
    return null;
  }
}

export function getUserDataFromToken(): {
  userId: string | null;
  role: string | null;
  orgId: string | null;
  name: string | null;
  email: string | null;
} {
  if (typeof window === "undefined")
    return { userId: null, role: null, orgId: null, name: null, email: null };
  const tok = getToken();
  if (!tok)
    return { userId: null, role: null, orgId: null, name: null, email: null };
  try {
    const payload = JSON.parse(
      atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return {
      userId: payload.userId || null,
      role: payload.role || null,
      orgId: payload.orgId || null,
      name: payload.name || null,
      email: payload.email || null,
    };
  } catch {
    return { userId: null, role: null, orgId: null, name: null, email: null };
  }
}

// Decode JWT payload safely
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const payload = atob(base64Url.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function getTokenExpiry(): number | null {
  if (typeof window === "undefined") return null;
  const tok = getToken();
  if (!tok) return null;
  const payload = decodeJwtPayload(tok);
  // exp is seconds since epoch
  return payload && typeof payload.exp === "number" ? payload.exp : null;
}

export function isTokenExpired(toleranceSeconds: number = 0): boolean {
  const exp = getTokenExpiry();
  if (!exp) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= exp - toleranceSeconds;
}

export function isAuthenticated(): boolean {
  const tok = getToken();
  if (!tok) return false;
  return !isTokenExpired();
}
