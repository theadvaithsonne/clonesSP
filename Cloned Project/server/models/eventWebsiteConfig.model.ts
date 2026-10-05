// src/models/eventWebsiteConfig.model.ts
//
// The saved output of the visual Event Web Builder — an ordered list of
// modular blocks plus a theme. One config per event.
//
// Draft vs live: `blocks`/`theme` are the DRAFT the builder edits. Publishing
// snapshots them into `publishedBlocks`/`publishedTheme`, and the public
// landing page reads ONLY the published snapshot. Without that split, every
// keystroke in the builder would be live on the customer site.

import { Schema, model, Document, Types } from "mongoose";

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

export const EVENT_BLOCK_TYPES: EventBlockType[] = [
  "hero",
  "about",
  "agenda",
  "speakers",
  "sponsors",
  "tickets",
  "venue_map",
  "faq",
  "cta_banner",
  "footer",
];

export interface IEventWebsiteBlock {
  id: string;
  type: EventBlockType;
  order: number;
  isVisible: boolean;
  content: Record<string, any>;
  styles: Record<string, string>;
}

export interface IEventWebsiteTheme {
  primaryColor: string;
  backgroundColor: string;
  font: string;
}

export interface IEventWebsiteConfig extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  isPublished: boolean;
  theme: IEventWebsiteTheme;
  domain?: IEventDomain;
  branding?: IEventBranding;
  seo?: IEventSeo;
  social?: IEventSocial;
  blocks: IEventWebsiteBlock[];
  publishedTheme?: IEventWebsiteTheme;
  publishedBlocks?: IEventWebsiteBlock[];
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlockSchema = new Schema<IEventWebsiteBlock>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: EVENT_BLOCK_TYPES, required: true },
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    // Free-form on purpose: each block type owns its own content shape and the
    // builder must be able to add fields without a schema migration.
    content: { type: Schema.Types.Mixed, default: () => ({}) },
    styles: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const ThemeSchema = new Schema<IEventWebsiteTheme>(
  {
    primaryColor: { type: String, default: "#FACC15" },
    backgroundColor: { type: String, default: "#0c0c0e" },
    font: { type: String, default: "Inter" },
  },
  { _id: false }
);

/**
 * A custom domain pointed at this event's page.
 *
 * `status` is the source of truth for whether the domain is live, and it only
 * moves to "verified" after a real DNS lookup succeeds — never on the
 * organizer's say-so. `verificationToken` is minted once per domain and never
 * reused, so removing and re-adding a host forces a fresh proof of ownership.
 */
export interface IEventDomain {
  host: string;
  status: "pending" | "verified" | "failed";
  verificationToken: string;
  /** What the last check actually found, for a useful error in the UI. */
  lastError?: string;
  lastCheckedAt?: Date;
  verifiedAt?: Date;
}

export interface IEventBranding {
  logoUrl?: string;
  faviconUrl?: string;
  /** Shown next to the logo in the site header. Falls back to the event name. */
  siteName?: string;
}

export interface IEventSeo {
  title?: string;
  description?: string;
  keywords: string[];
  /** Keep the page out of search results — for private or dry-run events. */
  noIndex: boolean;
}

export interface IEventSocial {
  ogTitle?: string;
  ogDescription?: string;
  /** 1200×630 is what every platform crops to. */
  ogImageUrl?: string;
  twitterCard: "summary" | "summary_large_image";
  twitterHandle?: string;
}

const DomainSchema = new Schema<IEventDomain>(
  {
    host: { type: String, trim: true, lowercase: true, maxlength: 253 },
    status: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    verificationToken: { type: String, trim: true },
    lastError: { type: String, trim: true, maxlength: 500 },
    lastCheckedAt: { type: Date },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

const BrandingSchema = new Schema<IEventBranding>(
  {
    logoUrl: { type: String, trim: true, maxlength: 2000 },
    faviconUrl: { type: String, trim: true, maxlength: 2000 },
    siteName: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const SeoSchema = new Schema<IEventSeo>(
  {
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 200 },
    keywords: [{ type: String, trim: true, maxlength: 60 }],
    noIndex: { type: Boolean, default: false },
  },
  { _id: false }
);

const SocialSchema = new Schema<IEventSocial>(
  {
    ogTitle: { type: String, trim: true, maxlength: 120 },
    ogDescription: { type: String, trim: true, maxlength: 300 },
    ogImageUrl: { type: String, trim: true, maxlength: 2000 },
    twitterCard: {
      type: String,
      enum: ["summary", "summary_large_image"],
      default: "summary_large_image",
    },
    twitterHandle: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false }
);

const EventWebsiteConfigSchema = new Schema<IEventWebsiteConfig>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      unique: true,
      index: true,
    },
    isPublished: { type: Boolean, default: false },
    theme: { type: ThemeSchema, default: () => ({}) },
    blocks: { type: [BlockSchema], default: [] },
    publishedTheme: { type: ThemeSchema },
    publishedBlocks: { type: [BlockSchema], default: undefined },
    publishedAt: { type: Date },
    domain: { type: DomainSchema, default: undefined },
    branding: { type: BrandingSchema, default: () => ({}) },
    seo: { type: SeoSchema, default: () => ({}) },
    social: { type: SocialSchema, default: () => ({}) },
  },
  { timestamps: true, collection: "event_website_configs" }
);

// One host can only ever point at one event. Sparse so the many configs with
// no custom domain don't collide on null.
EventWebsiteConfigSchema.index(
  { "domain.host": 1 },
  { unique: true, sparse: true }
);

export const EventWebsiteConfig = model<IEventWebsiteConfig>(
  "EventWebsiteConfig",
  EventWebsiteConfigSchema
);
