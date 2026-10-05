# `server/services/igniteCall.service.ts`

> Module exporting `chunk`, `newestLiveCall`, `enrichStatuses`, `applyManualCompletion`.

**Kind:** backend service · **Lines:** 76

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NC_STATUS_CHUNK` | const | `= 100` — contacts-backend caps a status batch at 100. | 8 |
| `chunk` | function | `chunk(items: T[], size: number): T[][]` | 10 |
| `newestLiveCall` | function | `newestLiveCall(calls: T[]): T \| null` — The call the column reflects: the newest non-detached one. | 22 |
| `enrichStatuses` | function | `async enrichStatuses(scheduleIds: string[], fetchStatuses: (batch: string[]) => Promise<NcScheduleStatu…): Promise<Map<string, NcScheduleStatus>>` — Live status for a set of catch-ups, chunked and FAIL-SOFT. | 38 |
| `applyManualCompletion` | function | `applyManualCompletion(derived: "not_scheduled" \| "scheduled" \| "started" \| "compl…, manuallyCompletedAt?: Date \| null): "not_scheduled" \| "scheduled" \| "started" \| "comp…` — Apply a manual "mark as completed" over the derived status. | 67 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/lib/ncMeetClient.ts` — `NcScheduleStatus`, `(types only)`
- **Packages:** none

## Used by

- `server/routes/garageAdminIgniteCall.ts`
- `server/routes/garageAdminOneTimeAffiliates.ts`
- `server/services/__tests__/igniteCall.service.test.ts`
