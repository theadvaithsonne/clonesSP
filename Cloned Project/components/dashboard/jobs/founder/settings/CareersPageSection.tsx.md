# `components/dashboard/jobs/founder/settings/CareersPageSection.tsx`

> A18 · Careers page — how the office appears to candidates: cover, headline, about, culture photos, perks, whether referral rewards show publicly, and the public address.

**Kind:** React component · **Lines:** 315 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Careers page — how the office appears to candidates: cover, headline,
about, culture photos, perks, whether referral rewards show publicly, and
the public address. Name and logo come from the office profile.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×6 (components/dashboard/jobs/ui.tsx), `Button`×4 (components/dashboard/jobs/ui.tsx), `ImagePlus`×2 (lucide-react), `SectionHeading` (components/dashboard/jobs/founder/settings/shared.tsx), `OrgLogo` (components/dashboard/jobs/ui.tsx), `Loader2` (lucide-react), `TextInput` (components/dashboard/jobs/ui.tsx), `TextArea` (components/dashboard/jobs/ui.tsx), `Plus` (lucide-react), `X` (lucide-react), `Chip` (components/dashboard/jobs/ui.tsx), `CopyButton` (components/dashboard/jobs/ui.tsx), `Toggle` (components/dashboard/jobs/ui.tsx), `SaveBar` (components/dashboard/jobs/founder/settings/shared.tsx)

### Props

- **`CareersPageSection`**: `props: SectionProps`

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useDraft` (components/dashboard/jobs/founder/settings/shared.tsx), `useUploadThing` (lib/uploadthing.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CareersPageSection)` | component | `CareersPageSection({ data, onSaved, onDirtyChange }: SectionProps)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Chip`, `CopyButton`, `OrgLogo`, `TextArea`, `TextInput`, `Toggle`
  - `components/dashboard/jobs/founder/settings/shared.tsx` — `SaveBar`, `SectionHeading`, `errorMessage`, `useDraft`, `SectionProps`
- **Packages:**
  - `react`
  - `lucide-react` — `ImagePlus`, `Loader2`, `Plus`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
