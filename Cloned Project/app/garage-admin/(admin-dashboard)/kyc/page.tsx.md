# `app/garage-admin/(admin-dashboard)/kyc/page.tsx`

> Office KYC console — the one place KYC is run from.

**Kind:** Next.js page · **Lines:** 679 · **Directive:** `"use client"` · **Route:** `/garage-admin/kyc` (page)

<!-- docgen:auto -->

## Purpose
Office KYC console — the one place KYC is run from.

Left: every office, newest first, so an office created this morning is the
first thing on screen. Search and status filters narrow it; the counts on
the filter chips are what tells an admin there is work waiting.

Right: the selected office's packet — pick which documents it owes and send
the request, then review what comes back, approve or reject each file, and
verify or send the whole thing back. That panel is `OrgKycCard`, which is
also what the flow used to live in on the org detail page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Building2`×3 (lucide-react), `Stat`×3 (local), `ShieldCheck`×2 (lucide-react), `Button` (components/ui/button.tsx), `RefreshCw` (lucide-react), `BellRing` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Inbox` (lucide-react), `MapPin` (lucide-react), `CalendarDays` (lucide-react), `OrgKycCard` (components/garage-admin/OrgKycCard.tsx), `Loader2` (lucide-react)

**Hooks used:** `useState`×7, `useEffect`×3, `useMemo`×3, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OfficeKycPage)` | component | `OfficeKycPage()` | 82 |

## Interfaces

- **Timers / queues:** `setTimeout` at L91; `setInterval` at L133

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/garage-admin/OrgKycCard.tsx` — `OrgKycCard (default)`
  - `lib/admin-api/org-kyc.ts` — `adminOrgKycApi`, `AdminOrgKycListItem`
  - `lib/org-kyc.ts` — `ORG_KYC_STATUS_LABEL`, `OrgKycStatus`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `BellRing`, `Building2`, `CalendarDays`, `Inbox`, `Loader2`, `MapPin`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/kyc` (page).
