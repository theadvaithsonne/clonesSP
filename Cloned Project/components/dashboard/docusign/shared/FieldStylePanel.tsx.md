# `components/dashboard/docusign/shared/FieldStylePanel.tsx`

> React component `FieldStylePanel`.

**Kind:** React component · **Lines:** 225 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Label`×3 (components/ui/label.tsx), `Trash2` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `Minus` (lucide-react), `Plus` (lucide-react), `RotateCcw` (lucide-react)

### Props

- **`FieldStylePanel`**: `type: DsField["type"]`, `typeLabel: string`, `recipientName?: string`, `recipientColor?: string`, `recipients?: Array<{ label: string; color: string }>`, `assignedIndex?: number`, `color?: string`, `fontSize?: number`, `required: boolean`, `onChange: (patch: FieldStylePatch) => void`, `onDelete: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FieldStylePatch` | interface |  | 20 |
| `FieldStylePanel` | component | `FieldStylePanel({ type, typeLabel, recipientName, recipientColor, recipient…)` | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/docusign/types.ts` — `DsField`, `(types only)`
  - `components/dashboard/docusign/shared/fieldStyle.ts` — `COLOR_PRESETS`, `DEFAULT_FONT_SIZE`, `FONT_SIZE_MAX`, `FONT_SIZE_MIN`, `FONT_SIZE_PRESETS`, `clampFontSize`, `isSignatureLike`, `supportsFontControls`
- **Packages:**
  - `lucide-react` — `Minus`, `Plus`, `RotateCcw`, `Trash2`

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
