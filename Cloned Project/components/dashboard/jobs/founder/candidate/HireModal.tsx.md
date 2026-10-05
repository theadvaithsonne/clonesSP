# `components/dashboard/jobs/founder/candidate/HireModal.tsx`

> A14 · Mark hired: confirm the joining date and see what happens to the referral reward — its guarantee period starts from the joining date, and it is paid through the commission plan once that ends.

**Kind:** React component · **Lines:** 142 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A14 · Mark hired: confirm the joining date and see what happens to the
referral reward — its guarantee period starts from the joining date, and
it is paid through the commission plan once that ends. Without a referral
link there is simply no reward due.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/dashboard/jobs/ui.tsx), `Modal` (components/dashboard/jobs/ui.tsx), `Avatar` (components/dashboard/jobs/ui.tsx), `MatchScore` (components/dashboard/jobs/ui.tsx), `Label` (components/dashboard/jobs/ui.tsx)

### Props

- **`HireModal`**: `open: boolean`, `applicationId: string`, `candidate: { name: string; avatar?: string; matchScore: number }`, `jobTitle: string`, `reward: { enabled: boolean; amount: number; guaranteeDays: number } |…`, `referral: { name: string; affiliateId: string } | null`, `onClose: () => void`, `onDone: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (HireModal)` | component | `HireModal({ open, applicationId, candidate, jobTitle, reward, referra…)` | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `GOLD`, `Label`, `MatchScore`, `Modal`, `errorMessage`, `formatDate`, … +1
- **Packages:**
  - `react`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
