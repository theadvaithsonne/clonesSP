/**
 * Office KYC — founder-facing client and the types both sides share.
 *
 * A garage admin decides which proofs an office owes (PAN card, address
 * proof, government ID, GST number, plus anything custom they add). The
 * founder answers them from Manage Organization / the KYC nudge, and the
 * admin verifies.
 *
 * Files go straight from the browser to a PRIVATE S3 bucket with a presigned
 * PUT — they never pass through the API, and they are only ever read back
 * through short-lived presigned URLs the server mints per request.
 */
import { api } from "@/lib/api";

export type OrgKycStatus =
  | "not_requested"
  | "pending"
  | "submitted"
  | "verified"
  | "rejected";

export type OrgKycRequirementKind = "file" | "text";

export interface OrgKycRequirement {
  key: string;
  label: string;
  kind: OrgKycRequirementKind;
  description?: string;
  required: boolean;
  custom: boolean;
}

export interface OrgKycSubmission {
  id: string;
  requirementKey: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  textValue?: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
  uploadedAt: string;
  /** Presigned, expires in ~10 minutes. Re-fetch the record for a fresh one. */
  viewUrl?: string;
}

export interface OrgKycRecord {
  orgId: string;
  orgName?: string;
  status: OrgKycStatus;
  storageConfigured: boolean;
  requirements: OrgKycRequirement[];
  submissions: OrgKycSubmission[];
  reviewNote?: string;
  /** Labels of required items with no answer yet. */
  missing: string[];
  requestedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  verifiedAt?: string | null;
  updatedAt?: string;
}

export interface OrgKycNudge {
  applicable: boolean;
  orgId?: string;
  status?: OrgKycStatus;
  reviewNote?: string;
  missing?: string[];
  requirementCount?: number;
}

export const ORG_KYC_STATUS_LABEL: Record<OrgKycStatus, string> = {
  not_requested: "Not requested",
  pending: "Documents pending",
  submitted: "Under review",
  verified: "Verified",
  rejected: "Changes requested",
};

/** Is there anything for this founder to do right now? */
export function orgKycNeedsFounderAction(status?: OrgKycStatus): boolean {
  return status === "pending" || status === "rejected";
}

/** Cheap status check for the current office — safe to call for anyone. */
export function fetchOrgKycNudge(): Promise<OrgKycNudge> {
  return api<OrgKycNudge>("/org-kyc/me");
}

export function fetchOrgKyc(orgId: string): Promise<OrgKycRecord> {
  return api<OrgKycRecord>(`/org-kyc/${orgId}`);
}

export function submitOrgKyc(orgId: string): Promise<OrgKycRecord> {
  return api<OrgKycRecord>(`/org-kyc/${orgId}/submit`, { method: "POST" });
}

export function saveOrgKycText(
  orgId: string,
  requirementKey: string,
  textValue: string,
): Promise<OrgKycRecord> {
  return api<OrgKycRecord>(`/org-kyc/${orgId}/submissions`, {
    method: "POST",
    body: JSON.stringify({ requirementKey, textValue }),
  });
}

export function deleteOrgKycSubmission(
  orgId: string,
  submissionId: string,
): Promise<OrgKycRecord> {
  return api<OrgKycRecord>(`/org-kyc/${orgId}/submissions/${submissionId}`, {
    method: "DELETE",
  });
}

/**
 * Presign → PUT to S3 → record the key. Three steps on purpose: the file
 * bytes never touch the API server, and the document only becomes part of the
 * packet once S3 has actually accepted it.
 */
export async function uploadOrgKycFile(
  orgId: string,
  requirementKey: string,
  file: File,
): Promise<OrgKycRecord> {
  const presigned = await api<{
    s3Key: string;
    uploadUrl: string;
    uploadHeaders: Record<string, string>;
  }>(`/org-kyc/${orgId}/upload-url`, {
    method: "POST",
    body: JSON.stringify({
      requirementKey,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });

  let put: Response;
  try {
    put = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: presigned.uploadHeaders,
      body: file,
    });
  } catch {
    // fetch only rejects here for network-level failures, and by far the most
    // common cause is the KYC bucket missing a CORS rule — the browser blocks
    // the PUT before S3 ever sees it. Say so, because the raw "Failed to
    // fetch" sends people hunting for the wrong bug.
    throw new Error(
      "Couldn't reach the document store. If this keeps happening, the KYC bucket needs its CORS rule.",
    );
  }
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Please try again.`);
  }

  return api<OrgKycRecord>(`/org-kyc/${orgId}/submissions`, {
    method: "POST",
    body: JSON.stringify({
      requirementKey,
      s3Key: presigned.s3Key,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    }),
  });
}
