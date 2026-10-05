# `components/webinar/JoinRequestsPanel.tsx`

> React component `JoinRequestsPanel`.

**Kind:** React component · **Lines:** 71 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `UserRound` (lucide-react), `X` (lucide-react), `Check` (lucide-react)

### Props

- **`JoinRequestsPanel`**: `requests: PendingJoinRequest[]`, `onApprove: (requestId: string) => void`, `onDeny: (requestId: string) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PendingJoinRequest` | interface |  | 5 |
| `default (JoinRequestsPanel)` | component | `JoinRequestsPanel({ requests, onApprove, onDeny, }: { requests: PendingJoinRe…)` — Bat246 "knock" — floating panel for the host, listing visitors currently waiting to be let into the webinar. | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `lucide-react` — `Check`, `UserRound`, `X`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
