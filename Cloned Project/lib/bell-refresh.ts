// Ask the notification bell to refresh, batched.
//
// Every listener of "notifications:refresh" (toolbar and sidebar counts, the
// notifications panel) re-fetches from the server, so one refresh is three or
// four requests per browser. Chat messages trigger refreshes, and a busy chat
// would otherwise send that burst on every message. The first request goes out
// straight away; after that, at most one per BELL_REFRESH_MS, and requests made
// in between share the one scheduled at the end of the window.

export const BELL_REFRESH_MS = 10_000;

let scheduled: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;

export function requestBellRefresh(): void {
  if (typeof window === "undefined" || scheduled) return;
  const wait = Math.max(0, lastSent + BELL_REFRESH_MS - Date.now());
  scheduled = setTimeout(() => {
    scheduled = null;
    lastSent = Date.now();
    window.dispatchEvent(new CustomEvent("notifications:refresh"));
  }, wait);
}
