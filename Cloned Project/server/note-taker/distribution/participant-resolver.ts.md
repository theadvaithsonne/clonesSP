# `server/note-taker/distribution/participant-resolver.ts`

> Module exporting `resolveParticipantEmails`.

**Kind:** Note-Taker module — distribution · **Lines:** 115

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ResolvedParticipant` | interface |  | 7 |
| `resolveParticipantEmails` | function | `async resolveParticipantEmails(participants: { identity: string; name?: string; userId?: a…, roomName?: string): Promise<ResolvedParticipant[]>` — Resolve email addresses for meeting participants. | 25 |

## Interfaces

- **Raw collections:** `users`, `meetsessions`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/note-taker/jobs/distribute.worker.ts`
