// Plain-fetch client for the public Garage Jobs endpoints. No auth header:
// these pages must work for visitors without a Garage account. Also used by
// the route files' `generateMetadata`, so it has no client-only imports.

import type { CareersResponse, PublicJobResponse } from "./types";

export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export class PublicJobsError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function getJson<T>(path: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<T> {
  let res: Response;
  try {
    // Server metadata passes `next.revalidate`; mixing that with `cache` makes
    // Next warn, so "no-store" is only the default for plain client fetches.
    res = await fetch(`${PUBLIC_API_URL}${path}`, init?.next ? init : { cache: "no-store", ...init });
  } catch {
    throw new PublicJobsError("Couldn't reach Garage. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    let message = res.status === 404 ? "Not found" : `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* keep the status message */
    }
    throw new PublicJobsError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export function fetchCareersPage(orgSlug: string, init?: RequestInit & { next?: { revalidate?: number } }) {
  return getJson<CareersResponse>(`/jobs/public/org/${encodeURIComponent(orgSlug)}`, init);
}

export function fetchPublicJob(
  orgSlug: string,
  jobSlug: string,
  ref?: string | null,
  init?: RequestInit & { next?: { revalidate?: number } }
) {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return getJson<PublicJobResponse>(
    `/jobs/public/job/${encodeURIComponent(orgSlug)}/${encodeURIComponent(jobSlug)}${q}`,
    init
  );
}

/** Count one view for the job's analytics. Best-effort — never throws. */
export function recordJobView(jobId: string, source: string): void {
  fetch(`${PUBLIC_API_URL}/jobs/public/job/${encodeURIComponent(jobId)}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
    keepalive: true,
  }).catch(() => {});
}
