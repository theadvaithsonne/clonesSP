// The DocuSign HTTP client: the shared fetch wrapper, base URLs, timeouts, and the two file
// helpers that bypass api() because they move bytes rather than JSON.
//
// Flow-agnostic on purpose. internal-api, external-api and shared-api all build on this;
// nothing here knows about documents vs esign-documents.

import { getToken } from "../auth";

// Thrown instead of a generic Error when a DocuSign request comes back 401 — lets callers
// show "please sign in again" instead of a bare "Server error (401)" toast.
export class DocusignAuthExpiredError extends Error {
  // Same field api() puts on every other failure, so callers can check `err.status` alone.
  readonly status = 401;
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "DocusignAuthExpiredError";
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;

// Large PDF uploads and evidence-package downloads can legitimately take longer than a plain JSON call.
export const UPLOAD_TIMEOUT_MS = 120_000;

export function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// A DocuSign-scoped copy of lib/api.ts's api() — not a change to that shared function, so the rest of
// the app keeps its current behavior. Adds two things the shared api() doesn't do: a request timeout
// (a stalled upload or evidence download used to hang forever with no way to fail and retry), and
// reliable 401 detection (via the raw Response.status, before error parsing collapses it into a plain
// message string that's easy to miss in a generic toast).
export async function api<T>(path: string, opts: RequestInit = {}, token?: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const auth = token ?? getToken() ?? undefined;
  const isFormData = opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  };
  if (!isFormData) headers["Content-Type"] = "application/json";

  const { signal, cancel } = timeoutSignal(timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      ...opts,
      headers: { ...headers, ...(opts.headers || {}) },
      cache: "no-store",
      signal: opts.signal ?? signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    console.error(`[DocuSign API] Failed to fetch: ${path}`, err);
    throw new Error("Failed to connect to the DocuSign service. Please check your connection.");
  } finally {
    cancel();
  }

  if (res.status === 401) throw new DocusignAuthExpiredError();
  if (!res.ok) {
    const text = await res.text();
    let msg = `Server error (${res.status})`;
    let errors: unknown;
    let documentId: string | undefined;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || msg;
      // Per-field validation problems, when the endpoint returns them (e.g. PUT branding).
      if (Array.isArray(j.errors)) errors = j.errors;
      // Which document of a group is the problem (e.g. POST …/bundle/:id/send).
      if (typeof j.documentId === "string") documentId = j.documentId;
    } catch {}
    // The HTTP status rides along so a caller can tell "not allowed / gone" (403/404) apart from a
    // transient failure without matching on the message text.
    throw Object.assign(new Error(msg), { status: res.status, ...(errors ? { errors } : {}), ...(documentId ? { documentId } : {}) });
  }
  return res.json();
}

export const DOCUSIGN_URL = process.env.NEXT_PUBLIC_DOCUSIGN_URL || "https://docusign.garage.app/docusign/v1/";

// Matches the docusign backend's default download cap (MAX_REMOTE_FILE_BYTES) — checked
// client-side so an oversized PDF is rejected before spending the upload round-trip.
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

// Separate service from NEXT_PUBLIC_API_URL (the main garage auth backend) — this one
// hosts the generic S3 upload API (/api/s3upload/single). Confirmed: test.garage.app
// 404s on that route while uatapi.garage.app serves it (same host test-s3-upload.html
// is on, and the one NEXT_PUBLIC_TASKROOM_URL already points at).
export const GARAGE_UPLOAD_URL =
  process.env.NEXT_PUBLIC_GARAGE_UPLOAD_URL || "https://uatapi.garage.app";

export function url(path: string) {
  const base = DOCUSIGN_URL.endsWith("/") ? DOCUSIGN_URL : `${DOCUSIGN_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
}

// Appends page/limit (and any other params) as a query string, skipping undefined
// values — shared by every paginated list call below so each one doesn't hand-build
// its own "?a=1&b=2" string.
export function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${path}?${qs}` : path;
}

// SHA-256 of a file, computed here in the browser with Web Crypto (instant for a normal PDF). Resolves to null when
// hashing is not available (very old browser / non-secure page) — the backend then fingerprints the file at completion.
export const sha256Hex = async (file: Blob): Promise<string | null> => {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
};

// ── File upload — straight to the main garage backend's generic S3 endpoint, same
// pattern CabinetPage.tsx uses for cabinet files. Used for both the original PDF and
// captured signature images; only the resulting URL is ever sent to the docusign
// backend (see createDocument / signDocument above) — the backend never handles raw
// upload bytes for these.
export const uploadDocusignFile = async (
  file: File | Blob,
  filename = "file",
  folder = "docusign"
): Promise<{ url: string; key?: string }> => {
  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("folder", folder);

  const token = getToken();
  const { signal, cancel } = timeoutSignal(UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${GARAGE_UPLOAD_URL.replace(/\/+$/, "")}/api/s3upload/single`, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("The upload timed out. Check your connection and try again.");
    throw new Error("Could not reach the upload service. Please check your connection.");
  } finally {
    cancel();
  }
  if (res.status === 401) throw new DocusignAuthExpiredError();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return { url: json.url || json.data?.url, key: json.key || json.data?.key };
};
