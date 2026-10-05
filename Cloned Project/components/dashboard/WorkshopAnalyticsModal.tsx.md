# `components/dashboard/WorkshopAnalyticsModal.tsx`

> React component `WorkshopAnalyticsModal`.

**Kind:** React component · **Lines:** 1287 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×8 (lucide-react), `Users`×4 (lucide-react), `DollarSign`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Calendar`×3 (lucide-react), `Film`×3 (lucide-react), `UserCheck`×2 (lucide-react), `TrendingUp`×2 (lucide-react), `Clock`×2 (lucide-react), `CheckCircle`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `ChevronUp`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Download`×2 (lucide-react), `FileText`×2 (lucide-react), `UserX` (lucide-react), `BarChart3` (lucide-react), `RefreshCw` (lucide-react), `X` (lucide-react), `Radio` (lucide-react), `MessageSquare` (lucide-react), `Phone` (lucide-react), `Play` (lucide-react), `Sparkles` (lucide-react), `Mail` (lucide-react)

### Props

- **`WorkshopAnalyticsModal`**: `workshop: Workshop`, `orgId: string`, `onClose: () => void`

**Hooks used:** `useState`×17, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopAnalyticsModal` | component | `WorkshopAnalyticsModal({ workshop, orgId, onClose, }: WorkshopAnalyticsModalProps)` | 54 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/webinar/${workshop._id}/recordings` (L154)
  - `GET ${apiUrl}/note-taker/sessions?roomName=${encodeURIComponent(workshop._id)}&limit=20` (L173)
  - `GET ${apiUrl}/note-taker/sessions/${sessionId}/summary` (L193)
  - `POST ${apiUrl}/note-taker/sessions/${sessionId}/send` (L221)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getWorkshopAnalytics`, `getRecurringWorkshopAnalytics`, `getWebinarSessionAnalytics`, `downloadWebinarAttendeesCsv`, `syncWorkshopAttendance`, `markUserAttended`, `WorkshopAnalytics`, `RecurringWorkshopAnalytics`, … +3
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `X`, `Users`, `UserCheck`, `UserX`, `Clock`, `DollarSign`, …
  - `sonner` — `toast`
  - `date-fns` — `format`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
