# `components/dashboard/jobs/founder/settings/SettingsPage.tsx`

> A18 · Jobs settings — careers page, email templates, rejection reasons, saved forms, default pipeline and data & privacy.

**Kind:** React component · **Lines:** 118 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Jobs settings — careers page, email templates, rejection reasons,
saved forms, default pipeline and data & privacy. Settings load once; each
section edits its own draft and saves on its own, and SettingsPage asks
before leaving a section with unsaved edits.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Globe` (lucide-react), `Mail` (lucide-react), `Ban` (lucide-react), `FileStack` (lucide-react), `Workflow` (lucide-react), `ShieldCheck` (lucide-react), `PageHeader` (components/dashboard/jobs/ui.tsx), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `CareersPageSection` (components/dashboard/jobs/founder/settings/CareersPageSection.tsx), `EmailTemplatesSection` (components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx), `RejectionReasonsSection` (components/dashboard/jobs/founder/settings/RejectionReasonsSection.tsx), `SavedFormsSection` (components/dashboard/jobs/founder/settings/SavedFormsSection.tsx), `DefaultPipelineSection` (components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx), `PrivacySection` (components/dashboard/jobs/founder/settings/PrivacySection.tsx)

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SettingsPage)` | component | `SettingsPage()` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `ErrorState`, `LoadingBlock`, `PageHeader`, `useConfirm`, `useLoad`
  - `components/dashboard/jobs/types.ts` — `JobsSettings`, `(types only)`
  - `components/dashboard/jobs/founder/settings/CareersPageSection.tsx` — `CareersPageSection (default)`
  - `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx` — `EmailTemplatesSection (default)`
  - `components/dashboard/jobs/founder/settings/RejectionReasonsSection.tsx` — `RejectionReasonsSection (default)`
  - `components/dashboard/jobs/founder/settings/SavedFormsSection.tsx` — `SavedFormsSection (default)`
  - `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx` — `DefaultPipelineSection (default)`
  - `components/dashboard/jobs/founder/settings/PrivacySection.tsx` — `PrivacySection (default)`
- **Packages:**
  - `react`
  - `lucide-react` — `Ban`, `FileStack`, `Globe`, `Mail`, `ShieldCheck`, `Workflow`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
