// The DocuSign module's visual vocabulary, in one place.
//
// These mirror the Dashboard tab — DocusignDashboardView.tsx and analytics/* — which is the
// reference every other DocuSign screen is meant to match. They live here because the module had
// no shared style module at all: every colour was hand-typed at each call site, so each restyle
// pass introduced a new near-miss — the greys alone had drifted into six near-identical variants
// against the three the dashboard actually uses. (The old values are deliberately not listed here:
// a grep for them should return nothing but real offenders.)
//
// Compose these instead of re-typing hex. Where a component needs to extend one, append with a
// template string (`${PANEL} mt-3`) rather than copying the value.
//
// ── What does NOT belong here ────────────────────────────────────────────────────────────────
// Semantic colour is data, not theme, and must stay at its source:
//   * recipient accents      -> RECIPIENT_COLORS in ./recipientConstants
//   * field colour swatches  -> COLOR_PRESETS in ./fieldStyle
//   * status colours         -> ./StatusBadge (emerald/amber/red/blue carry meaning)
//   * the signer's ink, and anything drawn on the white PDF page
// The PDF canvas is a LIGHT surface (bg-[#e4e4e7], black text). None of the tokens below apply
// inside it — using them there puts dark-theme colours on a white page.

// ── Surfaces ─────────────────────────────────────────────────────────────────────────────────
/** A top-level card. The dashboard has no gradients and no borders other than #2a2a35. */
export const PANEL = "rounded-2xl border border-[#2a2a35] bg-[#111116] p-5";
/** A recessed row or sub-panel nested inside a PANEL or a rail. Darker than its parent. */
export const PANEL_INSET = "rounded-lg border border-[#2a2a35] bg-[#0c0c10]";
/** Hairline between sections. */
export const BORDER = "border-[#2a2a35]";

// ── Type ─────────────────────────────────────────────────────────────────────────────────────
/** The ONLY use of text-sm in this module. Everything else steps down to 13/11px. */
export const HEADING = "text-sm font-semibold text-white/90";
/** One line under a heading, and the tint for standalone icons. */
export const SUBTITLE = "text-xs text-[#7a7a90]";
/** A control's label, and empty-state copy. */
export const LABEL_MUTED = "text-xs text-[#8a8a9b]";
/** The brighter grey, for a list item's primary label. */
export const LABEL_LIST = "text-xs text-[#c4c4d4]";
/** A row's first line. */
export const ROW_TITLE = "text-[13px] text-white/90";
/** A row's first line when it names a person — the dashboard's only row-level font-medium. */
export const ROW_NAME = "text-[13px] font-medium text-white/90";
/** A row's second line: email, timestamp, hash, count. */
export const ROW_SECONDARY = "text-[11px] text-white/45";
/** Icons sitting beside text. */
export const ICON_TINT = "text-[#7a7a90]";

// ── Controls ─────────────────────────────────────────────────────────────────────────────────
// Applied via <Button className={...}> rather than hand-rolled markup: the dashboard's bare
// <button>s don't need focus/disabled/a11y handling, but these do.
export const BTN_SECONDARY =
  "h-8 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 text-xs text-white/70 hover:text-white/90";
export const BTN_PRIMARY = "h-8 rounded-lg bg-brand px-2.5 text-xs font-medium text-[#141414]";
/** Multi-line variant. Drops the primitive's `field-sizing-content`/`min-h-16`, which otherwise
 *  overrides the `rows` the caller asked for, and its full-brightness placeholder. */
export const TEXTAREA =
  "min-h-0 w-full rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 py-2 text-xs text-white/85 shadow-none placeholder:text-[#5a5a72] focus-visible:border-[#3b3b4a] focus-visible:ring-0 focus:outline-none";

export const INPUT =
  "h-8 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 text-xs text-white/85 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none";

// ── States ───────────────────────────────────────────────────────────────────────────────────
/** Block-level loading. Give it a height; the dashboard never spins for a whole region.
 *  (A spinner INSIDE a button is fine and stays — it is the only feedback a sender gets.) */
export const SKELETON = "animate-pulse rounded bg-white/[0.04]";
/** The accent, for a selected segment or a value that needs attention. */
export const ACCENT = "#FBD10D";
export const ACCENT_ON = "#141414";
