# `components/ui/data-table/motion.ts`

> Motion tokens for the reusable Bigin-style DataTable.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 48

<!-- docgen:auto -->

## Purpose
Motion tokens for the reusable Bigin-style DataTable.

Ported verbatim from auction.garage so both apps' tables move identically.
These are Bigin's ACTUAL values, extracted live from its list/sheet view
(bigin.zoho.in): easing curves harvested from its stylesheets + the computed
transitions on the real table elements. This is the single source of motion —
components reference these tokens only, so future tweaks are one-file changes.

Measured from Bigin:
  • lv-cell-wrap   → transition: width 0.2s ease-in     (column resize / width)
  • col-header-text→ transition: 0.1s ... ease           (header hover reveal)
  • dominant easings:
      cubic-bezier(0.215,0.61,0.355,1)  easeOutCubic — signature decel (26–29×)
      cubic-bezier(0.4,0,0.2,1)         standard in/out
      cubic-bezier(0.19,1,0.22,1)       easeOutExpo — emphasized entrances
      cubic-bezier(0.18,0.89,0.32,1.28) overshoot "pop" […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EASE` | const | `= { /** easeOutCubic — Bigin's signature decel (reveals, dropdowns, drawer content, settl…` | 19 |
| `DUR` | const | `= { micro: 0.1, // header/row hover tint, icon reveal (Bigin col-header 0.1s) fast: 0.15,…` | 30 |
| `cssEase` | function | `cssEase(e: readonly number[])` | 39 |
| `T` | const | `` = { colWidth: `width ${DUR.base}s ease-in`, // lv-cell-wrap, verbatim headerHover: `${DUR… `` — Ready-made CSS transitions matching Bigin exactly. | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/ui/data-table/DataTable.tsx`
