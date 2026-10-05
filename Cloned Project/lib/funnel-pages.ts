// Page-designer funnel content ("Custom" funnels, DB mode "pages").
// Mirrors contacts-backend/src/models/funnel-page.model.ts — keep in sync.

/** ClickFunnels has no separate tablet view; mobile covers phone and tablet. */
export type Device = "desktop" | "mobile";

/** A style value that may differ per device. `mobile` undefined means "inherit
 *  desktop" — the linked state in the settings panel. */
export interface Responsive<T> {
  desktop?: T;
  mobile?: T;
}

/** Per-device visibility. Missing means visible. */
export interface Visibility {
  desktop?: boolean;
  mobile?: boolean;
}

export interface NodeStyle {
  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  /** Structured; rendered as `backgroundImage` and takes precedence over it. */
  backgroundGradient?: { angle?: number; from?: string; to?: string };
  backgroundSize?: "cover" | "contain" | "auto";
  backgroundPosition?: "center" | "top" | "bottom" | "left" | "right";
  backgroundRepeat?: "no-repeat" | "repeat";

  // Text
  color?: string;
  /** Opt into the theme's gradient-text TOKEN — `theme.accentGradient`
   *  (theme-system.ts), the treatment composite hero headlines and stat
   *  figures use (e.g. `blocks/composite-blocks.tsx`'s
   *  `<span className={theme.accentGradient}>`). A TOKEN SELECTOR, not a
   *  colour value: colour still comes from the theme, same as the rest of
   *  `NodeStyle` (see style-values.ts's "colour is deliberately absent" note)
   *  — this just says "use the theme's own gradient", it carries none.
   *  Meaningful on `heading` and `text` only (their cases in
   *  element-renderer.tsx are what read it); absent means no gradient, same
   *  as `false`.
   *
   *  An explicit `color` on the SAME node wins and this is ignored — the
   *  same rule element-renderer.tsx already applies between `color` and the
   *  theme's own `textPrimary`/`textSecondary` defaults
   *  (`css.color ? '' : theme.textPrimary`); a gradient span layered under an
   *  author's explicit colour choice would silently override it.
   *
   *  Degrades safely by construction, never to invisible text: this prop
   *  only ever selects `theme.accentGradient` WHOLE, never assembles
   *  `bg-clip-text`/`text-transparent`/the gradient background itself as
   *  separate pieces. A theme with no real gradient to offer (`applyBrand`
   *  in theme-system.ts overrides `accentGradient` to a plain
   *  `text-[var(--fnl-brand)]` colour class, with no `text-transparent`,
   *  whenever the author sets a brand colour) already returns a
   *  self-contained, safe class string for that case — same contract
   *  `theme.accentGradient`'s existing composite call sites already rely on. */
  gradientText?: boolean;
  fontWeight?: number;
  /** Key into FONT_STACKS, not a family name. */
  fontFamily?: "sans" | "display" | "serif" | "mono";
  fontSize?: Responsive<number>;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  align?: Responsive<"left" | "center" | "right">;

  // Box
  maxWidth?: number;
  minHeight?: Responsive<number>;
  paddingY?: Responsive<number>;
  paddingX?: Responsive<number>;
  marginY?: Responsive<number>;
  gap?: Responsive<number>;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  borderColor?: string;
  borderRadius?: number;
  /** Key into SHADOW_PRESETS, not a box-shadow value. */
  boxShadow?: "none" | "sm" | "md" | "lg" | "glow";
  opacity?: number;
  className?: string;

  // Layout (meaningful on a page / section respectively — see layout.ts)
  contentWidth?: number | "full";
  fullBleed?: boolean;
  /** A named position INTENT, not a CSS keyword — see `safePosition` in
   *  style-values.ts. An author picks "stick to the top"; resolve-style.ts
   *  decides that means `position: fixed` plus an edge offset plus a
   *  stacking context. Meaningful on a section (a whole section can span the
   *  page as a bar) and on the `sticky_bar` ELEMENT (which defaults this to
   *  "sticky-bottom" itself, independent of whatever section contains it —
   *  see its case in element-renderer.tsx), though the field is shared
   *  across every node level like the rest of NodeStyle. */
  position?: "static" | "relative" | "sticky-top" | "sticky-bottom";

  /** A bounded hover TREATMENT, not raw CSS — see `NODE_HOVER_EFFECTS` /
   *  `safeHoverEffect` (style-values.ts) for the validated enum and
   *  `hoverClassName` (resolve-style.ts) for what each name resolves to.
   *  Meaningful on a Column (it already carries `NodeStyle` and IS the
   *  "card" in primitive terms — this is how a detached composite card's
   *  lift is reproduced) and on an element (a button's CTA hover). Absent
   *  means no hover treatment, same as `"none"`. */
  hover?: "none" | "lift" | "scale";

