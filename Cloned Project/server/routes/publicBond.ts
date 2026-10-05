// Public bond page — no login.
//
//   GET /public/bonds/:bondHash
//
// Anyone with a bond's hash can see its value, interest paid, remaining
// payments and payout log — the "look up any bond" experience. What is
// deliberately NOT exposed is listed on buildPublicBondView.
//
// Bonds can only be issued by crypto-office founders, so every bond
// reachable here is a crypto-office bond by construction.

import { Router, Request, Response, NextFunction } from "express";
import { BondHolding } from "../models/bondHolding.model";
import { normalizeBondHash } from "../services/bondHash";
import { buildPublicBondView, loadViewSources } from "../services/bondView";

const router = Router();

// ── Rate limiting ────────────────────────────────────────────────────
// Unauthenticated + an FX lookup per call, so it needs a ceiling. No
// dependency: a fixed-window counter per client IP, per instance.
//
// The app does not set `trust proxy`, so behind the reverse proxy
// `req.ip` is the PROXY's address — limiting on it would throttle every
// visitor as one client. The real client is the first X-Forwarded-For
// entry. That header is client-spoofable, so treat this as abuse
// damping, not a security boundary; the bond hash's unguessability is
// what actually protects bond data.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim();
  return first || req.ip || "unknown";
}

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const ip = clientIp(req);
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return next();
  }
  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      error: `Too many lookups. Try again in ${retryAfter}s.`,
    });
  }
  next();
}

// Keep the map from growing without bound.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, e] of hits) if (e.windowStart < cutoff) hits.delete(ip);
}, WINDOW_MS).unref();

router.get("/:bondHash", rateLimit, async (req: Request, res: Response) => {
  try {
    const bondHash = normalizeBondHash(req.params.bondHash);
    if (!bondHash) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BOND_HASH",
        error: "A bond hash is 12 digits.",
      });
    }

    const logLimit = Math.min(200, Math.max(1, Number(req.query.logLimit) || 50));
    const logOffset = Math.max(0, Number(req.query.logOffset) || 0);

    const holding = await BondHolding.findOne({ bondHash }).lean();
    // Unpaid / cancelled positions were never real bonds — don't reveal
    // that the hash exists at all.
    if (!holding || holding.status === "pending_payment" || holding.status === "cancelled") {
      return res.status(404).json({
        success: false,
        code: "BOND_NOT_FOUND",
        error: "No bond with that hash.",
      });
    }

    const [src] = await loadViewSources([holding]);
    if (!src) {
      return res.status(404).json({
        success: false,
        code: "BOND_NOT_FOUND",
        error: "No bond with that hash.",
      });
    }

    // Short shared cache: the page is identical for every visitor and
    // only changes when a payout lands (at most hourly).
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({
      success: true,
      bond: buildPublicBondView(src, { limit: logLimit, offset: logOffset }),
    });
  } catch (err: any) {
    console.error("[public/bonds] lookup error:", err);
    return res.status(500).json({ success: false, code: "BOND_LOOKUP_FAILED", error: "Lookup failed" });
  }
});

export default router;
