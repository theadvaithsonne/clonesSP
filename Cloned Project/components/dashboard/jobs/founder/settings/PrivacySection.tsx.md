# `components/dashboard/jobs/founder/settings/PrivacySection.tsx`

> A18 · Data & privacy — how long opted-in candidates stay in the talent pool, whether candidates may ask for deletion, and the consent candidates agree to before submitting.

**Kind:** React component · **Lines:** 124 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Data & privacy — how long opted-in candidates stay in the talent
pool, whether candidates may ask for deletion, and the consent candidates
agree to before submitting. The minimum clause is fixed; the office can add
its own wording after it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×2 (components/dashboard/jobs/ui.tsx), `SectionHeading` (components/dashboard/jobs/founder/settings/shared.tsx), `CustomSelect` (components/dashboard/jobs/ui.tsx), `Toggle` (components/dashboard/jobs/ui.tsx), `Lock` (lucide-react), `SaveBar` (components/dashboard/jobs/founder/settings/shared.tsx)

### Props

- **`PrivacySection`**: `props: SectionProps`

**Hooks used:** `useDraft` (components/dashboard/jobs/founder/settings/shared.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PrivacySection)` | component | `PrivacySection({ data, onSaved, onDirtyChange }: SectionProps)` | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Card`, `CustomSelect`, `Toggle`
  - `components/dashboard/jobs/founder/settings/shared.tsx` — `SaveBar`, `SectionHeading`, `errorMessage`, `useDraft`, `SectionProps`
- **Packages:**
  - `react`
  - `lucide-react` — `Lock`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
