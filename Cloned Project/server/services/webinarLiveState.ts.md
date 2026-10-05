# `server/services/webinarLiveState.ts`

> Module exporting `loadLiveState`, `saveLiveState`, `clearLiveState`.

**Kind:** backend service · **Lines:** 79

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WebinarLiveState` | interface | The parts of a live room that must outlive the process. | 20 |
| `LiveStateKey` | interface |  | 28 |
| `loadLiveState` | function | `async loadLiveState(key: LiveStateKey): Promise<WebinarLiveState \| null>` | 41 |
| `saveLiveState` | function | `async saveLiveState(key: LiveStateKey, patch: WebinarLiveState): Promise<void>` — Merge a partial state in. | 55 |
| `clearLiveState` | function | `async clearLiveState(key: LiveStateKey): Promise<void>` | 74 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `findOne`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/services/mediasoup.ts` — `PinnedProductSnapshot`, `(types only)`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/webinarEnd.ts`
