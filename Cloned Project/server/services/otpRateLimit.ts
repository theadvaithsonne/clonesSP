/**
 * Per-caller throttle for outbound OTP sends.
 *
 * The existing cooldown in /auth/request-otp is keyed on the PHONE NUMBER: one
 * OtpCode row per (key, purpose), 60s between codes. That stops someone
 * hammering their own number, and does nothing at all about the attack we
 * actually see — a script walking through a list of numbers, one send each.
 * Every number is new, so every number gets a free SMS/WhatsApp, and each one
 * costs money and lands on a stranger's phone.
 *
 * So this throttles the CALLER instead of the destination. In-memory on
 * purpose: the backend runs as a single pm2 fork process, there is no Redis in
 * this service, and a limiter that resets on deploy is worth far more than one
 * that never ships. If this ever runs multi-process, move the window to Mongo
 * or Redis — a per-process limit is N× looser than it reads.
 */

/** Sliding windows, newest last. Only phone sends are recorded. */
const hits = new Map<string, number[]>();

/** Distinct destinations per caller — the signal that separates a retrying
 *  user (same number) from an enumeration run (many numbers). */
const targets = new Map<string, Set<string>>();

const WINDOW_MS = 10 * 60 * 1000;
/** Sends allowed per caller per window. A real person needs one, or a couple
 *  with a resend; ten is far beyond honest use and still cheap to absorb. */
const MAX_SENDS = 10;
/** Distinct numbers one caller may send to per window. This is the one that
 *  actually bites an enumeration run. */
const MAX_TARGETS = 5;

/**
 * Global send times — the backstop for when the caller rotates IPs.
 *
 * The per-caller window above assumes one source. A run spread across proxies
 * defeats it, so this caps total phone sends regardless of who asks. It is
 * deliberately far above honest traffic: this deployment creates ~13 accounts
 * a day, and the observed attack ran 8 sends in 24 seconds. Tripping it means
 * something is very wrong, which is why it shouts in the log.
 */
const globalSends: number[] = [];
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_MAX_PER_MIN = 20;

let lastSweep = 0;

/** Drop windows that have aged out, so the maps can't grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [k, times] of hits) {
    const live = times.filter((t) => now - t < WINDOW_MS);
    if (live.length) hits.set(k, live);
    else {
      hits.delete(k);
      targets.delete(k);
    }
  }
}

/**
 * The caller's address as seen through nginx.
 *
 * `req.ip` is the proxy itself unless Express is told to trust it, and this app
 * does not set `trust proxy` — so read the forwarded header directly and take
 * the FIRST entry, which is the client. Later entries are proxies, and the
 * whole header is client-settable, so this is a spam control and never an
 * authorization input.
 */
export function callerKey(req: any): string {
  const fwd = String(req.headers?.["x-forwarded-for"] || "");
  const first = fwd.split(",")[0]?.trim();
  return first || req.ip || req.socket?.remoteAddress || "unknown";
}

export interface OtpThrottleResult {
  allowed: boolean;
  /** Seconds until the window frees up — for the client's message. */
  retryAfter: number;
  reason?: "sends" | "targets" | "global";
}

/**
 * Check-and-record. Call once per intended send, and only for the phone
 * branch: email OTPs cost nothing and are deliberately left alone.
 */
export function checkOtpSendAllowed(
  req: any,
  destination: string
): OtpThrottleResult {
  const now = Date.now();
  sweep(now);

  // Global backstop first — it applies no matter who is asking.
  while (globalSends.length && now - globalSends[0] > GLOBAL_WINDOW_MS) {
    globalSends.shift();
  }
  if (globalSends.length >= GLOBAL_MAX_PER_MIN) {
    console.error(
      `[otp-throttle] GLOBAL CAP HIT: ${globalSends.length} phone OTPs in the last minute — ` +
        `sends paused. Latest attempt: ${destination}`
    );
    return { allowed: false, retryAfter: 60, reason: "global" };
  }

  const key = callerKey(req);
  const times = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  const seen = targets.get(key) || new Set<string>();

  const oldest = times[0] ?? now;
  const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));

  if (times.length >= MAX_SENDS) {
    console.warn(
      `[otp-throttle] ${key} blocked: ${times.length} sends in window (last target ${destination})`
    );
    return { allowed: false, retryAfter, reason: "sends" };
  }

  // A repeat to a number already in the window is not enumeration, so it is
  // only counted against MAX_SENDS above.
  if (!seen.has(destination) && seen.size >= MAX_TARGETS) {
    console.warn(
      `[otp-throttle] ${key} blocked: ${seen.size} distinct numbers in window (tried ${destination})`
    );
    return { allowed: false, retryAfter, reason: "targets" };
  }

  times.push(now);
  seen.add(destination);
  hits.set(key, times);
  targets.set(key, seen);
  globalSends.push(now);
  return { allowed: true, retryAfter: 0 };
}

/** Test/ops hook — drops all windows. */
export function resetOtpThrottle() {
  hits.clear();
  targets.clear();
  globalSends.length = 0;
  lastSweep = 0;
}
