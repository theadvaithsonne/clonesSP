import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Single shared API key for the public analytics endpoints.
 *
 * Reads the `X-API-KEY` request header and compares (constant-time) against
 * `process.env.ANALYTICS_API_KEY`. Returns 401 on missing / mismatched key
 * and 503 if the server has no key configured.
 *
 * This is intentionally simpler than the ThirdPartyClient flow used by the
 * invoice integration:
 *   - One value for all partners — rotating means redeploying.
 *   - No scopes, no per-partner revocation.
 *
 * Chosen for analytics so the key lives in one place (`.env`) and can be
 * handed over directly without a DB issuance step.
 */
export function requireAnalyticsKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expected = process.env.ANALYTICS_API_KEY;
  if (!expected) {
    res
      .status(503)
      .json({ error: "Analytics API not configured", code: "NOT_CONFIGURED" });
    return;
  }

  const provided = req.headers["x-api-key"];
  const providedStr = typeof provided === "string" ? provided : "";
  if (!providedStr) {
    res
      .status(401)
      .json({ error: "Missing x-api-key header", code: "MISSING_API_KEY" });
    return;
  }

  // Constant-time comparison — equal-length buffers required, so we bail
  // early if lengths differ (the length itself isn't a secret).
  const a = Buffer.from(providedStr);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
    return;
  }

  next();
}
