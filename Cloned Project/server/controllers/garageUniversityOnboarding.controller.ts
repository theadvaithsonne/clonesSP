import { Request, Response } from "express";
import type { AuthUser } from "../middleware/auth";
import {
  OnboardingError,
  createOnboarding,
  getOnboarding,
  updateOnboarding,
} from "../services/garageUniversityOnboarding.service";

/**
 * Garage University onboarding profile — the signed-in user's own, keyed by
 * the token's userId (requireAuth). GU tokens may carry no orgId, and the
 * profile belongs to the person, not an office, so none is required.
 *
 * Every outcome is JSON: `{ success: true, data }`, or
 * `{ success: false, error, code, ...extra }` for failures.
 */

const me = (req: Request) => (req as any).user as AuthUser;

// MongoDB errors that mean "the database can't be reached right now".
const UNAVAILABLE = new Set([
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
  "MongoTopologyClosedError",
]);

function sendError(res: Response, err: any, action: string) {
  if (err instanceof OnboardingError) {
    return res.status(err.status).json({ success: false, error: err.message, code: err.code, ...(err.extra || {}) });
  }
  // Two first saves racing into the unique userId index.
  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      error: "Onboarding profile already exists — use PATCH to change it",
      code: "ONBOARDING_EXISTS",
    });
  }
  // Mongoose's own checks are a safety net behind the request validation.
  if (err?.name === "ValidationError" || err?.name === "CastError") {
    return res.status(400).json({ success: false, error: err.message, code: "INVALID_FIELD" });
  }
  if (UNAVAILABLE.has(err?.name)) {
    console.error(`[GU onboarding] Database unavailable while trying to ${action}:`, err);
    return res.status(503).json({
      success: false,
      error: "The service is temporarily unavailable. Please try again shortly.",
      code: "SERVICE_UNAVAILABLE",
    });
  }
  console.error(`[GU onboarding] Failed to ${action}:`, err);
  return res.status(500).json({ success: false, error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" });
}

/** GET /garage-university/onboarding — my profile, or `data: null` if I haven't started. */
export async function getMyOnboarding(req: Request, res: Response) {
  try {
    const profile = await getOnboarding(me(req).userId);
    return res.json({ success: true, data: profile });
  } catch (err) {
    return sendError(res, err, "load the onboarding profile");
  }
}

/** POST /garage-university/onboarding — create my profile, optionally with answers. */
export async function createMyOnboarding(req: Request, res: Response) {
  try {
    const profile = await createOnboarding(me(req), req.body);
    return res.status(201).json({ success: true, data: profile });
  } catch (err) {
    return sendError(res, err, "create the onboarding profile");
  }
}

/** PATCH /garage-university/onboarding — change any answers; `{ completed: true }` finishes onboarding. */
export async function updateMyOnboarding(req: Request, res: Response) {
  try {
    const profile = await updateOnboarding(me(req), req.body);
    return res.json({ success: true, data: profile });
  } catch (err) {
    return sendError(res, err, "update the onboarding profile");
  }
}
