// lib/downlines-api.ts
// Tiny wrapper around /downlines/enroll for the Enroll-a-Downline slide-in.

import { api } from "@/lib/api";

export interface EnrollDownlineInput {
  orgId: string;
  email: string;
  name?: string;
  phone?: string;
  // Location flow mirrors ProfilePopover: caller picks Country, types Postal
  // Code, and the FE resolver auto-fills City + State (user can override).
  country?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  designation?: string;
}

export interface EnrollDownlineResult {
  success: boolean;
  user: { _id: string; email: string; name: string | null };
  orgName: string;
}

export interface EnrollDownlineError extends Error {
  code?: string;
  status?: number;
}

/**
 * Pre-register a new user under the caller's referral, in the chosen office.
 * Throws an `EnrollDownlineError` with `code` set to the backend error code
 * (USER_EXISTS / NOT_A_MEMBER / INVALID_BODY / etc.) so the caller can
 * surface specific UI states without parsing strings.
 */
export async function enrollDownline(
  body: EnrollDownlineInput
): Promise<EnrollDownlineResult> {
  try {
    return await api<EnrollDownlineResult>("/downlines/enroll", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    // `api()` throws a plain Error with message = backend's `error` or
    // `message` field. Bubble it as-is; the message string is what we
    // surface in the inline banner.
    const e: EnrollDownlineError = new Error(err?.message || "Failed to enroll downline");
    throw e;
  }
}

/**
 * Pre-flight check: does a Garage user with this email already exist?
 * Lets the FE block the submit button BEFORE the user fills out the
 * rest of the form. Server-side `enrollDownline` still rejects with
 * USER_EXISTS as a safety net.
 */
export async function checkDownlineEmail(
  email: string
): Promise<{ exists: boolean }> {
  const res = await api<{ success: boolean; exists: boolean }>(
    `/downlines/check-email?email=${encodeURIComponent(email)}`,
    { method: "GET" }
  );
  return { exists: !!res.exists };
}
