# `components/dashboard/founderGrid/tokens.ts`

> Shared visual tokens for the founder console's Bigin-style data grids (Communities → Orders, Communities/Live → Unsub Log).

**Kind:** React component · **Lines:** 55

<!-- docgen:auto -->

## Purpose
Shared visual tokens for the founder console's Bigin-style data grids
(Communities → Orders, Communities/Live → Unsub Log).

These were copy-pasted per grid, which is exactly how two pages that are
supposed to look identical end up with a #2E2E2E border on one and a
white/[0.06] one on the other. One definition, imported.

The Live Streams grid still carries its own copies in
`liveStreams/founderStreamCells.tsx` — same values, not yet migrated.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GRID_BG` | const | `= "#0a0a0d"` — The dashboard shell's own surface (sidebar + header bar), so a grid reads as part of the app rather than a darker panel dropped on top of it. | 17 |
| `SHELL_BORDER` | const | `= "#2E2E2E"` — The dashboard shell's border colour. | 22 |
| `SHELL_FOOTER_H` | const | `= 44` — Footer bar height. A status strip, not a toolbar: the minimum that still clears the 28px pagination controls. | 26 |
| `GLASS_STYLE` | const | `= { backgroundColor: "rgba(255,255,255,0.055)", backgroundImage: "linear-gradient(135deg,…` — Frosted grey glass — the "selected" surface for filter pills and view tabs, and the fallback tile for anything with no image of its own. | 37 |
| `ROW_H` | const | `= 72` — Row height for these grids. | 54 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `CSSProperties`

## Used by

- `components/dashboard/founderGrid/chrome.tsx`
- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`
- `components/dashboard/founderGrid/orders/founderOrderCells.tsx`
- `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx`
- `components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx`
