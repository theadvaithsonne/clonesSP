# `components/garage-admin/OrgKycCard.tsx`

> One office's KYC packet, as rendered on the Office KYC console page (/garage-admin/kyc) once an office is selected.

**Kind:** React component · **Lines:** 562 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
One office's KYC packet, as rendered on the Office KYC console page
(/garage-admin/kyc) once an office is selected.

Two halves:
  - Requirements — tick the built-ins (PAN card, address proof, government
    ID, GST number) and add any custom field. Saving sends the request to
    the founder, who sees a "KYC pending" nudge in the app.
  - Submitted documents — open each one through a short-lived presigned URL
    (they live in a private bucket, so there is no permanent link), approve
    or reject individually, then verify or send the whole packet back.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Loader2`×5 (lucide-react), `ShieldCheck`×2 (lucide-react), `Textarea`×2 (components/ui/textarea.tsx), `Checkbox` (components/ui/checkbox.tsx), `X` (lucide-react), `Input` (components/ui/input.tsx), `Plus` (lucide-react), `CheckCircle2` (lucide-react), `TriangleAlert` (lucide-react), `FileText` (lucide-react), `ExternalLink` (lucide-react), `Trash2` (lucide-react)

### Props

- **`OrgKycCard`**: `orgId: string`, `onChanged?: () => void`

**Hooks used:** `useState`×11, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrgKycCard)` | component | `OrgKycCard({ orgId, onChanged, }: { orgId: string; /** Fired after any…)` | 49 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `lib/admin-api/org-kyc.ts` — `adminOrgKycApi`
  - `lib/org-kyc.ts` — `ORG_KYC_STATUS_LABEL`, `OrgKycRecord`, `OrgKycRequirement`, `OrgKycStatus`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `CheckCircle2`, `ExternalLink`, `FileText`, `Loader2`, `Plus`, `ShieldCheck`, …
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/kyc/page.tsx`
