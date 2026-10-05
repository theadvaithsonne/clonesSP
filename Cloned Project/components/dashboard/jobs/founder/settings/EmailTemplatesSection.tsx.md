# `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx`

> A18 · Email templates — the wording of every automatic candidate email.

**Kind:** React component · **Lines:** 259 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Email templates — the wording of every automatic candidate email.
Jobs pick a template by kind (application received, rejection…); custom
templates are used by stage auto-actions and knockout rules.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/dashboard/jobs/ui.tsx), `Card`×3 (components/dashboard/jobs/ui.tsx), `Chip`×3 (components/dashboard/jobs/ui.tsx), `TextInput`×2 (components/dashboard/jobs/ui.tsx), `SectionHeading` (components/dashboard/jobs/founder/settings/shared.tsx), `Plus` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `SaveBar` (components/dashboard/jobs/founder/settings/shared.tsx), `TemplateEditor` (local), `Modal` (components/dashboard/jobs/ui.tsx)

### Props

- **`EmailTemplatesSection`**: `props: SectionProps`

**Hooks used:** `useDraft` (components/dashboard/jobs/founder/settings/shared.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmailTemplatesSection)` | component | `EmailTemplatesSection({ data, onSaved, onDirtyChange }: SectionProps)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `newId`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Chip`, `Modal`, `TextInput`, `useConfirm`
  - `components/dashboard/jobs/types.ts` — `EmailTemplate`, `EmailTemplateKind`, `(types only)`
  - `components/dashboard/jobs/founder/settings/shared.tsx` — `SaveBar`, `SectionHeading`, `errorMessage`, `useDraft`, `SectionProps`
- **Packages:**
  - `react`
  - `lucide-react` — `Pencil`, `Plus`, `Trash2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
