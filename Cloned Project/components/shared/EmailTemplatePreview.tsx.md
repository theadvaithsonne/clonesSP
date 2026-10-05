# `components/shared/EmailTemplatePreview.tsx`

> React components `ResponsiveEmailFrame`, `EmailPreviewCard`, `EmailFullPreviewModal`.

**Kind:** React component · **Lines:** 401 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Maximize2` (lucide-react), `Loader2` (lucide-react), `X` (lucide-react), `ResponsiveEmailFrame` (local)

### Props

- **`ResponsiveEmailFrame`**: `html: string`, `title?: string`, `emailWidth?: number`, `maxScale?: number`, `fallbackHeight?: number`, `interactive?: boolean`, `className?: string`
- **`EmailPreviewCard`**: `srcDoc: string`, `loading: boolean`, `error: string | null`, `onExpand: () => void`
- **`EmailFullPreviewModal`**: `srcDoc: string`, `onClose: () => void`, `note?: string`, `zIndex?: number`

**Hooks used:** `useState`×5, `useEffect`×5, `useRef`×4, `useEmailContentSize`×2 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ResponsiveEmailFrame` | component | `ResponsiveEmailFrame({ html, title = "Email preview", /** Floor for the measured…)` — Renders email HTML at its own natural width and scales the whole thing to whatever width the parent hands it, so the preview is fully responsive and never overflows sideways. | 160 |
| `EmailPreviewCard` | component | `EmailPreviewCard({ srcDoc, loading, error, onExpand, }: { srcDoc: string; lo…)` | 246 |
| `EmailFullPreviewModal` | component | `EmailFullPreviewModal({ srcDoc, onClose, note = "Shown with sample data — real de…)` | 343 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Loader2`, `Maximize2`, `X`

## Used by

- `components/dashboard/docusign/shared/admin/branding/BrandingPreview.tsx`
- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`
- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
