// EXTERNAL flow: documents emailed to people who have no account. The founder/admin either
// fills in and completes every field on their behalf, or sends a public no-login sign link.
// Backed by the esign_* collections; every route here is under esign-documents/.
//
// The signer's own unauthenticated calls live in public-api.ts, not here.

import { getToken } from "../auth";
import { DocusignAuthExpiredError, UPLOAD_TIMEOUT_MS, api, timeoutSignal, url, withQuery } from "./client";
import type { DsAuditLogEntry, DsBundle, DsCopiesProgress, DsDeliveryMode, DsField, DsPagination, DsVerifyResult, FolderFilter } from "./types";

// ── External signatures (founder fills in + completes on behalf of external emails) ──
// Deliberately separate types from DsDocument/DsRecipient/DsField — this flow is a
// fully separate backend collection (esign_*), not a variant of the internal one.
// Recipients never log in or take any action themselves — the founder fills in and
// signs every field, then recipients just get a copy of the finished PDF by email.
export interface DsExternalDocument {
  _id: string;
  orgId: string;
  ownerUserId: string;
  title: string;
  envelopeId?: string;
  originalFileUrl: string;
  originalFileKey?: string;
  pageCount?: number;
  // The folder this is filed under — reuses the same ds_folder list internal documents use (a folder can
  // hold both). Absent/null = Global.
  folderId?: string | null;
  // "sent"/"in_progress" only exist for the send-for-signature (self-sign) path — fill-on-behalf
  // still goes straight draft -> completed.
  status: "draft" | "sent" | "in_progress" | "completed" | "voided";
  signingOrder?: "sequential" | "parallel";
  deliveryMode?: DsDeliveryMode;
  batchId?: string;
  // Set when this document was sent together with 1–2 others (a bundle) — see DsDocument.bundleId.
  bundleId?: string;
  bundleIndex?: number;
  bundleSize?: number;
  message?: string;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  sentAt?: string;
  // Present on the External Signatures list — everyone the document was sent to.
  recipients?: Array<{ name?: string; email: string; status: "pending" | "viewed" | "signed" | "declined"; order?: number }>;
  flattenedFileUrl?: string;
  flattenedFileKey?: string;
  flattenedFileHash?: string;
  certificateFileUrl?: string;
  originalFileHash?: string;
  originalFileHashSource?: "upload" | "completion";
  originalIntegrity?: "match" | "mismatch" | "unverified";
  auditChainHash?: string;
  auditChainEvents?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DsExternalRecipient {
  _id: string;
  documentId: string;
  email: string;
  name?: string;
  order: number;
  status: "pending" | "viewed" | "signed" | "declined";
  viewedAt?: string;
  consentGivenAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  signatureType?: "draw" | "type" | "upload";
  signatureImageUrl?: string;
  // Only ever present for the send-for-signature path — never the raw token, just delivery status.
  inviteEmailStatus?: "pending" | "sent" | "failed";
  inviteEmailAt?: string;
  inviteEmailError?: string;
  emailVerifiedAt?: string;
}

export interface DsExternalField {
  _id: string;
  documentId: string;
  recipientId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: DsField["type"];
  required: boolean;
  fontSize?: number;
  color?: string;
  value?: string;
  checked?: boolean;
}

// ── External signatures (founder/admin only) — two ways to complete one of these
// documents: fillOnBehalfExternalDocument (the founder fills in and signs for everyone,
// no recipient action at all) or sendExternalDocument (recipients sign themselves via a
// public, no-login link — see lib/docusign/public-api.ts for their unauthenticated calls). ──
export const createExternalDocument = (data: {
  title: string;
  originalFileUrl: string;
  originalFileKey?: string;
  pageCount?: number;
  // SHA-256 of the PDF, computed in the browser BEFORE uploading it (see sha256Hex) — lets the server
  // prove at completion that the file signers saw is the file that was uploaded.
  originalFileHash?: string;
  // Omit (or null) to keep it Global.
  folderId?: string | null;
  // Optional personal note from the sender. It appears in the recipient's email — the invite for a
  // send-for-signature document, and the "here is your copy" mail on the fill-on-behalf path —
  // signed with the sender's name and role. The backend trims it and caps it at 1000 characters.
  message?: string;
}) =>
  api<{ status: boolean; data: DsExternalDocument }>(url("esign-documents"), {
    method: "POST",
    body: JSON.stringify(data),
  });

// `status` is a comma-separated list, e.g. "sent,in_progress" — mirrors listAllInOrg. Omitted
// returns every status. Filtering has to happen server-side: doing it on the client would narrow
// only the rows on the current page while `pagination` kept describing the unfiltered set.
export const listMyExternalDocuments = (page = 1, limit = 20, folderId?: FolderFilter, status?: string) =>
  api<{ status: boolean; data: DsExternalDocument[]; pagination: DsPagination }>(
    url(withQuery("esign-documents", { page, limit, folderId, status }))
  );

export const getExternalDocumentStats = (folderId?: FolderFilter) =>
  api<{ status: boolean; data: { draft: number; sent: number; in_progress: number; completed: number; voided: number; total: number } }>(
    url(withQuery("esign-documents/stats", { folderId }))
  );

// Files up to 200 documents under a folder; folderId null moves them back to Global. Allowed at any status.
export const moveExternalDocuments = (documentIds: string[], folderId: string | null) =>
  api<{ status: boolean; data: { moved: number; requested: number; folderId: string | null } }>(url("esign-documents/move"), {
    method: "POST",
    body: JSON.stringify({ documentIds, folderId }),
  });

export const getExternalDocumentDetail = (id: string) =>
  api<{
    status: boolean;
    data: {
      document: DsExternalDocument;
      recipients: DsExternalRecipient[];
      fields: DsExternalField[];
      // Newest-first, first page only — see getExternalAuditLogPage for the rest. This used to
      // be the document's entire audit history on every open.
      auditLog: DsAuditLogEntry[];
      // Absent on a backend older than the change that paged this — treated as "no more",
      // which just hides the "Load earlier activity" button, exactly as before.
      auditHasMore?: boolean;
    };
  }>(url(`esign-documents/${id}`));

// "Load earlier activity" in the external editor's audit trail panel — the twin of
// getAuditLogPage above, same keyset cursor.
export const getExternalAuditLogPage = (id: string, before?: { createdAt: string; id: string }) =>
  api<{ status: boolean; data: { entries: DsAuditLogEntry[]; hasMore: boolean } }>(
    url(withQuery(`esign-documents/${id}/audit-log`, { beforeCreatedAt: before?.createdAt, beforeId: before?.id }))
  );

export const setExternalRecipients = (
  id: string,
  data: { deliveryMode?: DsDeliveryMode; recipients: Array<{ email: string; name?: string; order?: number }> }
) =>
  api<{ status: boolean; data: DsExternalRecipient[] }>(url(`esign-documents/${id}/recipients`), {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const setExternalFields = (
  id: string,
  data: {
    fields: Array<{
      recipientId: string;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      type: DsField["type"];
      required?: boolean;
      fontSize?: number;
      color?: string;
    }>;
  }
) =>
  api<{ status: boolean; data: DsExternalField[] }>(url(`esign-documents/${id}/fields`), {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const voidExternalDocument = (id: string) =>
  api<{ status: boolean; data: DsExternalDocument }>(url(`esign-documents/${id}/void`), { method: "POST" });

// ── Grouped documents (bundle): 2–3 documents sent together, one signing link per person ────────
// Same contract as internal-api.ts's *DocumentBundle calls; recipients are identified by email.

export const createExternalDocumentBundle = (data: {
  documents: Array<{ title: string; originalFileUrl: string; originalFileKey?: string; originalFileHash?: string; pageCount?: number }>;
  message?: string;
  folderId?: string | null;
}) =>
  api<{ status: boolean; data: { bundleId: string; documents: DsExternalDocument[] } }>(url("esign-documents/bundle"), {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getExternalDocumentBundle = (bundleId: string) =>
  api<{ status: boolean; data: DsBundle<DsExternalRecipient> }>(url(`esign-documents/bundle/${bundleId}`));

export const syncExternalBundleRecipients = (bundleId: string, recipients: Array<{ email: string; name?: string }>) =>
  api<{ status: boolean; data: { recipients: Record<string, DsExternalRecipient[]> } }>(url(`esign-documents/bundle/${bundleId}/recipients`), {
    method: "PUT",
    body: JSON.stringify({ recipients }),
  });

export const sendExternalDocumentBundle = (bundleId: string) =>
  api<{ status: boolean; data: { bundleId: string; documents: DsExternalDocument[] } }>(url(`esign-documents/bundle/${bundleId}/send`), { method: "POST" });

// Each person still to sign gets one reminder with a fresh link that covers every document of the group.
export const resendExternalDocumentBundle = (bundleId: string) =>
  api<{ status: boolean; message: string; sent: string[] }>(url(`esign-documents/bundle/${bundleId}/resend`), { method: "POST" });

// Invites every recipient to sign the document THEMSELVES via a public, no-login link
// (app/sign/[token]) — an alternative to fillOnBehalfExternalDocument below, not a
// replacement for it. Recipients are emailed individually; see lib/docusign/public-api.ts
// for the unauthenticated calls the signer's own page makes.
// `job` is only present for a deliveryMode "separate" send — see getExternalCopiesProgress below.
export const sendExternalDocument = (id: string) =>
  api<{
    status: boolean;
    data: DsExternalDocument;
    job?: { batchId: string; total: number };
  }>(url(`esign-documents/${id}/send`), { method: "POST" });

// How a "separate copies" send is going, and retrying whichever copies failed. Same shape/semantics as
// getCopiesProgress/retryFailedCopies above, just pointed at esign-documents.
export const getExternalCopiesProgress = (id: string) =>
  api<{ status: boolean; data: DsCopiesProgress }>(url(`esign-documents/${id}/copies-progress`));

export const retryExternalFailedCopies = (id: string) =>
  api<{ status: boolean; data: DsCopiesProgress }>(url(`esign-documents/${id}/copies-retry`), { method: "POST" });

// Re-sends the "please sign" email to whichever recipients haven't signed yet. Pass `recipientIds` to
// choose exactly who gets it; leave it out to remind whoever hasn't signed/declined yet (or is up next on a
// sequential document). Same response shape as the internal flow's resendDocument.
export const resendExternalDocument = (id: string, recipientIds?: string[]) =>
  api<{
    status: boolean;
    message: string;
    queued?: boolean;
    sent?: Array<{ name?: string; email: string }>;
    failed?: Array<{ name?: string; email: string; error: string }>;
  }>(url(`esign-documents/${id}/resend`), {
    method: "POST",
    ...(recipientIds ? { body: JSON.stringify({ recipientIds }) } : {}),
  });

// Recomputes the signed file's hash and the audit-trail fingerprint to confirm nothing was altered since
// completion — same shape as the internal flow's verifyDocument (DsVerifyResult).
export const verifyExternalDocument = (id: string) => api<{ status: boolean; data: DsVerifyResult }>(url(`esign-documents/${id}/verify`));

// Raw fetch with a manually-attached Bearer header, not api() — the response is a binary zip, not JSON.
// Mirrors downloadEvidencePackage exactly.
export const downloadExternalEvidencePackage = async (id: string): Promise<{ blob: Blob; filename: string; sha256: string | null }> => {
  const token = getToken();
  const { signal, cancel } = timeoutSignal(UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url(`esign-documents/${id}/evidence`), { headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store", signal });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("The evidence package took too long to download. Please try again.");
    throw new Error("Could not reach the server to download the evidence package");
  } finally {
    cancel();
  }
  if (res.status === 401) throw new DocusignAuthExpiredError();
  if (!res.ok) {
    let message = `Could not download the evidence package (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const filename = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "evidence-package.zip";
  return { blob: await res.blob(), filename, sha256: res.headers.get("X-Evidence-Package-SHA256") };
};

// The founder fills in every recipient's fields in one request and the document
// completes immediately — no sign link, no per-recipient action. signaturesByRecipient
// carries at most one captured signature per recipient (used for any signature/
// initials/stamp field belonging to them), matching how the backend's flattenSignedPdf
// keys signature images by recipientId, not by field.
export const fillOnBehalfExternalDocument = (
  id: string,
  data: {
    fields: Array<{ fieldId: string; value?: string; checked?: boolean }>;
    signaturesByRecipient: Record<string, { signatureType: "draw" | "type" | "upload"; signatureImageUrl: string }>;
  }
) =>
  api<{ status: boolean; data: DsExternalDocument }>(url(`esign-documents/${id}/fill-on-behalf`), {
    method: "POST",
    body: JSON.stringify(data),
  });
