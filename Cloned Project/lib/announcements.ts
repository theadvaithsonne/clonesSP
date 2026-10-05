// Alerts & Promotions — shared vocabulary between the garage-admin authoring
// console (/garage-admin/announcements) and the two places the result is
// rendered (the login screen and the dashboard).
//
// Backend: models/announcement.model.ts, routes/garageAdminAnnouncements.ts,
// routes/publicAnnouncements.ts.

import { API_URL } from "./api";

export type AnnouncementSurface = "pre-login" | "post-login" | "everywhere";
/**
 * Dialog geometry. `sm`/`md`/`lg` are presets; `banner` is a strip, not a
 * modal.
 */
export type AnnouncementSize = "sm" | "md" | "lg" | "banner";
export type AnnouncementContentType = "text" | "image-text";
/**
 * The card's visual style.
 *
 * Named for how it LOOKS, not for what you might use it for. The old
 * use-case names ("feature-promo", "system-alert") told an admin nothing
 * about what they were picking — every one of them rendered the same dark
 * card — and forced a false choice: a promo card that needs a hazard stripe,
 * or an outage notice that wants a soft spotlight, had nowhere to go. Purpose
 * is expressed with the eyebrow and the icon instead, both of which are free.
 *
 * Stored as a free string, so legacy rows keep loading — AnnouncementCard
 * maps the three old names onto the nearest style.
 */
export type AnnouncementTemplate =
  | "solid"
  | "glass"
  | "spotlight"
  | "accent"
  | "caution";
export type AnnouncementCtaKind = "page" | "url";

/**
 * The glyph in the card's glass badge. Independent of `template`, because
 * "which shape" and "which chrome" are separate decisions — a bell on a promo
 * card is a legitimate thing to want.
 *
 * The backend stores this as a free string, so adding one here is a
 * frontend-only change. Unknown values fall back to `megaphone`.
 */
export type AnnouncementIcon =
  | "none"
  | "megaphone"
  | "bell"
  | "alert"
  | "info"
  | "sparkle"
  | "gift"
  | "rocket"
  | "bolt"
  | "calendar"
  | "lock"
  | "wrench";

