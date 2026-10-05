# `server/utils/recurrence.ts`

> Module exporting `getTimezoneOffsetMinutes`, `calculateSessions`, `getNextSession`, `isValidSessionDate` and 7 more.

**Kind:** backend utility · **Lines:** 396

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopSession` | interface |  | 3 |
| `getTimezoneOffsetMinutes` | function | `getTimezoneOffsetMinutes(date: Date, timezone: string): number` — Get the UTC offset in minutes for a given IANA timezone at a specific date. | 134 |
| `calculateSessions` | function | `calculateSessions(recurrencePattern: IRecurrencePattern, recurrenceStartDate: Date, startTime: string, endTime: string, fromDate: Date = new Date(), limit: number = 10, includePast: boolean…` — Calculate upcoming sessions for a recurring workshop | 161 |
| `getNextSession` | function | `getNextSession(recurrencePattern: IRecurrencePattern, recurrenceStartDate: Date, startTime: string, endTime: string, timezone?: string, recurrenceEndDate?: Date): WorkshopSession \| null` — Get the next session from now | 315 |
| `isValidSessionDate` | function | `isValidSessionDate(sessionDate: Date, recurrencePattern: IRecurrencePattern, recurrenceStartDate: Date, recurrenceEndDate?: Date): boolean` — Check if a given date is a valid session date according to the recurrence pattern | 340 |
| `generateSessionId` | function | `generateSessionId(workshopId: string, sessionDate: Date): string` — Generate a unique session identifier for per-session enrollments | 364 |
| `parseSessionId` | function | `parseSessionId(sessionId: string): { workshopId: string; dateString: string } \| null` — Parse a session ID back to workshopId and date | 375 |
| `parseSessionDate` | function | `parseSessionDate(dateString: string): Date` — Get start of day for a date string (YYYY-MM-DD) | 390 |
| `startOfDay` | function | `startOfDay(date: Date): Date` | 395 |
| `endOfDay` | function | `endOfDay(date: Date): Date` | 395 |
| `isSameDay` | function | `isSameDay(date1: Date, date2: Date): boolean` | 395 |
| `formatDateString` | function | `formatDateString(date: Date): string` | 395 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `IRecurrencePattern`
- **Packages:** none

## Used by

- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/downlineMemberLiveStreams.ts`
- `server/services/founderStreamTable.ts`
- `server/services/sellables.ts`
- `server/services/workshop.ts`
- `server/utils/sessionOverlay.ts`
- `server/utils/workshopStatus.ts`
