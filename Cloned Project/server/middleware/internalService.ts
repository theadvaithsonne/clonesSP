// Guard for service-to-service endpoints. Rejects any request that:
//   - lacks the shared X-Internal-Token header, OR
//   - carries an Authorization header (confused-deputy defense — the
//     internal surface must never be reachable through a user JWT).

import { Request, Response, NextFunction } from "express";

export function requireInternalService(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN || "";
  if (!expected) {
    return res.status(503).json({
      error: "internal_service_disabled",
      message: "INTERNAL_SERVICE_TOKEN not configured on this backend",
    });
  }
  const token = req.header("x-internal-token");
  if (!token || token !== expected) {
    return res.status(401).json({ error: "invalid_internal_token" });
  }
  if (req.header("authorization")) {
    return res.status(400).json({
      error: "authorization_header_not_allowed",
      message: "internal endpoints must not carry user-auth headers",
    });
  }
  next();
}