export interface AnnouncementCta {
  enabled: boolean;
  label: string;
  kind: AnnouncementCtaKind;
  href: string;
  newTab: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  eyebrow: string;
  surface: AnnouncementSurface;
  size: AnnouncementSize;
  contentType: AnnouncementContentType;
  imageUrl: string;
  template: AnnouncementTemplate;
  icon: AnnouncementIcon;
  cta: AnnouncementCta;
  comingSoon: boolean;
  comingSoonLabel: string;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

/** The shape the editor posts. Server-side ids/versions are not included. */
export type AnnouncementDraft = Omit<
  Announcement,
  "id" | "version" | "createdAt" | "updatedAt"
>;

export const SURFACE_OPTIONS: {
  value: AnnouncementSurface;
  label: string;
  hint: string;
}[] = [
  {
    value: "pre-login",
    label: "Pre-Login",
    hint: "Login / signup screens only",
  },
  {
    value: "post-login",
    label: "Post-Login",
    hint: "Dashboard & workspaces",
  },
  { value: "everywhere", label: "Everywhere", hint: "Both surfaces" },
];

export const SIZE_OPTIONS: {
  value: AnnouncementSize;
  label: string;
  hint: string;
}[] = [
  { value: "sm", label: "Compact", hint: "Small card" },
  { value: "md", label: "Standard", hint: "Medium card" },
  { value: "lg", label: "Wide", hint: "Large card" },
  { value: "banner", label: "Top Banner", hint: "Full-width strip, no modal" },
];

export const TEMPLATE_OPTIONS: {
  value: AnnouncementTemplate;
  label: string;
  hint: string;
}[] = [
  { value: "solid", label: "Solid", hint: "Flat charcoal, thin border" },
  { value: "glass", label: "Glass", hint: "Frosted, blurs the page behind" },
  { value: "spotlight", label: "Spotlight", hint: "Light bloom off the top edge" },
  { value: "accent", label: "Accent Rail", hint: "Yellow rail down the left" },
  { value: "caution", label: "Caution", hint: "Hazard stripe across the top" },
];

/**
 * The icon picker. Labels are what the admin reads; the value is what is
 * stored and what components/announcements/AnnouncementCard maps to a glyph.
 */
export const ICON_OPTIONS: { value: AnnouncementIcon; label: string }[] = [
  { value: "megaphone", label: "Megaphone" },
  { value: "bell", label: "Bell" },
  { value: "alert", label: "Alert" },
  { value: "info", label: "Info" },
  { value: "sparkle", label: "Sparkle" },
  { value: "gift", label: "Gift" },
  { value: "rocket", label: "Rocket" },
  { value: "bolt", label: "Bolt" },
  { value: "calendar", label: "Calendar" },
  { value: "lock", label: "Lock" },
  { value: "wrench", label: "Maintenance" },
  { value: "none", label: "No icon" },
];

/**
 * The CTA dropdown.
 *
 * Almost everything in the product lives INSIDE the workspace: the dashboard
 * is one route whose sections are React state, so there is no /events or
 * /taskroom to link to — a bare path drops the user on the workspace shell
 * with nothing open, or 404s. Every in-app entry is therefore
 * `/workspace?openApp=<slug>`, and each slug must exist in OPEN_APP_POPOVER
 * in app/(dashboard)/layout.tsx, which is what actually opens the panel.
 *
 * The "Public pages" group is the short list of things that genuinely are
 * their own route, reachable without a session.
 */
export const DEEP_LINK_TARGETS: {
  group: string;
  items: { label: string; href: string }[];
}[] = [
  {
    group: "Workspace",
    items: [
      { label: "Workspace home", href: "/workspace" },
      { label: "Taskroom", href: "/workspace?openApp=taskroom" },
      { label: "Cabinet", href: "/workspace?openApp=cabinet" },
      { label: "Deals", href: "/workspace?openApp=deals" },
      { label: "Network Mail", href: "/workspace?openApp=mail" },
      { label: "Thoughts / Notes", href: "/workspace?openApp=notes" },
      { label: "Teamforce (HR)", href: "/workspace?openApp=teamforce" },
      { label: "Orders", href: "/workspace?openApp=orders" },
    ],
  },
  {
    group: "Discover & earn",
    // No bare "Discover" entry: `?openApp=discover` is built around an
    // itemType/itemId pair and opens nothing without one, and the product has
    // no single Discover panel — each section has its own (Live:Discover,
    // Communities:Discover, Products:Browse…). Those are the entries below.
    items: [
      { label: "Events / Live sessions", href: "/workspace?openApp=events" },
      { label: "My enrolled sessions", href: "/workspace?openApp=live-enrolled" },
      { label: "Recordings", href: "/workspace?openApp=recordings" },
      { label: "Courses", href: "/workspace?openApp=courses" },
      { label: "Store / Products", href: "/workspace?openApp=store" },
      { label: "Services", href: "/workspace?openApp=services" },
      { label: "1:1 Calls", href: "/workspace?openApp=calls" },
      { label: "Communities", href: "/workspace?openApp=communities" },
      { label: "Feeds", href: "/workspace?openApp=feeds" },
      { label: "Drops", href: "/workspace?openApp=drops" },
    ],
  },
  {
    group: "Money",
    items: [
      { label: "Vault", href: "/workspace?openApp=vault" },
      { label: "GaragePay / Rewards", href: "/workspace?openApp=garagepay" },
      { label: "Whitelabel", href: "/workspace?openApp=whitelabel" },
    ],
  },
  {
    group: "Public pages",
    items: [
      { label: "Browse HQs", href: "/browse-hqs" },
      { label: "Careers", href: "/careers" },
      { label: "Jobs", href: "/jobs" },
      { label: "Switch Workspace", href: "/select-organization" },
      { label: "Login / Signup", href: "/login" },
    ],
  },
];

export function emptyAnnouncementDraft(): AnnouncementDraft {
  return {
    title: "",
    body: "",
    eyebrow: "",
    surface: "post-login",
    size: "md",
    contentType: "text",
    imageUrl: "",
    template: "solid",
    icon: "megaphone",
    cta: {
      enabled: false,
      label: "",
      kind: "page",
      href: "",
      newTab: false,
    },
    comingSoon: false,
    comingSoonLabel: "",
    enabled: false,
    startsAt: null,
    endsAt: null,
    priority: 0,
  };
}

// ---------------------------------------------------------------------------
// Dismissal
// ---------------------------------------------------------------------------

// Two levels, because "close this" and "never show me this" are different
// intentions and the old single level made "Not now" a lie:
//
//   snooze  → sessionStorage. Closing the dialog (X / "Not now") hides it for
//             this tab session; it comes back on the next visit.
//   discard → localStorage. "Don't show this again" retires it for good on
//             this browser.
const DISCARD_KEY = "garage_announcements_dismissed";
const SNOOZE_KEY = "garage_announcements_snoozed";

/**
 * Keyed on version, not id alone: an admin who hits "Show again" bumps the
 * version server-side, which makes every stored key stale and the card
 * reappears. Without that, a discarded announcement is un-showable.
 */
function dismissKey(a: Pick<Announcement, "id" | "version">): string {
  return `${a.id}:${a.version}`;
}

function readKeys(store: Storage | undefined, key: string): string[] {
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushKey(store: Storage | undefined, key: string, value: string): void {
  if (!store) return;
  try {
    const next = readKeys(store, key).filter((k) => k !== value);
    next.push(value);
    // Keep the list from growing without bound as announcements come and go.
    store.setItem(key, JSON.stringify(next.slice(-100)));
  } catch {
    /* private mode / quota — worst case the dialog shows again */
  }
}

const local = () => (typeof window === "undefined" ? undefined : localStorage);
const session = () =>
  typeof window === "undefined" ? undefined : sessionStorage;

/** Retired for good on this browser. */
export function isAnnouncementDiscarded(
  a: Pick<Announcement, "id" | "version">
): boolean {
  return readKeys(local(), DISCARD_KEY).includes(dismissKey(a));
}

export function discardAnnouncement(
  a: Pick<Announcement, "id" | "version">
): void {
  pushKey(local(), DISCARD_KEY, dismissKey(a));
}

/** Closed for this tab session only. */
export function isAnnouncementSnoozed(
  a: Pick<Announcement, "id" | "version">
): boolean {
  return readKeys(session(), SNOOZE_KEY).includes(dismissKey(a));
}

export function snoozeAnnouncement(
  a: Pick<Announcement, "id" | "version">
): void {
  pushKey(session(), SNOOZE_KEY, dismissKey(a));
}

/** Either level — i.e. "do not show this to me right now". */
export function isAnnouncementHidden(
  a: Pick<Announcement, "id" | "version">
): boolean {
  return isAnnouncementDiscarded(a) || isAnnouncementSnoozed(a);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Live announcements for a surface, best first. Never throws: an announcement
 * is decoration, and a failed fetch must not break a login screen.
 */
export async function fetchActiveAnnouncements(
  surface: "pre-login" | "post-login"
): Promise<Announcement[]> {
  try {
    const res = await fetch(
      `${API_URL}/public/announcements/active?surface=${surface}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json?.data;
    return Array.isArray(rows) ? (rows as Announcement[]) : [];
  } catch {
    return [];
  }
}
