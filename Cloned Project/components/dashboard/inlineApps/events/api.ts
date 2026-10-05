// Typed client for /event-management (founder) and /public/event-management
// (customer). Nothing else in the app should hand-build these URLs.

import { api, API_URL } from "@/lib/api";
import { getOrgId } from "@/lib/auth";
import type {
  AgendaSession,
  ChecklistItem,
  EventBlock,
  EventMetrics,
  EventProgram,
  EventRegistration,
  EventSiteData,
  EventSpeaker,
  EventSponsor,
  EventTheme,
  EventRegistrationFormConfig,
  EventWebsiteConfig,
  TicketTier,
} from "./types";

const BASE = "/event-management";

// ── Events ───────────────────────────────────────────────────────────────

export async function listEvents(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams({ orgId: getOrgId() || "" });
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  return api<{ success: boolean; total: number; events: EventProgram[] }>(
    `${BASE}?${q.toString()}`
  );
}

export async function createEvent(payload: Record<string, unknown>) {
  return api<{
    success: boolean;
    event: EventProgram;
    published: boolean;
    blockers?: string[];
  }>(BASE, {
    method: "POST",
    body: JSON.stringify({ ...payload, orgId: getOrgId() }),
  });
}

export async function getEvent(id: string) {
  return api<{
    success: boolean;
    event: EventProgram;
    tiers: TicketTier[];
    metrics: EventMetrics;
    checklist: { items: ChecklistItem[]; blockers: string[]; canPublish: boolean };
    website: { isPublished: boolean; publishedAt: string | null };
  }>(`${BASE}/${id}`);
}

