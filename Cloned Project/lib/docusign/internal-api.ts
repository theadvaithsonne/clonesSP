// INTERNAL flow: documents whose recipients are org users who log in and sign.
// Backed by the ds_* collections; every route here is under documents/.
// The external twin of this file is external-api.ts — they share no state.

import { getOrgId, getToken } from "../auth";
import { DocusignAuthExpiredError, UPLOAD_TIMEOUT_MS, api, timeoutSignal, url, withQuery } from "./client";
import type { DsAuditLogEntry, DsBundle, DsBundleStepper, DsCopiesProgress, DsDeliveryMode, DsField, DsPagination, DsVerifyResult, FolderFilter } from "./types";

export interface DsDocument {
  _id: string;
  title: string;
  orgId: string;
  ownerUserId: string;
  originalFileUrl: string;
  originalFileKey?: string;
  // The raw file the sender uploaded, before the envelope-ID stamp was applied —
  // kept only for traceability; originalFileUrl above is the stamped working copy
  // everyone actually views/signs.
  rawUploadedFileUrl?: string;
  envelopeId: string;
  flattenedFileUrl?: string;
  flattenedFileKey?: string;
  flattenedFileHash?: string;
  certificateFileUrl?: string;
  certificateFileKey?: string;
  signingOrder: "sequential" | "parallel";
  // "separate": sending fans the draft out into one independent copy per recipient (own PDF, signed
  // file and certificate); the copies share a batchId. Absent on an older backend = "shared".
  deliveryMode?: DsDeliveryMode;
  batchId?: string;
  // Set when this document was sent together with 1–2 others to the same people (a bundle): the group,
  // this document's 0-based place in it, and how many documents it has. Absent on a single document.
  bundleId?: string;
  bundleIndex?: number;
  bundleSize?: number;
  // The folder a founder/admin filed this under. null/absent = Global (no folder). A label only.
  folderId?: string | null;
  // SHA-256 of the ORIGINAL pdf. "upload" = fingerprinted in the sender's browser before it was uploaded (strong);
  // "completion" = by the server when the document completed (only proves the file as of completion).
  originalFileHash?: string;
  originalFileHashSource?: "upload" | "completion";
  // How the stored original compared with that fingerprint when the document completed.
  originalIntegrity?: "match" | "mismatch" | "unverified";
  // Fingerprint of the audit trail at completion (any later edit/deletion of those events changes it).
  auditChainHash?: string;
  auditChainEvents?: number;
  status: "draft" | "sent" | "in_progress" | "completed" | "voided";
  pageCount?: number;
  message?: string;
  // Snapshotted once at creation from the sending organization — brands the sign/turn emails and
  // the Certificate of Completion. Absent on documents created before this existed.
  orgName?: string;
  orgLogoUrl?: string;
  reminderFrequency?: "none" | "daily" | "weekly";
  sentAt?: string;
  completedAt?: string;
  expiresAt?: string;
  myRecipientStatus?: string;
  // Present on listSentByMe results — who the document was sent to.
  // `order` is the signing position (only meaningful when signingOrder is "sequential").
  recipients?: Array<{ name?: string; email: string; status: DsRecipient["status"]; order?: number }>;
  // Present on listAllInOrg results — resolved from ownerUserId server-side, since that
  // id is a ds_user _id and can't be matched against orgMembers/admin member lists.
  ownerName?: string;
  ownerEmail?: string;
  ownerImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DsRecipient {
  _id: string;
  documentId: string;
  userId: string;
  email: string;
  name?: string;
  order: number;
  status: "pending" | "viewed" | "signed" | "declined";
  // Outcome of the "please sign" email. Sending is queued and retried in the background, so this can
  // still be "pending" right after Send; "failed" means the sender should use "Resend reminder".
  inviteEmailStatus?: "pending" | "sent" | "failed";
  inviteEmailError?: string;
  viewedAt?: string;
  consentGivenAt?: string;
  signedAt?: string;
  signatureType?: "draw" | "type" | "upload";
  signatureImageUrl?: string;
}

// ── Documents ────────────────────────────────────────────────────
export const createDocument = (data: {
  title: string;
  originalFileUrl: string;
  originalFileKey?: string;
  pageCount?: number;
  signingOrder?: "sequential" | "parallel";
  // Founder/admin only — the backend answers 403 for anyone else. Omit (or null) to keep it Global.
  folderId?: string | null;
  // SHA-256 of the PDF, computed in the browser BEFORE uploading it (see sha256Hex). Lets the server prove at
  // completion that the file the signers saw is the file that was uploaded.
  originalFileHash?: string;
  // Optional personal note shown in the sign-request email, signed with the sender's name and role
  // (Founder/Admin) — see components/dashboard/docusign/DocumentUploadDialog.tsx.
  message?: string;
}) =>
  api<{ status: boolean; data: DsDocument }>(url("documents"), {
    method: "POST",
    // orgId is the user's currently-selected organization (garage_org_id) — sent
    // explicitly rather than left for the backend to infer solely from the JWT,
    // matching how the rest of this codebase scopes calls by org. The backend
    // still validates it against the token-derived org before trusting it.
    body: JSON.stringify({ ...data, orgId: getOrgId() }),
  });

// Real server-side pagination — page/limit sent as query params on every call, backend
// returns only that page's rows plus `pagination` metadata (never fetch-everything-
// then-slice client-side).
export const listSentByMe = (page = 1, limit = 20) =>
  api<{ status: boolean; data: DsDocument[]; pagination: DsPagination }>(url(withQuery("documents/me/sent", { page, limit })));

export const listAssignedToMe = (page = 1, limit = 20) =>
  api<{ status: boolean; data: DsDocument[]; pagination: DsPagination }>(url(withQuery("documents/me/assigned", { page, limit })));

// Org-wide "Agreements" tab (founder/docusign-admin only, enforced server-side).
// status is a comma-separated list, e.g. "sent,in_progress"; omitted returns everything.
// scope folds what used to be separate "Sent by Me"/"Assigned to Me" tabs into this same
// call as a filter: "sent" narrows to documents the caller owns, "assigned" narrows to
// documents where the caller is a recipient. Omitted (or "all") returns every document.
// folderId narrows to one folder ("unfiled" = documents with no folder); omitted = every folder.
export const listAllInOrg = (status?: string, page = 1, limit = 20, scope?: "sent" | "assigned", folderId?: FolderFilter) =>
  api<{ status: boolean; data: DsDocument[]; pagination: DsPagination }>(
    url(withQuery("documents", { status, page, limit, scope, folderId }))
  );

// Founder-facing Dashboard tab — org-wide status breakdown + the caller's own
// "waiting on you to sign" count.
// With folderId the status counts are for that folder only (assignedToMePending is always org-wide).
export const getDocumentStats = (folderId?: FolderFilter) =>
  api<{
    status: boolean;
    data: { draft: number; sent: number; in_progress: number; completed: number; voided: number; total: number; assignedToMePending: number };
  }>(url(withQuery("documents/stats", { folderId })));

// Files up to 200 documents under a folder; folderId null moves them back to Global. Allowed at any status.
export const moveDocuments = (documentIds: string[], folderId: string | null) =>
  api<{ status: boolean; data: { moved: number; requested: number; folderId: string | null } }>(url("documents/move"), {
    method: "POST",
    body: JSON.stringify({ documentIds, folderId, orgId: getOrgId() }),
  });

export const getDocumentDetail = (id: string) =>
  api<{
    status: boolean;
    data: {
      document: DsDocument;
      recipients: DsRecipient[];
      fields: DsField[];
      // Newest-first, first page only — see getAuditLogPage for the rest.
      auditLog: DsAuditLogEntry[];
      auditHasMore: boolean;
    };
  }>(url(`documents/${id}`));

// "Load earlier activity" in the editor's audit trail panel. `before` is the oldest entry currently shown
// (its createdAt + _id) — a keyset cursor, so it always continues exactly where the last page left off.
export const getAuditLogPage = (id: string, before?: { createdAt: string; id: string }) =>
  api<{ status: boolean; data: { entries: DsAuditLogEntry[]; hasMore: boolean } }>(
    url(withQuery(`documents/${id}/audit-log`, { beforeCreatedAt: before?.createdAt, beforeId: before?.id }))
  );

// `job` is only present for a deliveryMode "separate" send. That send returns at once: the copies are built in the
// background, and getCopiesProgress (below) says how far along it is.
export const sendDocument = (id: string) =>
  api<{
    status: boolean;
    data: DsDocument;
    job?: { batchId: string; total: number };
  }>(url(`documents/${id}/send`), { method: "POST" });

// Owner or founder/admin only. Polling this also revives a job whose server restarted, using the caller's token.
export const getCopiesProgress = (id: string) =>
  api<{ status: boolean; data: DsCopiesProgress }>(url(`documents/${id}/copies-progress`));

// Puts the copies that failed back in the queue and resumes building them.
export const retryFailedCopies = (id: string) =>
  api<{ status: boolean; data: DsCopiesProgress }>(url(`documents/${id}/copies-retry`), { method: "POST" });

export const voidDocument = (id: string) =>
  api<{ status: boolean; data: DsDocument }>(url(`documents/${id}/void`), { method: "POST" });

// ── Grouped documents (bundle): 2–3 documents sent together to the same people ─────────────────

// One draft per uploaded PDF, linked by a bundleId. Title/file per document; message and folder are shared.
export const createDocumentBundle = (data: {
  documents: Array<{ title: string; originalFileUrl: string; originalFileKey?: string; originalFileHash?: string; pageCount?: number }>;
  message?: string;
  folderId?: string | null;
}) =>
  api<{ status: boolean; data: { bundleId: string; documents: DsDocument[] } }>(url("documents/bundle"), {
    method: "POST",
    body: JSON.stringify({ ...data, orgId: getOrgId() }),
  });

export const getDocumentBundle = (bundleId: string) =>
  api<{ status: boolean; data: DsBundle<DsRecipient> }>(url(`documents/bundle/${bundleId}`));

// The one recipient list for every document of the group. People who stay keep their recipient ids, so fields
// already placed for them on any document are kept; the response has each document's rows (by documentId).
export const syncBundleRecipients = (bundleId: string, recipients: Array<{ userId: string; email: string; name?: string }>) =>
  api<{ status: boolean; data: { recipients: Record<string, DsRecipient[]> } }>(url(`documents/bundle/${bundleId}/recipients`), {
    method: "PUT",
    body: JSON.stringify({ recipients }),
  });

// Sends every document of the group at once, one email per person. A 400 carries `documentId` (on the thrown
// error) when one particular document is the problem, so the editor can open it.
export const sendDocumentBundle = (bundleId: string) =>
  api<{ status: boolean; data: { bundleId: string; documents: DsDocument[] } }>(url(`documents/bundle/${bundleId}/send`), { method: "POST" });

// One combined reminder per person still to sign (at most once per 10 minutes for the group).
export const resendDocumentBundle = (bundleId: string) =>
  api<{ status: boolean; message: string; sent: string[] }>(url(`documents/bundle/${bundleId}/resend`), { method: "POST" });

// ── Recipients ───────────────────────────────────────────────────
export const setRecipients = (
  id: string,
  data: {
    signingOrder: "sequential" | "parallel";
    deliveryMode?: DsDeliveryMode;
    recipients: Array<{ userId: string; email: string; name?: string; order?: number }>;
  }
) =>
  api<{ status: boolean; data: DsRecipient[] }>(url(`documents/${id}/recipients`), {
    method: "PUT",
    // See createDocument above — orgId sent explicitly from garage_org_id.
    body: JSON.stringify({ ...data, orgId: getOrgId() }),
  });

export const listRecipients = (id: string) =>
  api<{ status: boolean; data: DsRecipient[] }>(url(`documents/${id}/recipients`));

// ── Fields ───────────────────────────────────────────────────────
export const setFields = (
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
  api<{ status: boolean; data: DsField[] }>(url(`documents/${id}/fields`), {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const listFields = (id: string) => api<{ status: boolean; data: DsField[] }>(url(`documents/${id}/fields`));

// ── Signing ──────────────────────────────────────────────────────
export const viewDocumentAsRecipient = (id: string) =>
  api<{
    status: boolean;
    data: {
      document: DsDocument;
      myFields: DsField[];
      allFields: DsField[];
      canSign: boolean;
      // Set when a sequential document is waiting on someone else: who (name only) and their place in the order.
      waitingFor?: { name: string | null; position: number; total: number } | null;
      // The caller's own recipient status; absent on an older backend.
      myStatus?: "pending" | "viewed" | "signed" | "declined";
      // The exact consent wording to show, and its version to send back when signing. Absent on an older backend.
      consent?: { version: string; text: string };
      // Already verified — once for a whole group of documents, so later ones skip the code step.
      myEmailVerified?: boolean;
      // Present when this document was sent together with others: every one the caller is on, for the stepper.
      bundle?: DsBundleStepper;
    };
  }>(url(`documents/${id}/view`));

export const requestEmailVerification = (id: string) =>
  api<{ status: boolean; message: string }>(url(`documents/${id}/verify-email/request`), { method: "POST" });

export const confirmEmailVerification = (id: string, code: string) =>
  api<{ status: boolean; message: string }>(url(`documents/${id}/verify-email/confirm`), {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const signDocument = (
  id: string,
  data: {
    fields: Array<{ fieldId: string; value?: string; checked?: boolean }>;
    signatureType: "draw" | "type" | "upload";
    signatureImageUrl: string;
    // Backend hard-rejects (400) any sign request missing this — ESIGN/UETA
    // requires affirmative consent to conduct the transaction electronically.
    consentGiven: true;
    consentTextVersion?: string;
  }
) =>
  api<{ status: boolean; data: DsDocument }>(url(`documents/${id}/sign`), {
    method: "POST",
    body: JSON.stringify(data),
  });

export const declineDocument = (id: string, reason?: string) =>
  api<{ status: boolean; message: string }>(url(`documents/${id}/decline`), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

// Sends the "please sign" reminder. Pass `recipientIds` to choose exactly who gets it; leave it out to remind whoever
// is up now (sequential) or everyone who has not signed yet (parallel). The server never emails someone who has
// already signed or declined, and says exactly who it emailed and who it could not.
export const resendDocument = (id: string, recipientIds?: string[]) =>
  api<{
    status: boolean;
    message: string;
    // The reminder was queued, not delivered: emails go out in waves, so this returns at once for any number of people.
    queued?: boolean;
    sent?: Array<{ name?: string; email: string }>;
    failed?: Array<{ name?: string; email: string; error: string }>;
  }>(url(`documents/${id}/resend`), {
    method: "POST",
    ...(recipientIds ? { body: JSON.stringify({ recipientIds }) } : {}),
  });

export const getCertificate = (id: string) =>
  api<{ status: boolean; data: { certificateFileUrl: string; flattenedFileUrl: string; flattenedFileHash: string } }>(
    url(`documents/${id}/certificate`)
  );

export const verifyDocument = (id: string) => api<{ status: boolean; data: DsVerifyResult }>(url(`documents/${id}/verify`));

// The link to one of a document's files. Going through the app (not opening the storage link directly) is what
// records the download in the audit trail.
export const getDocumentFileLink = (id: string, kind: "original" | "signed" | "certificate") =>
  api<{ status: boolean; data: { url: string; kind: string } }>(url(`documents/${id}/files/${kind}`));

// Owner / founder / admin, completed documents only: one zip with the signed PDF, certificate, original, audit trail,
// signer details, consent wording and hashes. Fetched with the login token (a plain link can't send it).
export const downloadEvidencePackage = async (id: string): Promise<{ blob: Blob; filename: string; sha256: string | null }> => {
  const token = getToken();
  const { signal, cancel } = timeoutSignal(UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url(`documents/${id}/evidence`), { headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store", signal });
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
