# `app/careers/[id]/VacancyDetailClient.tsx`

> React component `VacancyDetailClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 354 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Skeleton`×14 (components/ui/skeleton.tsx), `Label`×5 (components/ui/label.tsx), `Button`×4 (components/ui/button.tsx), `Card`×3 (components/ui/card.tsx), `CardContent`×3 (components/ui/card.tsx), `Input`×3 (components/ui/input.tsx), `ArrowLeft`×2 (lucide-react), `Loader2`×2 (lucide-react), `Badge` (components/ui/badge.tsx), `MapPin` (lucide-react), `Briefcase` (lucide-react), `IndianRupee` (lucide-react), `CheckCircle2` (lucide-react), `Upload` (lucide-react), `FileText` (lucide-react), `Textarea` (components/ui/textarea.tsx)

**Hooks used:** `useState`×10, `useParams` (next/navigation), `useRouter` (next/navigation), `useUploadThing` (lib/uploadthing.ts), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VacancyDetailClient)` | component | `VacancyDetailClient()` | 27 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/careers/vacancies/${id}` (L49)
  - `POST /backend/careers/applications` (L90)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/card.tsx` — `Card`, `CardContent`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/skeleton.tsx` — `Skeleton`
  - `app/careers/types.ts` — `Vacancy`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `ArrowLeft`, `MapPin`, `Briefcase`, `IndianRupee`, `Loader2`, `Upload`, …
  - `sonner` — `toast`

## Used by

- `app/careers/[id]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L213).
