/**
 * Step-up verification for the garage admin console ("Verify your admin").
 *
 * The console's only login factor is an emailed OTP, and the JWT it mints
 * lives for 7 days in localStorage — so a lifted token is a week of
 * unrestricted admin access. This adds a second, out-of-band question that
 * has to be answered once per login before the admin APIs will answer.
 *
 * Getting it wrong signs you out rather than locking the account. That is
 * not the softer option — it's the stronger one:
 *
 *   - There is no lockout state to strand the only super admin in.
 *   - The sign-out is real. Exhausting the attempts stamps
 *     `sessionsInvalidatedAt` on the admin, which kills every token issued
 *     before that instant — including the one the guesser is holding.
 *     Clearing localStorage alone would do nothing to an attacker.
 *   - So each round of guesses costs a fresh OTP delivered to the admin's
 *     mailbox. That is the rate limit, and it's a much harder one to grind
 *     than a timed lock.
 *
 * Threat model, stated plainly so nobody over-trusts this:
 *   - Reading the repo tells you nothing. Only hashes are stored.
 *   - Reading the database tells you nothing either, but only because of
 *     the pepper. The answers ("7", "Ferrari") are worth maybe 7-9 bits; a
 *     bare bcrypt hash of one falls to a wordlist in under a minute.
 *   - It does NOT defend against someone who already knows the answer.
 *     Shared trivia verifies "you're on the team", not "you're this person".
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env";

/** bcrypt work factor. ~250ms/guess on prod hardware. */
const BCRYPT_ROUNDS = 12;
/**
 * Wrong answers allowed per login before the session is destroyed. Three is
 * room for a typo, not room for a search.
 */
export const MAX_ATTEMPTS = 3;

export interface AdminVerificationQuestion {
  id: string;
  prompt: string;
  answerHash: string;
}

export interface AdminVerificationState {
  questions?: AdminVerificationQuestion[];
  failedAttempts?: number;
  lastVerifiedAt?: Date | null;
  lastFailedAt?: Date | null;
}

/**
 * Fold away the differences a human can't see: case, surrounding and
 * repeated whitespace, and punctuation. "  Ferrari! " and "ferrari" must
 * agree or the gate becomes a coin toss.
 *
 * Note it does NOT map words to digits — "seven" and "7" stay different
 * answers, so seed whichever form you'll actually type.
 */
export function normalizeAnswer(raw: string): string {
  return String(raw ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The secret mixed into every answer before hashing, without which the
 * stored hashes are worth nothing.
 *
 * Defaults to a value derived from JWT_SECRET so this needs no new
 * environment variable to be secure: JWT_SECRET is already deployment-only,
 * already absent from the repo, and anyone holding it can mint an admin
 * token outright — so it is not a weaker secret to lean on. Set
 * ADMIN_VERIFY_PEPPER to decouple the two; rotating either invalidates
 * every stored answer, which then has to be re-seeded.
 */
function pepper(): string {
  if (env.ADMIN_VERIFY_PEPPER) return env.ADMIN_VERIFY_PEPPER;
  if (!env.JWT_SECRET) {
    throw new Error(
      "Neither ADMIN_VERIFY_PEPPER nor JWT_SECRET is set — refusing to hash or check an admin verification answer"
    );
  }
  return crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update("garage-admin-verification-pepper/v1")
    .digest("hex");
}

function peppered(answer: string): string {
  return `${pepper()}:${normalizeAnswer(answer)}`;
}

export async function hashAnswer(raw: string): Promise<string> {
  const normalized = normalizeAnswer(raw);
  if (!normalized) throw new Error("Answer is empty after normalization");
  return bcrypt.hash(peppered(raw), BCRYPT_ROUNDS);
}

export async function answerMatches(
  raw: string,
  answerHash: string
): Promise<boolean> {
  if (!answerHash) return false;
  try {
    return await bcrypt.compare(peppered(raw), answerHash);
  } catch {
    return false;
  }
}

/** The global off switch — recovery path if this ever goes wrong in prod. */
export function gateEnforced(): boolean {
  return String(env.ADMIN_VERIFY_ENFORCE).toLowerCase() !== "off";
}

/**
 * Whether this admin is gated at all.
 *
 * Opt-in by data: an admin with no seeded questions passes straight
 * through. That is what makes rollout safe — seeding one account cannot
 * lock any other admin out of the console.
 */
export function isGated(state?: AdminVerificationState | null): boolean {
  return gateEnforced() && !!state?.questions?.length;
}

/**
 * Every question's prompt, in a stable order, with the hashes stripped.
 *
 * The console shows one at a time and lets the admin swap to another — a
 * question you can't answer right now (whose car? which number?) shouldn't
 * cost you the session. Prompts aren't secret; only the answers are, so
 * handing over the whole list costs nothing and saves a round trip.
 */
export function listQuestions(
  state?: AdminVerificationState | null
): { id: string; prompt: string }[] {
  return (state?.questions ?? []).map((q) => ({ id: q.id, prompt: q.prompt }));
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "unknown_question" }
  | { ok: false; reason: "wrong"; attemptsLeft: number; signOut: boolean };

/**
 * Check one answer and fold the attempt counter forward. Returns the state
 * to persist alongside the outcome, so this stays testable without a
 * database. The caller is responsible for acting on `signOut` — that's
 * where the session actually gets destroyed.
 */
export async function evaluateAnswer(
  state: AdminVerificationState,
  questionId: string,
  rawAnswer: string
): Promise<{ outcome: VerifyOutcome; next: AdminVerificationState }> {
  const question = (state.questions ?? []).find((q) => q.id === questionId);
  if (!question) {
    return { outcome: { ok: false, reason: "unknown_question" }, next: state };
  }

  if (await answerMatches(rawAnswer, question.answerHash)) {
    return {
      outcome: { ok: true },
      next: { ...state, failedAttempts: 0, lastVerifiedAt: new Date() },
    };
  }

  const attempts = (state.failedAttempts ?? 0) + 1;
  const signOut = attempts >= MAX_ATTEMPTS;

  return {
    outcome: {
      ok: false,
      reason: "wrong",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
      signOut,
    },
    // The counter is per login: it resets here on sign-out, and again on
    // the next successful login, so a typo three weeks ago never counts
    // against today's session.
    next: {
      ...state,
      failedAttempts: signOut ? 0 : attempts,
      lastFailedAt: new Date(),
    },
  };
}
