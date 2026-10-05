// Step-up verification for the admin console — the "Verify your admin"
// gate that stands in front of the dashboard once per login.
//
//   GET  /garage-admin/verify/challenge
//        Does this admin still owe a verification, and which questions can
//        be asked? Returns every prompt (never a hash) so the console can
//        offer "Ask me a different question" without another round trip.
//   POST /garage-admin/verify  { questionId, answer }
//        Correct → re-mints the caller's JWT with `adminVerified: true`.
//        Out of attempts → stamps sessionsInvalidatedAt, which kills this
//        token server-side, and tells the console to sign out.
//
// Mounted BEFORE garageAdminPageGate in app.ts, so these two endpoints stay
// reachable while everything behind the gate is refusing the caller.
//
// See services/adminVerification for the hashing and attempt rules.
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ok, fail } from "../utils/http";
import { GarageAdminModel } from "../models/garageAdmin.model";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import {
  evaluateAnswer,
  isGated,
  listQuestions,
  MAX_ATTEMPTS,
  type AdminVerificationState,
} from "../services/adminVerification";

const router = Router();

/** The hashes live behind `select: false`; ask for them explicitly. */
async function loadState(
  adminId: string
): Promise<AdminVerificationState | null> {
  const doc = await GarageAdminModel.findById(adminId)
    .select("+verification")
    .lean<{ verification?: AdminVerificationState }>();
  return doc?.verification ?? null;
}

router.get(
  "/verify/challenge",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res) => {
    const admin = req.garageAdmin!;
    const state = await loadState(admin.id);

    // Not seeded (or the gate is switched off) → nothing to answer.
    if (!isGated(state)) return res.json(ok({ required: false }));
    // Already answered on this token.
    if (admin.verified) return res.json(ok({ required: false }));

    return res.json(
      ok({
        required: true,
        questions: listQuestions(state),
        attemptsLeft: Math.max(
          0,
          MAX_ATTEMPTS - (state!.failedAttempts ?? 0)
        ),
      })
    );
  }
);

router.post(
  "/verify",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res) => {
    const admin = req.garageAdmin!;
    const { questionId, answer } = req.body ?? {};
    if (typeof questionId !== "string" || typeof answer !== "string") {
      return res.status(400).json(fail("questionId and answer are required"));
    }

    const state = await loadState(admin.id);
    if (!isGated(state)) {
      // Nothing configured — don't hand out a verified token for free;
      // the gate simply doesn't apply to this admin.
      return res.json(ok({ verified: true, required: false }));
    }

    const { outcome, next } = await evaluateAnswer(state!, questionId, answer);

    if (!outcome.ok && outcome.reason === "unknown_question") {
      return res.status(400).json(fail("Unknown question"));
    }

    if (!outcome.ok) {
      const update: Record<string, any> = {
        verification: { ...state, ...next },
      };
      if (outcome.signOut) {
        // The actual sign-out. Everything this admin holds stops working
        // on the next request — including the token being used to guess.
        update.sessionsInvalidatedAt = new Date();
      }
      await GarageAdminModel.updateOne({ _id: admin.id }, { $set: update });

      console.warn(
        `[AdminVerify] wrong answer from ${admin.email} (${admin.id})` +
          (outcome.signOut ? " — attempts exhausted, sessions invalidated" : "")
      );

      return res.status(401).json({
        success: false,
        message: outcome.signOut
          ? "Too many incorrect answers. You've been signed out."
          : "That's not the right answer.",
        signOut: outcome.signOut,
        attemptsLeft: outcome.attemptsLeft,
      });
    }

    await GarageAdminModel.updateOne(
      { _id: admin.id },
      { $set: { verification: { ...state, ...next } } }
    );

    // Re-mint the caller's own token with the verified claim. The original
    // expiry is preserved deliberately — verifying is not a reason to
    // silently extend a 7-day session by another 7 days.
    const raw = (req.headers.authorization || "").substring(7);
    const decoded: any = jwt.decode(raw) || {};
    const secondsLeft = decoded.exp
      ? Math.max(60, decoded.exp - Math.floor(Date.now() / 1000))
      : 7 * 24 * 60 * 60;

    const token = jwt.sign(
      {
        garageAdminId: admin.id,
        role: admin.role,
        email: admin.email,
        adminVerified: true,
      },
      env.JWT_SECRET as jwt.Secret,
      { algorithm: "HS256", expiresIn: secondsLeft }
    );

    console.log(`[AdminVerify] ${admin.email} verified`);
    return res.json(ok({ verified: true, token }));
  }
);

export default router;
