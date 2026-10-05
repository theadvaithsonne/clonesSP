/**
 * Shared visual tokens for the founder console's Bigin-style data grids
 * (Communities → Orders, Communities/Live → Unsub Log).
 *
 * These were copy-pasted per grid, which is exactly how two pages that are
 * supposed to look identical end up with a #2E2E2E border on one and a
 * white/[0.06] one on the other. One definition, imported.
 *
 * The Live Streams grid still carries its own copies in
 * `liveStreams/founderStreamCells.tsx` — same values, not yet migrated.
 */

import type { CSSProperties } from "react";

/** The dashboard shell's own surface (sidebar + header bar), so a grid reads
 *  as part of the app rather than a darker panel dropped on top of it. */
export const GRID_BG = "#0a0a0d";

/** The dashboard shell's border colour. Every line a grid draws uses it —
 *  cell grid, toolbar rules, footer divider — instead of three different
 *  shades of white/[0.0x]. */
export const SHELL_BORDER = "#2E2E2E";

/** Footer bar height. A status strip, not a toolbar: the minimum that still
 *  clears the 28px pagination controls. */
export const SHELL_FOOTER_H = 44;

/**
 * Frosted grey glass — the "selected" surface for filter pills and view
 * tabs, and the fallback tile for anything with no image of its own.
 *
 * Deliberately not a gold fill: gold is this console's "here is a number"
 * accent (footer totals, live status dots), and spending it on a filter that
 * usually sits on its default made the loudest thing on screen the fact that
 * nothing was filtered.
 */
export const GLASS_STYLE: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.055)",
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.09)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
};

/**
 * Row height for these grids.
 *
 * Shorter than DataTable's 95px default, which is sized for the Live Streams
 * grid's avatar + three-line money stacks. The tallest cell here is two lines,
 * so 72 leaves a 44px content box — enough for the 32px avatar and both text
 * lines — without an acre of dead space under every row.
 */
export const ROW_H = 72;
