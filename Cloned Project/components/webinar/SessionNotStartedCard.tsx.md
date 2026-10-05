# `components/webinar/SessionNotStartedCard.tsx`

> React component `SessionNotStartedCard`.

**Kind:** React component · **Lines:** 992 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×4 (lucide-react), `Share2`×3 (lucide-react), `Loader2`×3 (lucide-react), `AlarmClock`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `CalendarDays`×2 (lucide-react), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `Building2`×2 (lucide-react), `Square` (lucide-react), `Radio` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Lock` (lucide-react), `UserIcon` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx)

### Props

- **`SessionNotStartedCard`**: `webinarId: string`, `title: string`, `description?: string | null`, `coverPhoto?: string | null`, `hostName?: string | null`, `hostProfilePicture?: string | null`, `orgName?: string | null`, `orgIcon?: string | null`, `brandColor: string`, `timezone?: string | null`, `startDate: Date`, `endDate?: Date | null`, `isLive: boolean`, `alreadyEnded?: boolean`, `enrolledCount: number | null`, `pricing: { isFree: boolean; price: number; currency: string } | null`, `commission: { totalPercentage: number; levels: CommissionLevel[]; nam…`, `people: SessionPerson[]`, `speakers?: SessionPerson[]`, `affiliateId: string`, `resolveAffiliateId?: () => Promise<string>`, `learnMoreHref?: string | null`, `isChecking?: boolean`, `isEnrolled?: boolean`, `… +7 more`

**Hooks used:** `useMemo`×7, `useState`×3, `useCallback`×2, `useBrandColors` (lib/brand-color-context.tsx), `useCountdown` (lib/hooks/useCountdown.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JOIN_WINDOW_MS` | const | `= 10 * 60 * 1000` — Doors open this long before the scheduled start. | 42 |
| `CommissionLevel` | interface |  | 44 |
| `SessionPerson` | interface |  | 50 |
| `SessionNotStartedCardProps` | interface |  | 58 |
| `default (SessionNotStartedCard)` | component | `SessionNotStartedCard({ webinarId, title, description, coverPhoto, hostName, host…)` | 182 |

## Interfaces

- **Timers / queues:** `setTimeout` at L292

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `lib/hooks/useCountdown.ts` — `useCountdown`
  - `lib/calendar.ts` — `generateGoogleCalendarUrl`, `generateOutlookCalendarUrl`, `CalendarEvent`
  - `lib/brand-color-context.tsx` — `useBrandColors`
- **Packages:**
  - `react` — `useCallback`, `useMemo`, `useState`
  - `framer-motion` — `motion`
  - `sonner` — `toast`
  - `lucide-react` — `AlarmClock`, `ArrowRight`, `Building2`, `CalendarDays`, `Check`, `Loader2`, …

## Used by

- `components/webinar/WebinarPreJoin.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L511).
