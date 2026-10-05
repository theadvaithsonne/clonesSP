# `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx`

> A14 · Create offer: role, annual CTC, currency, joining and expiry dates, an offer letter and a message.

**Kind:** React component · **Lines:** 254 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A14 · Create offer: role, annual CTC, currency, joining and expiry dates, an
offer letter and a message. The candidate accepts or declines inside Garage;
earlier offers stay listed (withdraw a sent one before sending a new one).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×4 (components/dashboard/jobs/ui.tsx), `Button`×2 (components/dashboard/jobs/ui.tsx), `TextInput`×2 (components/dashboard/jobs/ui.tsx), `Drawer` (components/dashboard/jobs/ui.tsx), `Avatar` (components/dashboard/jobs/ui.tsx), `MatchScore` (components/dashboard/jobs/ui.tsx), `CustomSelect` (components/dashboard/jobs/ui.tsx), `FileText` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react), `Upload` (lucide-react), `TextArea` (components/dashboard/jobs/ui.tsx)

### Props

- **`OfferDrawer`**: `open: boolean`, `applicationId: string`, `candidate: { name: string; avatar?: string; title?: string; matchScor…`, `jobTitle: string`, `defaultCurrency?: string`, `offers: Offer[]`, `onClose: () => void`, `onDone: () => void`

**Hooks used:** `useUploadThing` (lib/uploadthing.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OfferDrawer)` | component | `OfferDrawer({ open, applicationId, candidate, jobTitle, defaultCurrency…)` | 36 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CURRENCIES`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `CustomSelect`, `Drawer`, `Label`, `MatchScore`, `TextArea`, `TextInput`, … +3
  - `components/dashboard/jobs/types.ts` — `Offer`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `FileText`, `Loader2`, `Upload`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
