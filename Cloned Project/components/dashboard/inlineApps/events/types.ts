// Shared types for the Event Management module (founder console + web builder
// + public landing page). Mirrors the Mongoose models in
// garagenew-backend/src/models/event*.model.ts.

export type EventFormat = "in_person" | "hybrid" | "virtual";
export type EventStreamType =
  | "garage_livestream"
  | "money_stream"
  | "external_link";
export type EventStatus =
  | "draft"
  | "published"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface EventVenue {
  name?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  coordinates?: { lat?: number; lng?: number };
}

export interface EventStreaming {
  streamType?: EventStreamType;
  livekitRoomId?: string;
  externalUrl?: string;
}

export interface EventProgram {
  _id: string;
  orgId: string;
  creatorId: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  isRepeating?: boolean;
  repeatRule?: string;
  category?: string;
  language?: string;
  bannerUrl?: string;
  format: EventFormat;
  venue?: EventVenue;
  streaming?: EventStreaming;
  totalCapacity: number;
  requireApproval?: boolean;
  isPrivate?: boolean;
  payoutWalletId?: string;
  addGstForIndianBuyers?: boolean;
  /** Listed prices already contain the GST (the organizer absorbs it). */
  gstInclusive?: boolean;
  /** Organizer's "someone registered" alert — see lib/feed-api FounderAlerts. */
  founderAlerts?: { enabled: boolean; recipients?: string[] };
  status: EventStatus;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Only present on the list endpoint. */
  ticketsSold?: number;
  registrations?: number;
  pendingApproval?: number;
}

export interface TicketTier {
  _id: string;
  eventId: string;
  /** "ticket" is admission; "addon" is bought alongside one. */
  kind?: "ticket" | "addon";
  name: string;
  description?: string;
  perks?: string[];
  price: number;
  currency: string;
  quantity: number;
  soldCount: number;
  salesStart?: string;
  salesEnd?: string;
  isVisible: boolean;
  isPaused?: boolean;
  sortOrder: number;
  /**
   * Computed by GET /:id/tickets.
   *
   * `soldCount` from that endpoint is REAL sales (paid or free registrations).
   * `held` is seats currently reserved by a checkout that hasn't been paid
   * for — they're out of `remaining` but nobody owns them yet.
   */
  held?: number;
  remaining?: number;
  revenue?: number;
  percentSold?: number;
}

export type RegistrationStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";
export type PaymentStatus = "free" | "paid" | "pending" | "refunded";

export interface EventRegistration {
  _id: string;
  eventId: string;
  ticketTierId: { _id: string; name: string; price: number; currency: string } | string;
  attendee: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
  };
  quantity: number;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  currency: string;
  qrCodeToken: string;
  checkedInAt?: string;
  createdAt: string;
  /**
   * The affiliate whose link brought this buyer in, resolved server-side from
   * the buyer's `referredBy`. Null when they arrived on their own, or when the
   * registration has no account behind it.
   */
  referredBy?: {
    name: string;
    affiliateId: string | null;
    /** `founder_default` is a placeholder, not a real referral. */
    source: string | null;
  } | null;
}

export interface EventSpeaker {
  _id: string;
  eventId: string;
  name: string;
  role?: string;
  company?: string;
  bio?: string;
  avatarUrl?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
    website?: string;
    instagram?: string;
  };
  isKeynote?: boolean;
  sortOrder: number;
}

export interface AgendaSession {
  _id: string;
  eventId: string;
  title: string;
  description?: string;
  /** The track column this sits in on the schedule grid. */
  stageName: string;
  /** Room for the track, shown under the track name in the grid header. */
  room?: string;
  /** A break spans every track as one full-width row. */
  sessionType?: "session" | "break";
  /** Track dot colour; falls back to a palette slot when unset. */
  trackColor?: string;
  isLimitedSeats?: boolean;
  /** How this session runs, independently of the event's own format. */
  format?: "in_person" | "virtual" | "hybrid";
  /** Attendees must claim a seat on top of their ticket. */
  requiresRegistration?: boolean;
  /** Seat cap when `requiresRegistration`. 0 means uncapped. */
  seatsAvailable?: number;
  isRecorded?: boolean;
  enableQa?: boolean;
  enablePolls?: boolean;
  startTime: string;
  endTime: string;
  speakerIds: string[];
  isLivestreamed?: boolean;
  sortOrder: number;
}

export type SponsorTier = "platinum" | "gold" | "silver" | "community";

export interface EventSponsor {
  _id: string;
  eventId: string;
  name: string;
  tier: SponsorTier;
  logoUrl?: string;
  boothNumber?: string;
  websiteUrl?: string;
  sortOrder: number;
}


export interface EventMetrics {
  totalCapacity: number;
  ticketsSold: number;
  seatsRemaining: number;
  registrations: number;
  pendingApproval: number;
  approved: number;
  checkedIn: number;
  grossRevenue: number;
  currency: string;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

// ── Web builder ──────────────────────────────────────────────────────────

export type EventBlockType =
  | "hero"
  | "about"
  | "agenda"
  | "speakers"
  | "sponsors"
  | "tickets"
  | "venue_map"
  | "faq"
  | "cta_banner"
  | "footer";

export interface EventBlock {
  id: string;
  type: EventBlockType;
  order: number;
  isVisible: boolean;
  content: Record<string, any>;
  styles: Record<string, string>;
}

export interface EventTheme {
  primaryColor: string;
  backgroundColor: string;
  font: string;
}

export interface EventWebsiteConfig {
  _id: string;
  eventId: string;
  isPublished: boolean;
  theme: EventTheme;
  blocks: EventBlock[];
  publishedAt?: string;
}

/** Everything the public landing page and the builder canvas render from. */
export interface EventSiteData {
  tiers: TicketTier[];
  speakers: EventSpeaker[];
  sessions: AgendaSession[];
  sponsors: EventSponsor[];
}

// ── Registration form builder ────────────────────────────────────────────

export const FORM_FIELD_TYPES = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "job_title",
  "country",
  "short_text",
  "long_text",
  "dropdown",
  "multi_select",
  "terms",
  "marketing_opt_in",
  "photo_consent",
] as const;

export type EventFormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Standard fields answer into `attendee`; everything else into `answers`. */
export const STANDARD_FIELD_TYPES: EventFormFieldType[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "job_title",
  "country",
];

export const CONSENT_FIELD_TYPES: EventFormFieldType[] = [
  "terms",
  "marketing_opt_in",
  "photo_consent",
];

export interface EventFormCondition {
  source: "ticket_type";
  operator: "is" | "is_not";
  /** Ticket tier ids. */
  values: string[];
}

export interface EventFormField {
  /** Stable key — answers are stored against it, so it never changes. */
  key: string;
  type: EventFormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  showOnBadge: boolean;
  mapToDealsField?: string;
  options: string[];
  conditions: EventFormCondition[];
  order: number;
}

export interface EventRegistrationFormConfig {
  _id?: string;
  eventId?: string;
  title: string;
  description?: string;
  fields: EventFormField[];
}
