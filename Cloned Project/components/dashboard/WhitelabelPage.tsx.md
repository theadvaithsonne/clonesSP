# `components/dashboard/WhitelabelPage.tsx`

> Standalone Whitelabel add-on page.

**Kind:** React component · **Lines:** 316 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Standalone Whitelabel add-on page. Opened from the sidebar's Earn
dropdown (activePopover === "Whitelabel").

Layout is a single centered pitch card — badge, price, feature list,
one upgrade button. Card selection deliberately lives one step later,
in WhitelabelPurchaseDialog, so this screen stays a pitch and not a
form: the founder decides here, pays there.

Two states, driven by GET /whitelabel-addon/status:
  1. hasAccess === false → the pitch + "Upgrade for $600/year".
  2. hasAccess === true → step 1 of the setup wizard (domain), since
     the next thing a paid founder needs is their own URL, not a
     receipt. See WhitelabelDomainWizard.

Both the purchase and the domain endpoints are founder-only server-side
(`requireFounder`), so non-founders get a read-only note instead.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `ShieldCheck`×2 (lucide-react), `Loader2` (lucide-react), `WhitelabelSetupWizard` (components/dashboard/WhitelabelSetupWizard.tsx), `Globe` (lucide-react), `Check` (lucide-react), `WhitelabelPurchaseDialog` (components/dashboard/WhitelabelPurchaseDialog.tsx)

### Props

- **`WhitelabelPage`**: `setActivePopover?: (popover: string | null) => void`, `onActivated?: () => void`

**Hooks used:** `useState`×4, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WhitelabelPage)` | component | `WhitelabelPage({ setActivePopover, onActivated, }: Props)` | 70 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/whitelabel-addon-api.ts` — `fetchWhitelabelPrice`, `fetchWhitelabelStatus`, `WhitelabelPriceResponse`, `WhitelabelStatusResponse`
  - `components/dashboard/WhitelabelPurchaseDialog.tsx` — `WhitelabelPurchaseDialog`
  - `components/dashboard/WhitelabelSetupWizard.tsx` — `WhitelabelSetupWizard (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Check`, `Globe`, `Loader2`, `ShieldCheck`, `X`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/WhitelabelGate.tsx`
