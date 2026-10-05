/**
 * Who this tab is, to the webinar server.
 *
 * The server decides whether a join is "this device coming back" or "me, on a
 * second device" by device id (garagenew-backend
 * `src/realtime/webinarPresence.ts#isSameDevice`). Per TAB on purpose: two
 * tabs of the same browser can each hold media, so the server should treat
 * them as two devices and ask which one to use. sessionStorage is exactly
 * tab-scoped and survives a refresh, which is the reconnect case that must
 * NOT be asked about.
 */
const KEY = "garage.webinar.deviceId";
let cached: string | null = null;

function mint(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getWebinarDeviceId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "";
  try {
    const held = window.sessionStorage.getItem(KEY);
    if (held) {
      cached = held;
      return held;
    }
    const fresh = mint();
    window.sessionStorage.setItem(KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // Storage blocked: stay stable for the life of this page at least, or
    // every resync would look like a brand-new device.
    cached = mint();
    return cached;
  }
}

/** "Chrome on Mac" — shown to the same user on their OTHER device. */
export function describeThisBrowser(): string {
  if (typeof navigator === "undefined") return "your browser";
  const ua = navigator.userAgent || "";
  const uaData = (navigator as Navigator & {
    userAgentData?: { brands?: { brand: string }[]; platform?: string };
  }).userAgentData;

  let browser = "";
  const brands = uaData?.brands?.map((b) => b.brand) ?? [];
  const known = ["Microsoft Edge", "Opera", "Brave", "Google Chrome", "Chromium", "Firefox", "Safari"];
  browser = known.find((k) => brands.some((b) => b.includes(k))) ?? "";
  if (!browser) {
    if (/Edg\//.test(ua)) browser = "Microsoft Edge";
    else if (/OPR\//.test(ua)) browser = "Opera";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Chrome\//.test(ua)) browser = "Google Chrome";
    else if (/Safari\//.test(ua)) browser = "Safari";
  }
  browser = browser.replace(/^(Microsoft|Google) /, "") || "Browser";

  let os = uaData?.platform || "";
  if (!os) {
    if (/iPhone|iPad/.test(ua)) os = "iOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/Windows/.test(ua)) os = "Windows";
    else if (/Mac OS X|Macintosh/.test(ua)) os = "Mac";
    else if (/Linux/.test(ua)) os = "Linux";
  }
  if (os === "macOS") os = "Mac";

  return (os ? `${browser} on ${os}` : browser).slice(0, 40);
}
