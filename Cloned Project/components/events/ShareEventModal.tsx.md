# `components/events/ShareEventModal.tsx`

> Share an event — and get paid when the link converts.

**Kind:** React component · **Lines:** 256 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Share an event — and get paid when the link converts.

The link a signed-in user copies carries THEIR affiliate id, never the one
they arrived with. That is the same rule the rest of the product follows
(see `lib/affiliate-share.ts`), and it is what makes the chain work: B
shares A's event, C buys through B's link, B earns.

A guest gets the plain event URL plus a reason to sign in. We deliberately
do not mint an affiliate id for someone who has not asked for one.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Share2`×2 (lucide-react), `X` (lucide-react), `Sparkles` (lucide-react), `Link2` (lucide-react), `Loader2` (lucide-react), `Check` (lucide-react), `Copy` (lucide-react), `Mail` (lucide-react)

### Props

- **`ShareEventModal`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `event: EventProgram`, `theme?: EventTheme`

**Hooks used:** `useState`×3, `useEffect`×3, `useAuthStore`×2 (store/authStore.tsx), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `shareTargets` | function | `shareTargets(url: string, message: string)` — Each network wants the text and the URL in its own shape. | 38 |
| `default (ShareEventModal)` | component | `ShareEventModal({ open, onOpenChange, event, theme, }: { open: boolean; onO…)` | 62 |

## Interfaces

- **External hosts mentioned in the code:** `api.whatsapp.com`, `twitter.com`, `www.linkedin.com`, `t.me`

## Dependencies

- **Internal:**
  - `store/authStore.tsx` — `useAuthStore`
  - `lib/affiliate-share.ts` — `copyToClipboard`, `fetchMyAffiliateId`, `withAffiliateRef`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `EventTheme`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Check`, `Copy`, `Link2`, `Loader2`, `Mail`, `Share2`, …

## Used by

- `app/events/[id]/EventLandingClient.tsx`
- `app/events/[id]/registered/[token]/ConfirmationClient.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
