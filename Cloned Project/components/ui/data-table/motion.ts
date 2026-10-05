// Motion tokens for the reusable Bigin-style DataTable.
//
// Ported verbatim from auction.garage so both apps' tables move identically.
// These are Bigin's ACTUAL values, extracted live from its list/sheet view
// (bigin.zoho.in): easing curves harvested from its stylesheets + the computed
// transitions on the real table elements. This is the single source of motion —
// components reference these tokens only, so future tweaks are one-file changes.
//
// Measured from Bigin:
//   • lv-cell-wrap   → transition: width 0.2s ease-in     (column resize / width)
//   • col-header-text→ transition: 0.1s ... ease           (header hover reveal)
//   • dominant easings:
//       cubic-bezier(0.215,0.61,0.355,1)  easeOutCubic — signature decel (26–29×)
//       cubic-bezier(0.4,0,0.2,1)         standard in/out
//       cubic-bezier(0.19,1,0.22,1)       easeOutExpo — emphasized entrances
//       cubic-bezier(0.18,0.89,0.32,1.28) overshoot "pop"
//   • dominant durations: 0.1 / 0.15 / 0.2 / 0.25 / 0.3s

export const EASE = {
  /** easeOutCubic — Bigin's signature decel (reveals, dropdowns, drawer content, settle). */
  decel: [0.215, 0.61, 0.355, 1] as const,
  /** Standard in/out — general state changes. */
  standard: [0.4, 0, 0.2, 1] as const,
  /** easeOutExpo — emphasized entrances (drawer slide-in, large dropdowns). */
  expo: [0.19, 1, 0.22, 1] as const,
  /** Slight overshoot/back — micro "pop" (active pill, checkmark, badge). */
  overshoot: [0.18, 0.89, 0.32, 1.28] as const,
} as const;

export const DUR = {
  micro: 0.1, // header/row hover tint, icon reveal (Bigin col-header 0.1s)
  fast: 0.15,
  base: 0.2, // column width, page cross-fade (Bigin 0.2s)
  med: 0.25,
  morph: 0.25, // search-bar expand/collapse
  drawer: 0.3, // filter drawer slide (Bigin 0.3s)
} as const;

export const cssEase = (e: readonly number[]) => `cubic-bezier(${e.join(",")})`;

/** Ready-made CSS transitions matching Bigin exactly. */
export const T = {
  colWidth: `width ${DUR.base}s ease-in`, // lv-cell-wrap, verbatim
  headerHover: `${DUR.micro}s ${cssEase(EASE.decel)}`, // col-header reveal
  rowHover: `background-color ${DUR.micro}s ${cssEase(EASE.decel)}`,
  reveal: `${DUR.fast}s ${cssEase(EASE.decel)}`,
} as const;
