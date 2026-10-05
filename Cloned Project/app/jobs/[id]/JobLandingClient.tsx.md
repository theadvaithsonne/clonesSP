# `app/jobs/[id]/JobLandingClient.tsx`

> React component `JobLandingClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 631 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×10 (local), `Input`×6 (local), `PreviewBlock`×4 (local), `HeroStat`×3 (local), `Upload`×2 (lucide-react), `CheckCircle2` (lucide-react), `ApplicationForm` (local), `JobDetails` (local), `Building2` (lucide-react), `MapPin` (lucide-react), `Briefcase` (lucide-react), `Clock` (lucide-react), `ArrowLeft` (lucide-react), `CustomUpload` (local)

**Hooks used:** `useState`×17, `useRef`×4, `useEffect`×3, `useParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JobLandingClient)` | component | `JobLandingClient()` | 48 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${path}` (L38)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `CustomFieldDef`, `RecruitmentRequest`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `next` — `useParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Briefcase`, `MapPin`, `Clock`, `Upload`, `CheckCircle2`, …

## Used by

- `app/jobs/[id]/page.tsx`
