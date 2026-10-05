# `components/dashboard/docusign/external/ExternalRecipientsPanel.tsx`

> React component `ExternalRecipientsPanel`.

**Kind:** React component · **Lines:** 139 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Input`×2 (components/ui/input.tsx), `Label` (components/ui/label.tsx), `X` (lucide-react), `UserPlus` (lucide-react)

### Props

- **`ExternalRecipientsPanel`**: `recipients: ExternalRecipientDraft[]`, `onChange: (recipients: ExternalRecipientDraft[]) => void`, `disabled?: boolean`, `deliveryMode?: DsDeliveryMode`, `onDeliveryModeChange?: (mode: DsDeliveryMode) => void`, `grouped?: boolean`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ExternalRecipientDraft` | interface |  | 11 |
| `ExternalRecipientsPanel` | component | `ExternalRecipientsPanel({ recipients, onChange, disabled, deliveryMode, onDeliveryM…)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/dashboard/docusign/shared/recipientConstants.ts` — `RECIPIENT_COLORS`, `MAX_SEPARATE_COPIES`
  - `lib/docusign/types.ts` — `MAX_BUNDLE_RECIPIENTS`, `DsDeliveryMode`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `X`, `UserPlus`

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
