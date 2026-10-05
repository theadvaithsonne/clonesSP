import {
  BellOff,
  Building,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  FileText,
  Hash,
  ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MapPin,
  Receipt,
  ShoppingBag,
  User,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Dynamic fields for the Network Mail visual builder.
 *
 * Templates are stored, edited and exported with plain `{{token}}` text — that
 * is the contract the backend senders read
 * (`garagenew-backend/src/services/welcomeEmail.ts`, `orderEmail.ts`).
 *
 * Tokens are never dressed up as markup inside the canvas. An earlier version
 * swapped them for non-editable "chip" spans; because a token can sit inside an
 * attribute (`<a href="{{org_url}}">`), that rewrite corrupted anchors and leaked
 * inline CSS into the page. The founder now inserts tokens through the
 * "Dynamic Fields" picker and sees real values in the preview instead.
 */

export type MergeVariableCategory =
  | "Customer Details"
  | "Order & Purchase"
  | "Organization Info"
  | "Action Links";

export interface MergeVariable {
  key: string;
  /** Shown in the picker. */
  label: string;
  /** Lucide glyph, rendered inside a tinted badge. */
  icon: LucideIcon;
  /** Tailwind classes for that badge — background tint plus icon colour. */
  tint: string;
  category: MergeVariableCategory;
  /** Readable stand-in used by the preview when the real value is unknown. */
  sample: string;
  /**
   * What the picker row shows after the token, when the raw `sample` would read
   * as noise (a bare "#" for a link, say).
   */
  sampleHint?: string;
  /** Wording for this destination in the button block's link dropdown. */
  actionLabel?: string;
  /**
   * Older alias of another key. Still resolved in previews so existing
   * templates render, but kept out of the picker so founders are offered one
   * name per idea.
   */
  aliasOf?: string;
  /** Belongs in a button/link target — also offered by the button link selector. */
  linkOnly?: boolean;
  /** Image URLs are placed on a logo/image block, never typed into text. */
  imageOnly?: boolean;
}

/** One tint per idea, so the same kind of field always reads the same colour. */
const TINT = {
  person: "bg-blue-500/10 text-blue-400",
  order: "bg-amber-500/10 text-amber-400",
  money: "bg-emerald-500/10 text-emerald-400",
  goods: "bg-purple-500/10 text-purple-400",
  org: "bg-indigo-500/10 text-indigo-400",
  support: "bg-rose-500/10 text-rose-400",
  place: "bg-red-500/10 text-red-400",
  link: "bg-sky-500/10 text-sky-400",
} as const;

export const MERGE_VARIABLES: MergeVariable[] = [
  // ── Customer Details ──
  {
    key: "first_name",
    label: "Customer / Member First Name",
    icon: User,
    tint: TINT.person,
    category: "Customer Details",
    sample: "Alex",
  },
  {
    key: "user_name",
    label: "Customer / Member Full Name",
    icon: UserCheck,
    tint: TINT.person,
    category: "Customer Details",
    sample: "Alex Rivera",
  },
  {
    key: "member_email",
    label: "Customer / Member Email",
    icon: Mail,
    tint: TINT.person,
    category: "Customer Details",
    sample: "alex@example.com",
  },

  // ── Order & Purchase ──
  {
    key: "order_number",
    label: "Order ID / Number",
    icon: Hash,
    tint: TINT.order,
    category: "Order & Purchase",
    sample: "ORD-8H2K9Q",
  },
  {
    key: "order_date",
    label: "Order Date",
    icon: Calendar,
    tint: TINT.order,
    category: "Order & Purchase",
    sample: "17 August 2026",
  },
  {
    key: "order_total",
    label: "Order Total Amount",
    icon: CreditCard,
    tint: TINT.money,
    category: "Order & Purchase",
    sample: "₹1,499.00",
  },
  {
    key: "order_items",
    label: "Purchased Items & Links",
    icon: ShoppingBag,
    tint: TINT.goods,
    category: "Order & Purchase",
    sample: "Design Kit × 1",
  },

  // ── Organization Info ──
  {
    key: "business_name",
    label: "Organization / Business Name",
    icon: Building2,
    tint: TINT.org,
    category: "Organization Info",
    sample: "Acme Studio",
  },
  {
    key: "org_name",
    label: "Organization / Business Name",
    icon: Building2,
    tint: TINT.org,
    category: "Organization Info",
    sample: "Acme Studio",
    aliasOf: "business_name",
  },
  {
    key: "support_option",
    label: "Support Contact Email",
    icon: LifeBuoy,
    tint: TINT.support,
    category: "Organization Info",
    sample: "support@acme.com",
  },
  {
    key: "support_email",
    label: "Support Contact Email",
    icon: LifeBuoy,
    tint: TINT.support,
    category: "Organization Info",
    sample: "support@acme.com",
    aliasOf: "support_option",
  },
  {
    key: "org_location",
    label: "Organization Location",
    icon: MapPin,
    tint: TINT.place,
    category: "Organization Info",
    sample: "San Francisco, CA",
  },
  {
    key: "org_description",
    label: "Organization Description",
    icon: FileText,
    tint: TINT.org,
    category: "Organization Info",
    sample: "A collaborative workspace for our team and community.",
  },
  {
    key: "org_icon",
    label: "Organization Logo",
    icon: ImageIcon,
    tint: TINT.org,
    category: "Organization Info",
    sample: "",
    imageOnly: true,
  },

  // ── Action Links ──
  {
    key: "order_url",
    label: "View Order Link",
    icon: ExternalLink,
    tint: TINT.link,
    category: "Action Links",
    sample: "#",
    sampleHint: "Direct order link",
    actionLabel: "Open Customer's Order Details",
    linkOnly: true,
  },
  {
    key: "invoice_url",
    label: "View Invoice Link",
    icon: Receipt,
    tint: TINT.link,
    category: "Action Links",
    sample: "#",
    sampleHint: "Direct invoice link",
    actionLabel: "Open Invoice PDF",
    linkOnly: true,
  },
  {
    key: "org_url",
    label: "Organization HQ Link",
    icon: Building,
    tint: TINT.link,
    category: "Action Links",
    sample: "https://garage.app/workspace",
    sampleHint: "Direct workspace link",
    actionLabel: "Open Organization Workspace",
    linkOnly: true,
  },
  {
    key: "dashboard_url",
    label: "Member Dashboard Link",
    icon: LayoutDashboard,
    tint: TINT.link,
    category: "Action Links",
    sample: "https://garage.app/dashboard",
    sampleHint: "Direct dashboard link",
    actionLabel: "Open Member Dashboard",
    linkOnly: true,
  },
  {
    key: "unsubscribe_url",
    label: "Unsubscribe Link",
    icon: BellOff,
    tint: TINT.link,
    category: "Action Links",
    sample: "#",
    sampleHint: "One-click unsubscribe",
    actionLabel: "Open Unsubscribe Page",
    linkOnly: true,
  },
];

export const MERGE_VARIABLE_BY_KEY: Record<string, MergeVariable> =
  Object.fromEntries(MERGE_VARIABLES.map((v) => [v.key, v]));

/** Picker order, as specified for the Dynamic Fields menu. */
export const MERGE_VARIABLE_CATEGORY_ORDER: MergeVariableCategory[] = [
  "Customer Details",
  "Order & Purchase",
  "Organization Info",
  "Action Links",
];

/** Section heading shown above the link group — longer than the category name. */
export const MERGE_CATEGORY_HINTS: Partial<Record<MergeVariableCategory, string>> = {
  "Action Links": "For buttons & hyperlinks",
};

/**
 * Everything the Dynamic Fields menu offers. Link tokens are included: they are
 * plain text like any other, and a founder writing "open {{org_url}}" in a
 * sentence is doing something valid.
 */
export function pickableTextVariables(): MergeVariable[] {
  return MERGE_VARIABLES.filter((v) => !v.aliasOf && !v.imageOnly);
}

/** The variables offered as a button/link destination. */
export function pickableLinkVariables(): MergeVariable[] {
  return MERGE_VARIABLES.filter((v) => !v.aliasOf && v.linkOnly);
}

/** What a picker row shows after the token: `e.g. "Alex"`, or a plain hint. */
export function sampleLabel(variable: MergeVariable): string {
  if (variable.sampleHint) return variable.sampleHint;
  return variable.sample ? `e.g. "${variable.sample}"` : "";
}

export const MERGE_SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  MERGE_VARIABLES.map((v) => [v.key, v.sample]),
);

/** The token as it is stored and exported. */
export function mergeToken(key: string): string {
  return `{{${key}}}`;
}

const TOKEN_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/* ─── Preview substitution ────────────────────────────────────────── */

/**
 * Swaps `{{tags}}` for readable values so a founder previews an email rather
 * than a page of placeholders. Unknown tags are left visible on purpose — a
 * stray tag should be obvious at design time, not silently blank.
 */
export function applyMergeSamples(
  html: string,
  overrides?: Record<string, string>,
): string {
  const values = { ...MERGE_SAMPLE_VALUES, ...(overrides || {}) };
  const merged = html.replace(TOKEN_RE, (match, key: string) =>
    key in values ? values[key] : match,
  );
  return stripEmptyImages(merged);
}

/**
 * Drops `<img>` tags left with an empty `src` after substitution. Mirrors the
 * backend: an org with no icon would otherwise ship as a broken image, since a
 * merge tag cannot remove the tag that holds it.
 */
export function stripEmptyImages(html: string): string {
  return html.replace(/<img\b[^>]*\bsrc\s*=\s*(""|'')[^>]*>/gi, "");
}
