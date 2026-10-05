/**
 * Bat246-only guest session persistence — NOT used by any other webinar.
 *
 * The Bat246 funnel's email/OTP popup (see WebinarPreJoin.tsx's
 * BAT246_ORG_ID branch) verifies a visitor once, then this lets them come
 * back — via the gotobigwin.com "Live Webinar" tile (Bat246Landing.tsx) or
 * a re-visit of /webinar/[id] — without re-entering email/OTP, as long as
 * the webinar hasn't gone live yet. Scoped per webinarId so a stale session
 * for a replaced webinar never resolves.
 *
 * Deliberately its own tiny module rather than added to any shared
 * webinar/session utility — keeps this Bat246-specific mechanism isolated
 * from the general webinar join flow used by every other org.
 */

const STORAGE_PREFIX = "bat246_webinar_session_";

// Local client-side TTL, kept comfortably under the 12h expiry already used
// for the tokens minted by join-verify-otp/join-anonymous/demo-host-join —
// treats a session as stale here before the server would ever 401 it, so a
// resume attempt never fires against a token that's already dead.
const SESSION_TTL_MS = 11 * 60 * 60 * 1000; // 11h

export interface Bat246GuestSession {
  token: string;
  displayName: string;
  savedAt: number;
}

function storageKey(webinarId: string): string {
  return `${STORAGE_PREFIX}${webinarId}`;
}

export function saveBat246GuestSession(
  webinarId: string,
  token: string,
  displayName: string
): void {
  if (typeof window === "undefined") return;
  try {
    const session: Bat246GuestSession = {
      token,
      displayName,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(storageKey(webinarId), JSON.stringify(session));
  } catch {
    // Storage unavailable (private browsing, quota, disabled) — the join
    // still works this visit, it just won't resume across a redirect/reload.
  }
}

export function readBat246GuestSession(
  webinarId: string
): Bat246GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(webinarId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      !parsed.token ||
      typeof parsed.displayName !== "string" ||
      !parsed.displayName ||
      typeof parsed.savedAt !== "number"
    ) {
      window.localStorage.removeItem(storageKey(webinarId));
      return null;
    }

    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      window.localStorage.removeItem(storageKey(webinarId));
      return null;
    }

    return parsed as Bat246GuestSession;
  } catch {
    return null;
  }
}

export function clearBat246GuestSession(webinarId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(webinarId));
  } catch {
    // no-op
  }
}
