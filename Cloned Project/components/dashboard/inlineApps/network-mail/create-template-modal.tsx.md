# `components/dashboard/inlineApps/network-mail/create-template-modal.tsx`

> React component `CreateTemplateModal`.

**Kind:** React component · **Lines:** 161 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `ChevronDown` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`CreateTemplateModal`**: `onClose: () => void`, `onCreate: (data: { name: string; category: string }) => Promise<void>`, `zIndex?: number`

**Hooks used:** `useState`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateTemplateModal` | component | `CreateTemplateModal({ onClose, onCreate, zIndex = 100, }: { onClose: () => void…)` | 8 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ArrowRight`, `ChevronDown`, `X`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx`
- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
