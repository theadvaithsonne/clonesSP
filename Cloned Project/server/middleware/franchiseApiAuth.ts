import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

/**
 * Shared-secret auth for the franchise app's API access.
 *
 * The franchise app (roam-admin-prod) sends `X-Franchise-API-Key: <secret>`
 * with every request. We compare with the server-side env value using a
 * constant-time compare to prevent timing attacks.
 */
export function requireFranchiseApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expected = process.env.FRANCHISE_API_KEY;
  if (!expected || expected.length === 0) {
    res.status(500).json({
      error: "Franchise API not configured on this server",
      code: "FRANCHISE_API_NOT_CONFIGURED",
    });
    return;
  }

  const provided = (req.headers["x-franchise-api-key"] as string | undefined) || "";
  if (!provided) {
    res.status(401).json({
      error: "Missing X-Franchise-API-Key header",
      code: "MISSING_API_KEY",
    });
    return;
  }

  // Equalize lengths for timing-safe compare.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    res.status(401).json({
      error: "Invalid API key",
      code: "INVALID_API_KEY",
    });
    return;
  }

  next();
}
