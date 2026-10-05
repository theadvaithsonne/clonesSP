// Stable per-session + per-visitor ids for affiliate click attribution.
// Appended to GET /affiliate/invite-details so roam-backend records exactly
// one deduped click per landing session (sessionId), and can count unique
// visitors (visitorId). No separate beacon → no double counting with the
// server-side hook.

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function persistentId(storage: Storage, key: string): string {
  let v = storage.getItem(key);
  if (!v) {
    v = uuid();
    try {
      storage.setItem(key, v);
    } catch {
      /* private mode / quota — id is still usable for this request */
    }
  }
  return v;
}

/**
 * Query-string fragment (`&cs=<sessionId>&cv=<visitorId>`) to append to the
 * invite-details call. Returns "" on the server or if storage is unavailable.
 */
export function affiliateClickParams(): string {
  if (typeof window === "undefined") return "";
  try {
    const cs = persistentId(window.sessionStorage, "nc_click_sid");
    const cv = persistentId(window.localStorage, "nc_click_vid");
    return `&cs=${encodeURIComponent(cs)}&cv=${encodeURIComponent(cv)}`;
  } catch {
    return "";
  }
}