export async function updateEvent(id: string, payload: Record<string, unknown>) {
  return api<{ success: boolean; event: EventProgram }>(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function publishEvent(id: string) {
  return api<{ success: boolean; event: EventProgram }>(`${BASE}/${id}/publish`, {
    method: "POST",
  });
}

export async function unpublishEvent(id: string) {
  return api<{ success: boolean; event: EventProgram }>(`${BASE}/${id}/unpublish`, {
    method: "POST",
  });
}

export async function deleteEvent(id: string) {
  return api<{ success: boolean }>(`${BASE}/${id}`, { method: "DELETE" });
}

/**
 * Banner upload. Sent as multipart so the browser never needs S3 credentials
 * and the server can attribute the object to the event.
 */
export async function uploadBanner(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<{ success: boolean; url: string; key: string }>(
    `${BASE}/${id}/banner`,
    { method: "POST", body: form }
  );
}

/**
 * Event-scoped image upload for anything that isn't the banner — speaker
 * headshots, sponsor logos. Returns the URL; the caller decides where it goes.
 */
export async function uploadEventImage(
  id: string,
  file: File,
  folder = "misc"
) {
  const form = new FormData();
  form.append("file", file);
  return api<{ success: boolean; url: string; key: string }>(
    `${BASE}/${id}/image?folder=${encodeURIComponent(folder)}`,
    { method: "POST", body: form }
  );
}

// ── Tickets ──────────────────────────────────────────────────────────────

/** Both kinds by default — the Tickets page renders its tabs from one fetch. */
export async function listTickets(eventId: string, kind?: "ticket" | "addon") {
  return api<{ success: boolean; tiers: TicketTier[] }>(
    `${BASE}/${eventId}/tickets${kind ? `?kind=${kind}` : ""}`
  );
}

export async function createTicket(eventId: string, payload: Record<string, unknown>) {
  return api<{ success: boolean; tier: TicketTier }>(`${BASE}/${eventId}/tickets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTicket(
  eventId: string,
  ticketId: string,
  payload: Record<string, unknown>
) {
  return api<{ success: boolean; tier: TicketTier }>(
    `${BASE}/${eventId}/tickets/${ticketId}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export async function reorderTickets(eventId: string, orderedIds: string[]) {
  return api<{ success: boolean; tiers: TicketTier[] }>(
    `${BASE}/${eventId}/tickets/reorder`,
    { method: "PUT", body: JSON.stringify({ orderedIds }) }
  );
}

export async function deleteTicket(eventId: string, ticketId: string) {
  return api<{ success: boolean }>(`${BASE}/${eventId}/tickets/${ticketId}`, {
    method: "DELETE",
  });
}

// ── Registrations ────────────────────────────────────────────────────────

export async function listRegistrations(
  eventId: string,
  params?: { status?: string; search?: string; limit?: number; offset?: number }
) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return api<{ success: boolean; total: number; registrations: EventRegistration[] }>(
    `${BASE}/${eventId}/registrations${qs ? `?${qs}` : ""}`
  );
}

export async function approveRegistration(eventId: string, regId: string) {
  return api<{ success: boolean; registration: EventRegistration }>(
    `${BASE}/${eventId}/registrations/${regId}/approve`,
    { method: "POST" }
  );
}

export async function rejectRegistration(
  eventId: string,
  regId: string,
  reason?: string
) {
  return api<{ success: boolean; registration: EventRegistration }>(
    `${BASE}/${eventId}/registrations/${regId}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}

export async function checkInRegistration(eventId: string, regId: string) {
  return api<{ success: boolean; registration: EventRegistration }>(
    `${BASE}/${eventId}/registrations/${regId}/check-in`,
    { method: "POST" }
  );
}

/**
 * CSV export. Goes through raw fetch rather than `api()` because the response
 * is a file, not JSON.
 */
export function registrationsExportUrl(eventId: string) {
  return `${API_URL.replace(/\/+$/, "")}${BASE}/${eventId}/registrations/export`;
}

// ── Speakers ─────────────────────────────────────────────────────────────

export async function listSpeakers(eventId: string) {
  return api<{ success: boolean; speakers: EventSpeaker[] }>(
    `${BASE}/${eventId}/speakers`
  );
}
export async function createSpeaker(eventId: string, payload: Record<string, unknown>) {
  return api<{ success: boolean; speaker: EventSpeaker }>(
    `${BASE}/${eventId}/speakers`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}
export async function updateSpeaker(
  eventId: string,
  speakerId: string,
  payload: Record<string, unknown>
) {
  return api<{ success: boolean; speaker: EventSpeaker }>(
    `${BASE}/${eventId}/speakers/${speakerId}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}
export async function deleteSpeaker(eventId: string, speakerId: string) {
  return api<{ success: boolean }>(`${BASE}/${eventId}/speakers/${speakerId}`, {
    method: "DELETE",
  });
}

// ── Agenda ───────────────────────────────────────────────────────────────

export async function listSessions(eventId: string) {
  return api<{ success: boolean; sessions: AgendaSession[] }>(
    `${BASE}/${eventId}/agenda`
  );
}
export async function createSession(eventId: string, payload: Record<string, unknown>) {
  return api<{ success: boolean; session: AgendaSession }>(
    `${BASE}/${eventId}/agenda`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}
export async function updateSession(
  eventId: string,
  sessionId: string,
  payload: Record<string, unknown>
) {
  return api<{ success: boolean; session: AgendaSession }>(
    `${BASE}/${eventId}/agenda/${sessionId}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}
export async function deleteSession(eventId: string, sessionId: string) {
  return api<{ success: boolean }>(`${BASE}/${eventId}/agenda/${sessionId}`, {
    method: "DELETE",
  });
}

// ── Sponsors ─────────────────────────────────────────────────────────────

export async function listSponsors(eventId: string) {
  return api<{ success: boolean; sponsors: EventSponsor[] }>(
    `${BASE}/${eventId}/sponsors`
  );
}
export async function createSponsor(eventId: string, payload: Record<string, unknown>) {
  return api<{ success: boolean; sponsor: EventSponsor }>(
    `${BASE}/${eventId}/sponsors`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}
export async function updateSponsor(
  eventId: string,
  sponsorId: string,
  payload: Record<string, unknown>
) {
  return api<{ success: boolean; sponsor: EventSponsor }>(
    `${BASE}/${eventId}/sponsors/${sponsorId}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}
export async function deleteSponsor(eventId: string, sponsorId: string) {
  return api<{ success: boolean }>(`${BASE}/${eventId}/sponsors/${sponsorId}`, {
    method: "DELETE",
  });
}

// ── Coupons ──────────────────────────────────────────────────────────────
//
// Events have no discount system of their own. These read the ORG coupon
// engine (routes/founderCoupons.ts) and narrow to coupons that can apply to
// events — creation and editing still happen on the Coupons surface.

export interface OrgCoupon {
  _id: string;
  code: string;
  name: string;
  discountValue: number;
  maxDiscountAmount?: number;
  applicableTo: string[];
  specificItemIds?: string[];
  status: string;
  validFrom?: string;
  validUntil?: string;
  usageCount?: number;
  maxUsageCount?: number;
}

export async function listEventCoupons(eventId: string) {
  const orgId = getOrgId();
  const res = await api<{ success: boolean; coupons: OrgCoupon[] }>(
    `/org/${orgId}/coupons?limit=200`
  );
  const all = res.coupons || [];
  return {
    // An org coupon applies to this event when it targets event tickets and
    // either names no specific items (all events) or names this one.
    coupons: all.filter(
      (c) =>
        c.applicableTo?.includes("event_ticket") &&
        (!c.specificItemIds?.length || c.specificItemIds.includes(eventId))
    ),
  };
}

// ── Website settings ─────────────────────────────────────────────────────

export interface EventDomain {
  host: string;
  status: "pending" | "verified" | "failed";
  verificationToken: string;
  lastError?: string;
  lastCheckedAt?: string;
  verifiedAt?: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
}

export interface EventWebsiteSettings {
  branding: { logoUrl?: string; faviconUrl?: string; siteName?: string };
  seo: {
    title?: string;
    description?: string;
    keywords: string[];
    noIndex: boolean;
  };
  social: {
    ogTitle?: string;
    ogDescription?: string;
    ogImageUrl?: string;
    twitterCard: "summary" | "summary_large_image";
    twitterHandle?: string;
  };
}

export async function saveWebsiteSettings(
  eventId: string,
  settings: Partial<EventWebsiteSettings>
) {
  return api<{ success: boolean; config: any }>(
    `${BASE}/${eventId}/website/settings`,
    { method: "PUT", body: JSON.stringify(settings) }
  );
}

/** Claims a host and returns the DNS records to create. Does not connect it. */
export async function addEventDomain(eventId: string, host: string) {
  return api<{ success: boolean; domain: EventDomain; records: DnsRecord[] }>(
    `${BASE}/${eventId}/website/domain`,
    { method: "POST", body: JSON.stringify({ host }) }
  );
}

/** Resolves the records for real; only this can mark a domain verified. */
export async function verifyEventDomain(eventId: string) {
  return api<{
    success: boolean;
    domain: EventDomain;
    check: { ok: boolean; txtFound: boolean; pointsHere: boolean; error?: string };
    records: DnsRecord[];
  }>(`${BASE}/${eventId}/website/domain/verify`, { method: "POST" });
}

export async function removeEventDomain(eventId: string) {
  return api<{ success: boolean }>(`${BASE}/${eventId}/website/domain`, {
    method: "DELETE",
  });
}

// ── Registration form ────────────────────────────────────────────────────

export async function getRegistrationForm(eventId: string) {
  return api<{ success: boolean; form: EventRegistrationFormConfig }>(
    `${BASE}/${eventId}/registration-form`
  );
}

/** The whole form is replaced in one write — the builder owns the order. */
export async function saveRegistrationForm(
  eventId: string,
  form: Pick<EventRegistrationFormConfig, "title" | "description" | "fields">
) {
  return api<{ success: boolean; form: EventRegistrationFormConfig }>(
    `${BASE}/${eventId}/registration-form`,
    { method: "PUT", body: JSON.stringify(form) }
  );
}

// ── Email campaigns ──────────────────────────────────────────────────────

export async function getCampaignAudience(eventId: string) {
  return api<{
    success: boolean;
    counts: {
      all: number;
      approved: number;
      pending_approval: number;
      paid: number;
    };
  }>(`${BASE}/${eventId}/campaigns/audience`);
}

/**
 * The email addresses behind one audience segment.
 *
 * Events no longer send mail themselves — this hands the list to NetworkMail,
 * which owns templates, scheduling, unsubscribe and delivery reporting.
 */
export async function getCampaignRecipients(
  eventId: string,
  audience: string
) {
  return api<{
    success: boolean;
    total: number;
    recipients: Array<{ email: string; name?: string }>;
  }>(`${BASE}/${eventId}/campaigns/recipients?audience=${encodeURIComponent(audience)}`);
}

// ── Website builder ──────────────────────────────────────────────────────

export async function getWebsite(eventId: string) {
  return api<{
    success: boolean;
    config: EventWebsiteConfig;
    event: EventProgram;
    data: EventSiteData;
  }>(`${BASE}/${eventId}/website`);
}

export async function saveWebsite(
  eventId: string,
  blocks: EventBlock[],
  theme?: Partial<EventTheme>
) {
  return api<{ success: boolean; config: EventWebsiteConfig }>(
    `${BASE}/${eventId}/website`,
    { method: "PUT", body: JSON.stringify({ blocks, theme }) }
  );
}

export async function publishWebsite(eventId: string) {
  return api<{
    success: boolean;
    config: EventWebsiteConfig;
    publicSlug: string;
    eventPublished: boolean;
  }>(`${BASE}/${eventId}/website/publish`, { method: "POST" });
}

export async function resetWebsite(eventId: string) {
  return api<{ success: boolean; config: EventWebsiteConfig }>(
    `${BASE}/${eventId}/website/reset`,
    { method: "POST" }
  );
}

// ── Public (customer) ────────────────────────────────────────────────────

const PUBLIC = "/public/event-management";

export type PublicTierPayload = Pick<
  TicketTier,
  "_id" | "name" | "description" | "perks" | "price" | "currency"
> & {
  remaining: number;
  soldOut: boolean;
  isPaused: boolean;
  onSale: boolean;
  salesStart?: string;
  salesEnd?: string;
};

export interface PublicEventPayload {
  success: boolean;
  event: EventProgram & { requireApproval: boolean };
  organization: { _id: string; name: string; icon?: string; slug?: string } | null;
  website: { blocks: EventBlock[]; theme: EventTheme };
  tiers: Array<PublicTierPayload>;
  /** Extras a buyer can add to their ticket. Same shape as a tier. */
  addons: Array<PublicTierPayload>;
  speakers: EventSpeaker[];
  sessions: AgendaSession[];
  sponsors: EventSponsor[];
  /** The organizer's registration form, or the defaults if never edited. */
  form: EventRegistrationFormConfig;
}

export interface BrowseEvent extends EventProgram {
  fromPrice: number | null;
  currency: string;
  seatsRemaining: number;
  soldOut: boolean;
}

/**
 * Attendee-facing catalogue of published events.
 *
 * `orgId` is sent only when the browser actually has one. It used to be sent
 * unconditionally, so a customer with no org selected asked for `orgId=` and
 * the API answered 400 — the catalogue looked empty while the events were
 * live. With the parameter omitted the API lists every public event instead.
 */
export async function browsePublicEvents(params?: {
  when?: "live" | "upcoming" | "past" | "all";
  search?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) q.set("orgId", orgId);
  if (params?.when) q.set("when", params.when);
  if (params?.search) q.set("search", params.search);
  if (params?.limit != null) q.set("limit", String(params.limit));
  return api<{ success: boolean; total: number; events: BrowseEvent[] }>(
    `${PUBLIC}?${q.toString()}`
  );
}

export async function getPublicEvent(slug: string) {
  return api<PublicEventPayload>(`${PUBLIC}/${slug}`);
}

export interface QuoteResult {
  success: boolean;
  available: boolean;
  unavailableReason?: string;
  currency: string;
  subtotal: number;
  discount: number;
  promoValid: boolean;
  promoError?: string;
  /** Platform coupons are priced by the invoice engine, not the quote. */
  promoDeferred?: boolean;
  taxRate: number;
  tax: number;
  total: number;
  requiresApproval: boolean;
}

/**
 * One line of the cart: a pass type and how many of it.
 *
 * Quote, register and checkout all take `items`, so a buyer can hold a General
 * Admission and a VIP pass in the same order. The API still accepts the older
 * single `ticketTierId` + `quantity` pair, but nothing here sends it.
 */
export interface TicketCartItem {
  ticketTierId: string;
  quantity: number;
}

export async function quoteTickets(
  slug: string,
  payload: {
    items: TicketCartItem[];
    promoCode?: string;
    country?: string;
    addons?: TicketCartItem[];
  }
) {
  return api<QuoteResult>(`${PUBLIC}/${slug}/quote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AttendeeInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  country?: string;
}

/**
 * One named person per seat. Sent alongside the buyer's own `attendee` so an
 * older server, or one that only knows the single-attendee shape, still takes
 * the order.
 */
export interface AttendeeSeatInput {
  ticketTierId: string;
  attendee: AttendeeInput;
  answers?: Record<string, unknown>;
}

export async function registerFree(
  slug: string,
  payload: {
    items: TicketCartItem[];
    attendee: AttendeeInput;
    answers?: Record<string, unknown>;
    attendees?: AttendeeSeatInput[];
    /** Affiliate id from the share link the buyer arrived on. */
    referralCode?: string;
  }
) {
  return api<{
    success: boolean;
    requiresApproval: boolean;
    alreadyRegistered?: boolean;
    /** The first pass in the order. */
    registration: { _id: string; status: string; qrCodeToken: string };
    /** Every pass in the order — one registration and QR code per pass type. */
    registrations?: Array<{
      _id: string;
      ticketTierId: string;
      status: string;
      qrCodeToken: string;
    }>;
  }>(`${PUBLIC}/${slug}/register`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startCheckout(
  slug: string,
  payload: {
    items: TicketCartItem[];
    attendee: AttendeeInput;
    promoCode?: string;
    addons?: TicketCartItem[];
    answers?: Record<string, unknown>;
    attendees?: AttendeeSeatInput[];
    /** Affiliate id from the share link the buyer arrived on. */
    referralCode?: string;
  }
) {
  return api<{
    success: boolean;
    invoiceId: string;
    /** Human-readable INV-… number. Preferred over `invoiceId` in the pay URL. */
    invoiceNumber?: string;
    /** The first pass in the order; `registrations` carries all of them. */
    registrationId: string;
    qrCodeToken: string;
    registrations?: Array<{
      _id: string;
      ticketTierId: string;
      qrCodeToken: string;
    }>;
    amount: number;
    currency: string;
  }>(`${PUBLIC}/${slug}/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTicket(qrCodeToken: string) {
  return api<{
    success: boolean;
    ticket: {
      qrCodeToken: string;
      attendeeName: string;
      attendeeEmail: string;
      tier: { name: string; price: number; currency: string } | null;
      quantity: number;
      status: string;
      paymentStatus: string;
      checkedInAt: string | null;
      valid: boolean;
    };
    event: EventProgram;
  }>(`${PUBLIC}/ticket/${qrCodeToken}`);
}

export interface LookedUpTicket {
  qrCodeToken: string;
  attendeeName: string;
  attendeeEmail: string;
  tier: { name: string; price: number; currency: string } | null;
  quantity: number;
  status: string;
  paymentStatus: string;
  checkedInAt: string | null;
  valid: boolean;
}

/**
 * "Find my ticket" from a reference — a ticket ID, an invoice number or a
 * registration id.
 *
 * A ticket ID resolves on its own; it is the leading characters of the QR
 * token, which the ticket URL already hands out in full. An order reference
 * needs `email`, because invoice numbers run in sequence.
 */
export async function lookupTickets(reference: string, email?: string) {
  return api<{
    success: boolean;
    event: EventProgram;
    tickets: LookedUpTicket[];
  }>(`${PUBLIC}/tickets/lookup`, {
    method: "POST",
    body: JSON.stringify({ reference, email }),
  });
}

export function ticketCalendarUrl(qrCodeToken: string) {
  return `${API_URL.replace(/\/+$/, "")}${PUBLIC}/ticket/${qrCodeToken}/calendar.ics`;
}
