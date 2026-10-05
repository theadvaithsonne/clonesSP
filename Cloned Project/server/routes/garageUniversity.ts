import { NextFunction, Request, Response, Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createMyOnboarding,
  getMyOnboarding,
  updateMyOnboarding,
} from "../controllers/garageUniversityOnboarding.controller";

/**
 * Garage University — mounted at /garage-university.
 *
 *   GET   /onboarding   the signed-in user's onboarding profile (`data: null` before they start)
 *   POST  /onboarding   create it (optionally with answers)
 *   PATCH /onboarding   change answers; `{ completed: true }` finishes onboarding
 *
 * POST also takes `orgId`, the organisation the profile belongs to (the
 * Garage University app sends its own). It can't be changed afterwards:
 * PATCH with `orgId` is a 400 READ_ONLY_FIELD.
 *
 * There's no id in the path: the token's userId picks the profile, so nobody
 * can read or edit someone else's. Guards are attached PER ROUTE, never
 * `router.use(requireAuth)` — see the Express note in CLAUDE.md.
 *
 * Everything under the prefix answers in JSON, including unknown paths,
 * unsupported methods and bad request bodies (garageUniversityErrorHandler).
 */

const router = Router();

router.get("/onboarding", requireAuth, getMyOnboarding);
router.post("/onboarding", requireAuth, createMyOnboarding);
router.patch("/onboarding", requireAuth, updateMyOnboarding);
router.all("/onboarding", (req: Request, res: Response) => {
  res.set("Allow", "GET, POST, PATCH");
  res.status(405).json({ success: false, error: `${req.method} isn't supported here`, code: "METHOD_NOT_ALLOWED" });
});

// Only paths under /garage-university reach this router, so this can't shadow anything else.
router.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}`, code: "NOT_FOUND" });
});

/**
 * JSON errors for /garage-university. Mount right after the router, on the
 * same prefix: it also catches failures from the app-wide body parser (bad
 * JSON, oversized body), which happen before the router runs.
 */
export function garageUniversityErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, error: "Request body isn't valid JSON", code: "INVALID_JSON" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, error: "Request body is too large", code: "BODY_TOO_LARGE" });
  }
  console.error(`[GU onboarding] Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ success: false, error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" });
}

export default router;
