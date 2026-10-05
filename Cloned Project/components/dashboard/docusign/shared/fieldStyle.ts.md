# `components/dashboard/docusign/shared/fieldStyle.ts`

> React hook `usePageSizes`.

**Kind:** React component · **Lines:** 110

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_FONT_SIZE` | const | `= 13` | 11 |
| `FONT_SIZE_MIN` | const | `= 6` | 16 |
| `FONT_SIZE_MAX` | const | `= 72` | 17 |
| `FONT_SIZE_PRESETS` | const | `= [10, 13, 16, 20, 24, 32]` | 20 |
| `clampFontSize` | function | `clampFontSize(pt: number)` | 22 |
| `fontSizeOf` | function | `fontSizeOf(f: { fontSize?: number })` | 28 |
| `COLOR_PRESETS` | const | `= ["#000000", "#ffffff", "#1d4ed8", "#dc2626", "#16a34a", "#6b7280"]` | 30 |
| `supportsTextStyle` | function | `supportsTextStyle(type: DsField["type"])` | 34 |
| `isSignatureLike` | function | `isSignatureLike(type: DsField["type"])` | 40 |
| `supportsFontControls` | function | `supportsFontControls(type: DsField["type"])` | 43 |
| `ptToPx` | function | `ptToPx(pt: number, pageWidthPt: number, renderedWidthPx: number)` | 47 |
| `isLightColor` | function | `isLightColor(hex: string \| undefined)` | 50 |
| `fieldTextStyle` | function | `fieldTextStyle(f: { type: DsField["type"]; color?: string; fontSize?: numb…, pageWidthPt: number, renderedWidthPx: number): CSSProperties` | 60 |
| `SignatureStyle` | interface |  | 76 |
| `signatureStyleOf` | function | `signatureStyleOf(f: { type: DsField["type"]; width: number; height: number; …, pageSize: { w: number; h: number }): SignatureStyle \| undefined` | 85 |
| `signatureStyleKey` | function | `signatureStyleKey(style: SignatureStyle \| undefined)` | 96 |
| `usePageSizes` | hook | `usePageSizes()` | 102 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsField`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useState`, `CSSProperties`

## Used by

- `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
- `components/dashboard/docusign/shared/FieldStylePanel.tsx`
- `components/dashboard/docusign/shared/SignatureCaptureModal.tsx`
