# `components/dashboard/jobs/founder/settings/RejectionReasonsSection.tsx`

> A18 · Rejection reasons — the list offered when rejecting a candidate and in knockout rules.

**Kind:** React component · **Lines:** 134 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Rejection reasons — the list offered when rejecting a candidate and
in knockout rules. Reasons are internal; candidates never see them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SectionHeading` (components/dashboard/jobs/founder/settings/shared.tsx), `Card` (components/dashboard/jobs/ui.tsx), `ArrowUp` (lucide-react), `ArrowDown` (lucide-react), `Trash2` (lucide-react), `Button` (components/dashboard/jobs/ui.tsx), `Plus` (lucide-react), `SaveBar` (components/dashboard/jobs/founder/settings/shared.tsx)

### Props

- **`RejectionReasonsSection`**: `props: SectionProps`

**Hooks used:** `useDraft` (components/dashboard/jobs/founder/settings/shared.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RejectionReasonsSection)` | component | `RejectionReasonsSection({ data, onSaved, onDirtyChange }: SectionProps)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `newId`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`
  - `components/dashboard/jobs/founder/settings/shared.tsx` — `SaveBar`, `SectionHeading`, `errorMessage`, `useDraft`, `SectionProps`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowDown`, `ArrowUp`, `Plus`, `Trash2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
