# `components/dashboard/jobs/founder/candidate/RejectModal.tsx`

> Reject a candidate: reason (from Settings → Rejection reasons), an internal note, and whether the candidate gets the rejection email (sent after the job's delay).

**Kind:** React component · **Lines:** 92 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Reject a candidate: reason (from Settings → Rejection reasons), an internal
note, and whether the candidate gets the rejection email (sent after the
job's delay).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/dashboard/jobs/ui.tsx), `Modal` (components/dashboard/jobs/ui.tsx), `CustomSelect` (components/dashboard/jobs/ui.tsx), `TextArea` (components/dashboard/jobs/ui.tsx), `Toggle` (components/dashboard/jobs/ui.tsx)

### Props

- **`RejectModal`**: `open: boolean`, `applicationId: string`, `candidateName: string`, `delayHours?: number`, `onClose: () => void`, `onDone: () => void`

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RejectModal)` | component | `RejectModal({ open, applicationId, candidateName, delayHours, onClose, …)` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `CustomSelect`, `Modal`, `TextArea`, `Toggle`, `errorMessage`, `useLoad`
- **Packages:**
  - `react`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
