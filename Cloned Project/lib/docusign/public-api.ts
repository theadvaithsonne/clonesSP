// Unauthenticated calls for the public, no-login self-sign flow (app/sign/[token]). Deliberately
// separate from the authenticated modules: every function in those goes through api(), which always attaches
// the logged-in user's Bearer token — a public signer has none, and this flow must stay fully
// independent of the internal/authenticated one (same "hard separation" as the backend's routes).
//
// Raw fetch, not api() — mirrors app/f/[token]/ShareableLinkViewer.tsx's own getJson helper.
import { DOCUSIGN_URL } from "./client";
import type { DsBundleStepper, DsField, DsVerifyResult } from "./types";

// `docId` picks one document when the link covers several sent together (a group) — omitted, the backend opens
// the first one still waiting on the signer. Ignored for an ordinary one-document link.
function url(token: string, path = "", docId?: string) {
  const base = DOCUSIGN_URL.endsWith("/") ? DOCUSIGN_URL : `${DOCUSIGN_URL}/`;
  const query = docId ? `?doc=${encodeURIComponent(docId)}` : "";
  return `${base}public/esign/${encodeURIComponent(token)}${path}${query}`;
}

// A stalled connection (weak signal on a phone, a flaky network) used to hang this call forever —
// there is no session to expire on the public flow, so this only needs a timeout, not 401 handling.
const DEFAULT_TIMEOUT_MS = 30_000;

// What every failed call below throws: the HTTP status, and the backend's machine-readable `code`
// when it sent one (e.g. "verification_required" when the email check has lapsed).
export type EsignApiError = Error & { status?: number; code?: string };

// A signer lands here from an email, often much later — say what happened in their terms rather
// than surfacing a bare status code. A 413 may not be JSON at all, so it never relies on the body.
function errorMessage(status: number, body: { message?: string } | undefined): string {
  if (status === 404 || status === 410) {
    return "This signing link is no longer valid. It may have been declined, voided or replaced by a newer link.";
  }
  if (status === 413) return "Your signature image is too large. Please try a smaller image or draw it instead.";
  if (status === 429) return body?.message || "Too many requests — please wait a minute and try again.";
  return body?.message || `Request failed (${status})`;
}

async function getJson<T>(input: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
      signal: init?.signal ?? controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw new Error("Could not reach the server. Please check your connection.");
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status === false) {
    const err: EsignApiError = Object.assign(new Error(errorMessage(res.status, body)), { status: res.status, code: body?.code });
    throw err;
  }
  return body;
}

export interface PublicEsignRecipient {
  _id: string;
  name?: string;
  email: string;
  status: "pending" | "viewed" | "signed" | "declined";
  order: number;
  emailVerifiedAt?: string;
  consentGivenAt?: string;
  signedAt?: string;
  declinedAt?: string;
}

export interface PublicEsignDocument {
  _id: string;
  title: string;
  status: "sent" | "in_progress" | "completed" | "voided";
  message?: string;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  pageCount?: number;
  signingOrder: "sequential" | "parallel";
  originalFileUrl: string;
  flattenedFileUrl?: string;
  certificateFileUrl?: string;
  recipient: PublicEsignRecipient;
}

export const viewEsignDocument = (token: string, docId?: string) =>
  getJson<{
    status: boolean;
    data: {
      document: PublicEsignDocument;
      myFields: DsField[];
      canSign: boolean;
      waitingFor?: { name: string | null; position: number; total: number } | null;
      myStatus: PublicEsignRecipient["status"];
      consent: { version: string; text: string };
      // Already verified — once for every document this link covers, so later ones skip the code step.
      myEmailVerified?: boolean;
      // Present when the link covers several documents sent together: the stepper to walk through them.
      bundle?: DsBundleStepper;
    };
  }>(url(token, "", docId));

export const getEsignFile = (token: string, kind: "original" | "signed" | "certificate", docId?: string) =>
  getJson<{ status: boolean; data: { url: string; kind: string } }>(url(token, `/file/${kind}`, docId));

// Lets the signer verify their own copy's integrity — same capability an internal (logged-in) recipient
// already has, just reached via the token instead of a login. Only meaningful once completed.
export const verifyEsignDocument = (token: string, docId?: string) => getJson<{ status: boolean; data: DsVerifyResult }>(url(token, "/verify", docId));

export const requestEsignOtp = (token: string, docId?: string) =>
  getJson<{ status: boolean; message: string }>(url(token, "/verify-email/request", docId), { method: "POST" });

// A correct code returns a short-lived verificationToken. Sign and decline both require it (as the
// X-Esign-Verification header), so the caller keeps it in memory for this visit only — never in storage.
export const confirmEsignOtp = (token: string, code: string, docId?: string) =>
  getJson<{ status: boolean; message: string; data: { verificationToken: string; expiresAt: string } }>(url(token, "/verify-email/confirm", docId), {
    method: "POST",
    body: JSON.stringify({ code }),
  });

// Missing/expired verification comes back as a 403 with code "verification_required".
const verificationHeader = (verificationToken: string) => ({ "X-Esign-Verification": verificationToken });

export const submitEsignSign = (
  token: string,
  verificationToken: string,
  data: {
    fields: Array<{ fieldId: string; value?: string; checked?: boolean }>;
    signatureType: "draw" | "type" | "upload";
    signatureImageUrl: string;
    consentGiven: true;
    consentTextVersion?: string;
  },
  docId?: string
) =>
  getJson<{ status: boolean; data: PublicEsignDocument }>(url(token, "/sign", docId), {
    method: "POST",
    headers: verificationHeader(verificationToken),
    body: JSON.stringify(data),
  });

// Declining voids the document for everyone and retires every signing link — the same token 404s afterwards.
export const declineEsignSign = (token: string, verificationToken: string, reason?: string, docId?: string) =>
  getJson<{ status: boolean; message: string }>(url(token, "/decline", docId), {
    method: "POST",
    headers: verificationHeader(verificationToken),
    body: JSON.stringify({ reason }),
  });

// A public signer has no platform token to upload with (contrast lib/docusign/internal-api.ts's
// uploadDocusignFile), so the browser-captured signature is sent to submitEsignSign as a base64
// data: URL instead — the backend (controllers/esignSigning.controller.js's materializeImageUrl)
// uploads it server-side, tokenless, before flattening. This just reads the blob into that format.
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
