import { API_URL } from "@/lib/api";

// Step-up verification for the admin console ("Verify your admin").
//
// Asked once per login, not per refresh: the answer re-mints the admin JWT
// with a verified claim, so a page refresh reuses the same stored token and
// sails through, while a fresh login gets a token without the claim.
//
// These two calls talk to the backend directly rather than through
// `garageAdminApi`, which collapses every non-2xx into `new Error(message)`.
// The gate needs the body on a failure — attempts remaining, lock state.
// Backend: garagenew-backend/src/routes/garageAdminVerify.ts

export interface AdminVerifyChallenge {
  required: boolean;
  attemptsLeft?: number;
  /** Every prompt the admin could be asked — hashes never leave the server. */
  questions?: { id: string; prompt: string }[];
}

/**
 * Flat rather than a discriminated union on purpose: this repo compiles
 * with `strict: false`, where narrowing a union by a boolean literal
 * doesn't work and every failure field reads as a type error.
 */
export interface AdminVerifyResult {
  ok: boolean;
  message?: string;
  /** Attempts are spent: the server has killed this token, so sign out. */
  signOut?: boolean;
  attemptsLeft?: number;
}

const TOKEN_KEY = "garage_admin_token";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function url(path: string): string {
  return `${(API_URL || "http://localhost:4000").replace(/\/+$/, "")}${path}`;
}

/**
 * Whether this admin still owes an answer, and which question to ask.
 *
 * Fails open on a network error: the gate is a client-side prompt, and the
 * backend refuses every admin route on its own until the token is verified.
 * A blank wall because the challenge call timed out helps nobody.
 */
export async function getAdminVerifyChallenge(): Promise<AdminVerifyChallenge> {
  try {
    const res = await fetch(url("/garage-admin/verify/challenge"), {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return { required: false };
    const body = await res.json();
    return (body?.data ?? { required: false }) as AdminVerifyChallenge;
  } catch {
    return { required: false };
  }
}

/** Submit an answer. On success the re-minted token replaces the stored one. */
export async function submitAdminVerification(
  questionId: string,
  answer: string,
): Promise<AdminVerifyResult> {
  let res: Response;
  try {
    res = await fetch(url("/garage-admin/verify"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ questionId, answer }),
    });
  } catch {
    return {
      ok: false,
      message: "Couldn't reach the server. Check your connection and try again.",
      attemptsLeft: 1,
    };
  }

  const body = await res.json().catch(() => ({}) as any);

  if (res.ok && body?.data?.token) {
    // The new token carries the verified claim. Everything in the console
    // reads this key, so the swap is the whole handoff.
    localStorage.setItem(TOKEN_KEY, body.data.token);
    return { ok: true };
  }
  if (res.ok) return { ok: true }; // gate not configured for this admin

  return {
    ok: false,
    message: body?.message || "That's not the right answer.",
    signOut: !!body?.signOut,
    attemptsLeft: Number(body?.attemptsLeft ?? 0),
  };
}

/** Drop the admin's credentials and send them back to the login screen. */
export function signOutAdmin(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("garage_admin_info");
  } catch {
    /* ignore */
  }
  window.location.href = "/garage-admin/login";
}
