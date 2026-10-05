// Alerts & Promotions — the dialog/banner the Garage super admin puts in
// front of users, either on the login screen or inside the app.
//
// One document is one "announcement": where it shows, how big it is, which
// visual template it uses, what it says, and where its CTA goes. The whole
// thing is authored in the garage-admin console
// (/garage-admin/announcements) and read back by the app through the
// unauthenticated /public/announcements/active endpoint — unauthenticated
// because the pre-login surface is, by definition, a screen with no token.
//
// Dismissal is client-side (localStorage keyed on `${id}:${version}`), so
// there is no per-user read model here. `version` is the escape hatch:
// bumping it makes an already-dismissed announcement show again for
// everyone, which is what an admin means by "re-publish this".
import mongoose, { Schema, Document, Types } from "mongoose";

/** Which screens the announcement is allowed to appear on. */
export type AnnouncementSurface = "pre-login" | "post-login" | "everywhere";

/**
 * Dialog geometry. `sm`/`md`/`lg` are presets; `banner` is a full-width strip
 * pinned to the top of the viewport rather than a modal.
 */
export type AnnouncementSize = "sm" | "md" | "lg" | "banner";

export type AnnouncementContentType = "text" | "image-text";

/**
 * The card's visual style. A free string rather than an enum: the catalogue
 * is a frontend concern (lib/announcements.ts TEMPLATE_OPTIONS), and rows
 * written before a rename must keep loading — the renderer maps unknown and
 * legacy names ("feature-promo", "system-alert", "clean-announcement") onto
 * a current style rather than failing.
 */
export type AnnouncementTemplate = string;

/**
 * The glyph inside the glass badge. Independent of `template` — an admin may
 * want a bell on a promo card or a megaphone on an alert — with "none" for a
 * card that should carry no badge at all.
 *
 * Not an enum in the schema: the frontend owns the catalogue
 * (lib/announcements.ts ICON_OPTIONS), and an unknown name simply falls back
 * to the default glyph rather than failing a save.
 */
export type AnnouncementIcon = string;

/**
 * `page` is one of the curated in-app destinations the admin picks from a
 * dropdown (stored as its path, e.g. "/taskroom"); `url` is anything the
 * admin typed. Both end up as `href` — the kind is kept so the console can
 * re-open the right editor control.
 */
export type AnnouncementCtaKind = "page" | "url";

export interface IAnnouncementCta {
  enabled: boolean;
  label: string;
  kind: AnnouncementCtaKind;
  href: string;
  /** Open in a new tab. Forced on for off-platform URLs by the renderer. */
  newTab: boolean;
}

export interface IAnnouncement extends Document {
  title: string;
  /**
   * Rich text, authored in the console's editor and stored as HTML.
   *
   * NOT trusted here. The renderer is the security boundary: the app runs
   * this through DOMPurify with an explicit tag/attribute allow-list before
   * it ever reaches the DOM (components/announcements/AnnouncementCard).
   * `stripDangerousHtml` below is a second, cruder pass so obviously hostile
   * markup never even lands in the database.
   */
  body: string;
  /** Small line above the title — "New", "Scheduled maintenance", etc. */
  eyebrow?: string;
  surface: AnnouncementSurface;
  size: AnnouncementSize;
  contentType: AnnouncementContentType;
  /** S3 URL from /garage-admin/upload. Only meaningful for "image-text". */
  imageUrl?: string;
  template: AnnouncementTemplate;
  icon: AnnouncementIcon;
  cta: IAnnouncementCta;
  /**
   * Marks the thing being announced as not shipped yet: the card gets a
   * "Coming Soon" badge and the CTA becomes inert rather than a dead link.
   */
  comingSoon: boolean;
  comingSoonLabel?: string;
  enabled: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  /** Higher wins when several announcements are live on one surface. */
  priority: number;
  /** Bumped to un-dismiss the announcement for everyone. */
  version: number;
  createdByAdminId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CtaSchema = new Schema<IAnnouncementCta>(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, trim: true, maxlength: 60, default: "" },
    kind: { type: String, enum: ["page", "url"], default: "page" },
    href: { type: String, trim: true, maxlength: 2000, default: "" },
    newTab: { type: Boolean, default: false },
  },
  { _id: false }
);

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, default: "", trim: true, maxlength: 8000 },
    eyebrow: { type: String, trim: true, maxlength: 60 },
    surface: {
      type: String,
      enum: ["pre-login", "post-login", "everywhere"],
      default: "post-login",
      index: true,
    },
    size: {
      type: String,
      enum: ["sm", "md", "lg", "banner"],
      default: "md",
    },
    contentType: {
      type: String,
      enum: ["text", "image-text"],
      default: "text",
    },
    imageUrl: { type: String, trim: true, maxlength: 2000 },
    template: { type: String, trim: true, maxlength: 40, default: "solid" },
    icon: { type: String, trim: true, maxlength: 40, default: "megaphone" },
    cta: { type: CtaSchema, default: () => ({}) },
    comingSoon: { type: Boolean, default: false },
    comingSoonLabel: { type: String, trim: true, maxlength: 40 },
    // Created off, always: saving a draft must never put a dialog in front of
    // every user on the platform. The admin flips it on deliberately.
    enabled: { type: Boolean, default: false, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    priority: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
      default: null,
    },
  },
  { timestamps: true }
);

// The public read is always "what is live on this surface, best first".
AnnouncementSchema.index({ enabled: 1, surface: 1, priority: -1, createdAt: -1 });

export const Announcement =
  (mongoose.models.Announcement as mongoose.Model<IAnnouncement>) ||
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);

export default Announcement;
