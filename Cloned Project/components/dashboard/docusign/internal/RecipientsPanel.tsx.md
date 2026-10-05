# `components/dashboard/docusign/internal/RecipientsPanel.tsx`

> React component `RecipientsPanel`.

**Kind:** React component · **Lines:** 188 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×2 (components/ui/label.tsx), `Switch` (components/ui/switch.tsx), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Badge` (components/ui/badge.tsx), `Button` (components/ui/button.tsx), `X` (lucide-react), `RecipientPicker` (components/dashboard/docusign/internal/RecipientPicker.tsx)

### Props

- **`RecipientsPanel`**: `orgMembers: OrgMemberLite[]`, `onLoadMembers: () => Promise<boolean>`, `recipients: RecipientDraft[]`, `onChange: (recipients: RecipientDraft[]) => void`, `signingOrder: "sequential" | "parallel"`, `onSigningOrderChange: (order: "sequential" | "parallel") => void`, `deliveryMode: DsDeliveryMode`, `onDeliveryModeChange: (mode: DsDeliveryMode) => void`, `disabled?: boolean`, `grouped?: boolean`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecipientDraft` | interface |  | 14 |
| `RecipientsPanel` | component | `RecipientsPanel({ orgMembers, onLoadMembers, recipients, onChange, signingO…)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/label.tsx` — `Label`
  - `store/docusign/docusignStore.ts` — `OrgMemberLite`
  - `components/dashboard/docusign/internal/RecipientPicker.tsx` — `RecipientPicker`
  - `components/dashboard/docusign/shared/recipientConstants.ts` — `MAX_SEPARATE_COPIES`, `RECIPIENT_COLORS`
  - `lib/docusign/types.ts` — `MAX_BUNDLE_RECIPIENTS`, `DsDeliveryMode`
- **Packages:**
  - `react` — `useMemo`
  - `lucide-react` — `X`, `ChevronUp`, `ChevronDown`

## Used by

- `components/dashboard/docusign/internal/FieldEditorView.tsx`
