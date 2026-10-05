# `components/dashboard/docusign/shared/admin/branding/brandingUi.ts`

> Small shared pieces of the Branding editor: its larger form styling (the design's inputs are roomier than the module's compact INPUT token), colour helpers, and draft normalisation for dirty-checking.

**Kind:** React component · **Lines:** 74

<!-- docgen:auto -->

## Purpose
Small shared pieces of the Branding editor: its larger form styling (the design's inputs are roomier
than the module's compact INPUT token), colour helpers, and draft normalisation for dirty-checking.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FIELD_LABEL` | const | `= "text-[13px] text-white/70"` | 6 |
| `FIELD_HINT` | const | `= "text-[11px] text-[#7a7a90]"` | 7 |
| `FIELD_ERROR` | const | `= "text-[11px] text-red-400"` | 8 |
| `TEXT_INPUT` | const | `= "h-11 w-full rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-3.5 text-sm text-white/…` | 9 |
| `TEXT_AREA` | const | `= "w-full resize-y rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-3.5 py-3 text-sm le…` | 11 |
| `SECTION` | const | `= "space-y-4 rounded-2xl border border-[#2a2a35] bg-[#111116] p-5"` | 13 |
| `SECTION_TITLE` | const | `= "text-sm font-semibold text-white/90"` | 14 |
| `SECTION_SUBTITLE` | const | `= "text-xs text-[#7a7a90]"` | 15 |
| `ACCENT_SWATCHES` | const | `= ["#fbd10d", "#111111", "#4f46e5", "#2563eb", "#16a34a", "#dc2626", "#ea580c", "#db2777"]` | 17 |
| `HEX_RE` | const | `= /^#[0-9a-f]{6}$/i` | 19 |
| `readableTextOn` | function | `readableTextOn(hex: string)` | 22 |
| `errorFor` | function | `errorFor(errors: DsBrandingFieldError[], field: string)` | 32 |
| `normalizeBranding` | function | `normalizeBranding(b: DsBranding, defaults: DsBrandingEditor["defaults"]): DsBranding` | 37 |
| `withDefaultsFilled` | function | `withDefaultsFilled(b: DsBranding, defaults: DsBrandingEditor["defaults"]): DsBranding` | 60 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsBranding`, `DsBrandingEditor`, `DsBrandingFieldError`, `DsEmailContent`, `DsEmailKind`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/docusign/shared/admin/branding/AppearanceSection.tsx`
- `components/dashboard/docusign/shared/admin/branding/BrandingTab.tsx`
- `components/dashboard/docusign/shared/admin/branding/EmailContentSection.tsx`
