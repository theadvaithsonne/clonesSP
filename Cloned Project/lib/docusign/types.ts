// Types shared by both flows, plus the cross-cutting ones (folders, templates, admin,
// analytics, audit trail, verification).
//
// DsField lives here rather than in internal-api even though it is the internal field type:
// the unauthenticated external signer consumes it too (see public-api.ts), so it cannot sit
// behind the internal boundary.


export interface DsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DsUser {
  _id: string;
  userId: string;
  orgId: string;
  email: string;
  name?: string;
  image?: string;
  role: "founder" | "stakeholder";
  isDocusignAdmin: boolean;
  // Absent on rows created before the Sender role existed — treat as false.
  isDocusignSender?: boolean;
  status: string;
}

// Someone's effective Docusign role, as the Admin → Members tab shows it. null = no role: they can
// still sign whatever is sent to them. See lib/docusign/access.ts for what each one may do.
export type DsRole = "founder" | "admin" | "sender" | null;

// What the Members tab's role dropdown can set (founders aren't assignable).
export type DsAssignableRole = "admin" | "sender" | "none";

export type DsDeliveryMode = "shared" | "separate";

// A flat, founder/admin-managed label documents can be filed under. `documentCount` is how many documents
// are in it right now.
export interface DsFolder {
  _id: string;
  name: string;
  // Combined across both flows. A folder holds internal and external documents alike, but each tab
  // only lists one kind — so the rails render internalCount/externalCount instead, or the badge
  // promises documents the list will not show. Optional: absent on an older backend, where the
  // rail falls back to the combined total (the previous, wrong-but-familiar behaviour).
  documentCount: number;
  internalCount?: number;
  externalCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// What a folder filter means in a list/stats call: omitted = every folder, "unfiled" = only documents with
// no folder (Global), otherwise a folder id.
export type FolderFilter = "unfiled" | (string & {});

export interface DsField {
  _id: string;
  documentId: string;
  recipientId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type:
    | "signature"
    | "initials"
    | "stamp"
    | "date"
    | "text"
    | "checkbox"
    | "name"
    | "first_name"
    | "last_name"
    | "email"
    | "company"
    | "title";
  required: boolean;
  // Optional text styling chosen by the sender. fontSize is in PDF points; color is "#rrggbb".
  // Absent = auto-sized black text (how fields created before this looked).
  fontSize?: number;
  color?: string;
  value?: string;
  checked?: boolean;
}

export interface DsAuditLogEntry {
  _id: string;
  documentId: string;
  actorUserId: string;
  actorEmail?: string;
  actorName?: string;
  action: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface DsTemplate {
  _id: string;
  title: string;
  orgId: string;
  ownerUserId: string;
  originalFileUrl: string;
  pageCount?: number;
  fields: Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    type: DsField["type"];
    required: boolean;
    fontSize?: number;
    color?: string;
    recipientSlot: number;
  }>;
}

// Final, UI-ready shape the Admin → Members tab renders. Two different origins depending on scope:
// - scope=roles: returned directly, already in this shape, by GET admin/members — everyone
//   holding a docusign role, fully self-contained in the docusign backend (ds_user carries
//   name/email/image), real server-side pagination, no garage platform call at all.
// - scope=all: assembled client-side by merging the org's real member list (fetched
//   directly from /public/organizations/:orgId/users, same call RecipientsPanel uses)
//   with the docusign-specific overlay (DsAdminOverlay below) — the only path that still
//   needs the live, unbounded garage list, since it's the only way to discover someone
//   who has no docusign role yet.
export interface DsAdminMember {
  userId: string;
  name?: string;
  email: string;
  profilePicture?: string;
  role: "founder" | "stakeholder";
  docusignRole: DsRole;
  isDocusignAdmin: boolean;
  isDocusignSender: boolean;
  synced: boolean;
  // Documents actually sent (drafts excluded), internal + external.
  documentsSent: number;
  pendingSignatures: number;
}

// What GET admin/members?scope=all returns — docusign role + activity counts only, keyed
// by userId (the main garage backend's user id). No name/email/avatar here; the frontend
// already has that from the org's real member list.
export interface DsAdminOverlay {
  userId: string;
  role: "founder" | "stakeholder";
  docusignRole: DsRole;
  isDocusignAdmin: boolean;
  isDocusignSender: boolean;
  synced: boolean;
  documentsSent: number;
  pendingSignatures: number;
}

export type DsAnalyticsRange = "1w" | "1m" | "3m" | "ytd" | "all";

export interface DsAnalyticsKpi {
  value: number;
  // null = no prior-period comparison exists (ytd/all ranges).
  change: number | null;
  trend: Array<{ date: string; count: number }>;
}

export interface DsAnalyticsSummary {
  range: DsAnalyticsRange;
  // Org-wide current status snapshot — internal + external documents merged, not range-scoped.
  totals: { draft: number; sent: number; in_progress: number; completed: number; voided: number; total: number };
  kpis: {
    totalDocuments: DsAnalyticsKpi;
    sent: DsAnalyticsKpi;
    completed: DsAnalyticsKpi;
    pendingSignatures: DsAnalyticsKpi;
  };
  signingActivity: {
    sent: Array<{ date: string; count: number }>;
    completed: Array<{ date: string; count: number }>;
  };
  topSenders: Array<{ userId: string; name: string; image: string | null; count: number; percent: number }>;
  recipientStatus: { pending: number; viewed: number; signed: number; declined: number };
}

// How a "separate copies" send is going. `created` includes the first recipient's copy, which exists from the
// moment of sending; `remaining` are still being built; `failed` need the sender's attention (retryFailedCopies).
export interface DsCopiesProgress {
  batchId: string;
  status: "preparing" | "running" | "done";
  total: number;
  created: number;
  remaining: number;
  failed: number;
  // Kept for older clients: the backend now restarts a stalled job itself (copies need no login token), so this is always false.
  stalled: boolean;
  failedItems: Array<{ name?: string; email: string; error?: string }>;
  completedAt: string | null;
}

// What "Verify integrity" reports. `auditTrail` / `original` are absent on an older backend.
export interface DsVerifyResult {
  valid: boolean;
  storedHash: string;
  computedHash: string;
  // checked:false = completed before the audit-trail fingerprint existed; intact:false = an event was edited or deleted.
  auditTrail?: { checked: boolean; intact?: boolean; events?: number };
  original?: { hash: string | null; source: "upload" | "completion" | null; integrity: "match" | "mismatch" | "unverified" | null };
}

// ── Branding (Admin → Branding) ──────────────────────────────────────────────────────────────
// The org's email/signing-page branding. The backend owns the catalog of emails, their default
// wording and the limits (GET branding returns them), so nothing here duplicates that content.

export type DsEmailKind =
  | "signature_request"
  | "your_turn"
  | "recipient_signed"
  | "declined"
  | "completed"
  | "verification_code"
  | "shared_with_you";

// One email's editable text. "" = the default wording for that field.
export interface DsEmailContent {
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string;
}

export type DsBrandingLayout = "centered" | "left";
export type DsBrandingLogoSize = "small" | "medium" | "large";

// What an org can change. Its name and logo aren't here — they're the organisation's own and aren't
// editable in Docusign.
export interface DsBranding {
  replyToEmail: string;
  footerText: string;
  accentColor: string;
  layout: DsBrandingLayout;
  logoSize: DsBrandingLogoSize;
  content: Record<DsEmailKind, DsEmailContent>;
}

export interface DsBrandingCatalogItem {
  kind: DsEmailKind;
  label: string;
  description: string;
  // {{variables}} allowed in the heading/message/button, and (a stricter set) in the subject.
  tokens: string[];
  subjectTokens: string[];
  tokenLabels: Record<string, string>;
  hasButton: boolean;
}

export interface DsBrandingEditor {
  branding: DsBranding;
  isSaved: boolean;
  updatedAt: string | null;
  defaults: {
    accentColor: string;
    layout: DsBrandingLayout;
    logoSize: DsBrandingLogoSize;
    content: Record<DsEmailKind, DsEmailContent>;
  };
  catalog: DsBrandingCatalogItem[];
  limits: Record<"footerText" | "subject" | "heading" | "body" | "buttonLabel", number>;
  productName: string;
}

// `field` is a path: "replyToEmail", "content.signature_request.heading", …
export interface DsBrandingFieldError {
  field: string;
  message: string;
}

export interface DsBrandingPreview {
  kind: DsEmailKind;
  subject: string;
  html: string;
  // The full From header, e.g. "TNE Partners via Garage Docs" <no-reply@…>.
  from: string;
  replyTo: string | null;
  errors: DsBrandingFieldError[];
}

// ── Grouped documents (bundle) ───────────────────────────────────────────────────────────────
// 2–3 different documents sent together to the same people. Each member is an ordinary document;
// these describe the group around it.

export const MAX_BUNDLE_DOCUMENTS = 3;
export const MAX_BUNDLE_RECIPIENTS = 25;

// One member, as the sender's editor sees it (GET …/bundle/:bundleId).
export interface DsBundleMember {
  _id: string;
  title: string;
  status: "draft" | "sent" | "in_progress" | "completed" | "voided";
  bundleIndex: number;
  pageCount?: number;
  originalFileUrl: string;
  flattenedFileUrl?: string;
  fieldCount: number;
  // Names of recipients with no field on this document yet — sending is blocked until it's empty.
  recipientsWithoutFields: string[];
}

export interface DsBundle<R> {
  bundleId: string;
  size: number;
  documents: DsBundleMember[];
  // The shared recipient list (the same on every member).
  recipients: R[];
}

// A signer's view of the group: every document they're on, with where they stand on each.
export interface DsBundleStepper {
  size: number;
  documents: Array<{
    _id: string;
    title: string;
    bundleIndex?: number;
    status: "draft" | "sent" | "in_progress" | "completed" | "voided";
    myStatus: "pending" | "viewed" | "signed" | "declined";
  }>;
}