  /** Opt into the theme's badge/pill TOKEN — `theme.accentBadge`
   *  (theme-system.ts), the themed colour pill (background tint + text tint
   *  + border tint) `blocks/composite-blocks.tsx` uses for the hero eyebrow,
   *  trust-badge check marks, bento/steps ordinals and the lead-form success
   *  message. A TOKEN SELECTOR, not a colour value — same "colour is
   *  deliberately absent" rule as `gradientText` just above: this says "use
   *  the theme's own badge pill", it carries no colour of its own.
   *
   *  RULING (L1 Task 3): a prop on `text`, not a new element type. Every
   *  `accentBadge` call site in composite-blocks.tsx wraps short, already-
   *  themed TEXT content (an eyebrow label, a computed ordinal, a success
   *  message) — none of it is a distinct interactive or structural thing the
   *  way the FAQ accordion is. A new `FunnelElementType` member would cost 7
   *  web registration points (this union, `ELEMENT_LABELS`, the palette
   *  list, `PALETTE_CATEGORIES`, `CONTENT_FIELDS`, the `ElementRenderer`
   *  switch, a `surface.test.tsx` fixture) plus a `contacts-backend` mirror
   *  (`FUNNEL_ELEMENT_TYPES` + `elementTypes.test.ts`) for a control that
   *  boils down to "render this text in a coloured pill" — exactly the
   *  `logo`-collapses-into-`image` cautionary precedent this plan calls out.
   *  Meaningful on `text` only (its case in element-renderer.tsx is what
   *  reads it); absent means no badge treatment, same as `false`.
   *
   *  An explicit `color` on the SAME node wins and this is ignored — same
   *  precedence rule as `gradientText` (`shouldApplyBadge`, resolve-style.ts),
   *  so a badge pill never silently overrides an author's own colour choice. */
  badge?: boolean;
}

export type FunnelElementType =
  | "heading"
  | "text"
  | "image"
  | "video"
  | "button"
  | "product"
  | "form"
  | "divider"
  | "spacer"
  | "icon"
  | "composite_hero"
  | "composite_features"
  | "composite_bento"
  | "composite_trust"
  | "composite_faq"
  | "composite_cta"
  | "composite_form"
  | "composite_testimonials"
  | "composite_logos"
  | "composite_pricing"
  | "composite_steps"
  | "countdown"
  | "sticky_bar"
  | "icon_list"
  | "logo"
  | "popup"
  | "embed"
  | "accordion";

export interface FunnelElement {
  id: string;
  type: FunnelElementType;
  props: Record<string, unknown>;
  style?: NodeStyle;
  visibility?: Visibility;
}

export interface FunnelColumn {
  id: string;
  /** Grid units out of 12; columns in a row should sum to 12. */
  width: number;
  elements: FunnelElement[];
  style?: NodeStyle;
  visibility?: Visibility;
}

export interface FunnelRow {
  id: string;
  columns: FunnelColumn[];
  style?: NodeStyle;
  visibility?: Visibility;
}

export interface FunnelSection {
  id: string;
  rows: FunnelRow[];
  style?: NodeStyle;
  visibility?: Visibility;
}

export interface FunnelPage {
  id: string;
  slug: string;
  title: string;
  order: number;
  sections: FunnelSection[];
  style?: NodeStyle;
  /** Key into THEME_PRESETS (theme-system.ts). Page-level so every composite
   *  block on the page reads one palette — the AI picks it per page, and a
   *  block never chooses its own. Absent means the default preset. */
  themePreset?: string;
}

export type FunnelPages = FunnelPage[];

/** The author's brand, layered over whichever THEME_PRESET is active. One
 *  accent colour is deliberately the whole vocabulary: it is enough to make a
 *  page feel owned, and small enough that it cannot fight a palette that was
 *  designed as a whole. */
export interface FunnelBrand {
  /** Validated hex. Drives buttons, badges, accents and focus rings. */
  primary?: string;
  /** Text colour ON `primary`. Derived from contrast when absent. */
  onPrimary?: string;
}

/** Funnel-level design settings. Mirrors contacts-backend
 *  `IFunnelContent.theme` — keep in sync. */
export interface FunnelTheme {
  /** Key into THEME_PRESETS (theme-system.ts). A page's own `themePreset`
   *  overrides this; absent on both means the default preset. */
  preset?: string;
  brand?: FunnelBrand;
}

/** Props stored on a `product` element — everything needed to rebuild the
 *  catalog item and resolve its public listing URL at render time. */
export interface ProductBlockProps {
  itemId: string;
  itemType: string;
  category?: string;
  orgSlug?: string;
  name: string;
  image?: string;
  price?: number;
  currency?: string;
  /** Ready-to-open URL for "general" platform products (used verbatim when set). */
  href?: string;
  /** CTA text; defaults to "Buy Now". */
  label?: string;
}
