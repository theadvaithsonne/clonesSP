# `components/dashboard/docusign/shared/editorTokens.ts`

> The DocuSign module's visual vocabulary, in one place.

**Kind:** React component · **Lines:** 69

<!-- docgen:auto -->

## Purpose
The DocuSign module's visual vocabulary, in one place.

These mirror the Dashboard tab — DocusignDashboardView.tsx and analytics/* — which is the
reference every other DocuSign screen is meant to match. They live here because the module had
no shared style module at all: every colour was hand-typed at each call site, so each restyle
pass introduced a new near-miss — the greys alone had drifted into six near-identical variants
against the three the dashboard actually uses. (The old values are deliberately not listed here:
a grep for them should return nothing but real offenders.)

Compose these instead of re-typing hex. Where a component needs to extend one, append with a
template string (`${PANEL} mt-3`) rather than copying the value.

── What does NOT belong here ────────────────────────────────────────────────────────────────
Semantic colour is data, not theme, and must stay at its source:
  * recipient accents      -> RECIPIENT_COLORS in ./recipientConstants
  * field colour swatches  -> COLOR_PRESETS in ./fieldStyle […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PANEL` | const | `= "rounded-2xl border border-[#2a2a35] bg-[#111116] p-5"` — A top-level card. The dashboard has no gradients and no borders other than #2a2a35. | 24 |
| `PANEL_INSET` | const | `= "rounded-lg border border-[#2a2a35] bg-[#0c0c10]"` — A recessed row or sub-panel nested inside a PANEL or a rail. | 26 |
| `BORDER` | const | `= "border-[#2a2a35]"` — Hairline between sections. | 28 |
| `HEADING` | const | `= "text-sm font-semibold text-white/90"` — The ONLY use of text-sm in this module. | 32 |
| `SUBTITLE` | const | `= "text-xs text-[#7a7a90]"` — One line under a heading, and the tint for standalone icons. | 34 |
| `LABEL_MUTED` | const | `= "text-xs text-[#8a8a9b]"` — A control's label, and empty-state copy. | 36 |
| `LABEL_LIST` | const | `= "text-xs text-[#c4c4d4]"` — The brighter grey, for a list item's primary label. | 38 |
| `ROW_TITLE` | const | `= "text-[13px] text-white/90"` — A row's first line. | 40 |
| `ROW_NAME` | const | `= "text-[13px] font-medium text-white/90"` — A row's first line when it names a person — the dashboard's only row-level font-medium. | 42 |
| `ROW_SECONDARY` | const | `= "text-[11px] text-white/45"` — A row's second line: email, timestamp, hash, count. | 44 |
| `ICON_TINT` | const | `= "text-[#7a7a90]"` — Icons sitting beside text. | 46 |
| `BTN_SECONDARY` | const | `= "h-8 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 text-xs text-white/70 hover…` | 51 |
| `BTN_PRIMARY` | const | `= "h-8 rounded-lg bg-brand px-2.5 text-xs font-medium text-[#141414]"` | 53 |
| `TEXTAREA` | const | `= "min-h-0 w-full rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 py-2 text-xs tex…` — Multi-line variant. Drops the primitive's `field-sizing-content`/`min-h-16`, which otherwise overrides the `rows` the caller asked for, and its full-brightness placeholder. | 56 |
| `INPUT` | const | `= "h-8 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 text-xs text-white/85 place…` | 59 |
| `SKELETON` | const | `= "animate-pulse rounded bg-white/[0.04]"` — Block-level loading. Give it a height; the dashboard never spins for a whole region. | 65 |
| `ACCENT` | const | `= "#FBD10D"` — The accent, for a selected segment or a value that needs attention. | 67 |
| `ACCENT_ON` | const | `= "#141414"` | 68 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/shared/DeclineDialog.tsx`
- `components/dashboard/docusign/shared/PdfFilesPicker.tsx`
- `components/dashboard/docusign/shared/admin/MembersTab.tsx`
