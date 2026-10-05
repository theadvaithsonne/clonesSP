# `components/shared/OrgKycSection.tsx`

> Founder-facing KYC packet: one row per document the admin asked for, an upload (or a text box for things like the GST number), and a Submit button that only lights up once everything required is answered.

**Kind:** React component · **Lines:** 612 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Founder-facing KYC packet: one row per document the admin asked for, an
upload (or a text box for things like the GST number), and a Submit button
that only lights up once everything required is answered.

Used in two places and mounted at most once in each — the KYC nudge dialog
(`OrgKycBanner`) and the Manage Organization popover.

The layout leads with progress ("2 of 3 provided") rather than a wall of
identical cards: the founder's only real question is how much is left.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `TriangleAlert`×2 (lucide-react), `Check`×2 (lucide-react), `Loader2`×2 (lucide-react), `PillIcon` (local), `Input` (components/ui/input.tsx), `FileText` (lucide-react), `ExternalLink` (lucide-react), `Trash2` (lucide-react), `Upload` (lucide-react), `ShieldCheck` (lucide-react)

### Props

- **`OrgKycSection`**: `orgId: string`, `onStatusChange?: (record: OrgKycRecord) => void`, `className?: string`

**Hooks used:** `useState`×7, `useRef`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrgKycSection)` | component | `OrgKycSection({ orgId, onStatusChange, className, }: { orgId: string; /**…)` | 80 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `lib/org-kyc.ts` — `deleteOrgKycSubmission`, `fetchOrgKyc`, `saveOrgKycText`, `submitOrgKyc`, `uploadOrgKycFile`, `OrgKycRecord`, `OrgKycRequirement`, `OrgKycSubmission`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Check`, `Clock`, `ExternalLink`, `FileText`, `Loader2`, `ShieldCheck`, …
  - `sonner` — `toast`

## Used by

- `components/shared/ManageOrgPopover.tsx`
- `components/shared/OrgKycBanner.tsx`
