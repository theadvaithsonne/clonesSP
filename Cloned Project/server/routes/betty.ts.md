# `server/routes/betty.ts`

> Express router with 19 endpoints, mounted at `/betty`.

**Kind:** Express router · **Lines:** 2296 · **Mounted at:** `/betty` (browser: `/backend/betty`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (19)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/chat` | `/backend/betty/chat` | `requireAuth` | inline | 411 |
| GET | `/chat-history` | `/backend/betty/chat-history` | `requireAuth` | inline | 988 |
| POST | `/clock-in` | `/backend/betty/clock-in` | `requireAuth` | inline | 1021 |
| POST | `/clock-out` | `/backend/betty/clock-out` | `requireAuth` | inline | 1059 |
| POST | `/break-start` | `/backend/betty/break-start` | `requireAuth` | inline | 1094 |
| POST | `/break-stop` | `/backend/betty/break-stop` | `requireAuth` | inline | 1140 |
| GET | `/break-logs` | `/backend/betty/break-logs` | `requireAuth` | inline | 1211 |
| POST | `/time-tracking` | `/backend/betty/time-tracking` | `requireAuth` | inline | 1225 |
| PATCH | `/time-tracking/:id` | `/backend/betty/time-tracking/:id` | `requireAuth` | inline | 1279 |
| GET | `/time-tracking` | `/backend/betty/time-tracking` | `requireAuth` | inline | 1355 |
| GET | `/org-time-tracking` | `/backend/betty/org-time-tracking` | `requireAuth` | inline | 1368 |
| GET | `/leave-requests` | `/backend/betty/leave-requests` | `requireAuth` | inline | 1600 |
| GET | `/my-leave-requests` | `/backend/betty/my-leave-requests` | `requireAuth` | inline | 1613 |
| POST | `/leave-requests` | `/backend/betty/leave-requests` | `requireAuth` | inline | 1625 |
| PATCH | `/leave-requests/:id` | `/backend/betty/leave-requests/:id` | `requireAuth` | inline | 1713 |
| GET | `/pending-leave-requests` | `/backend/betty/pending-leave-requests` | `requireAuth` | inline | 1788 |
| GET | `/online-activity` | `/backend/betty/online-activity` | `requireAuth` | inline | 1824 |
| GET | `/admin-org-attendance` | `/backend/betty/admin-org-attendance` | `requireAuth` | inline | 2105 |
| GET | `/manager-team-attendance` | `/backend/betty/manager-team-attendance` | `requireAuth` | inline | 2201 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_GEMINI_KEY` | const | `= "AIza…[redacted]"` | 27 |
| `default (router)` | default |  | 2295 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `Notification` (server/models/notification.model.ts) — reads: `find`; **writes:** `create`
  - `TimeTracking` (server/models/timeTracking.model.ts) — reads: `find`, `findOne`; **writes:** `create`
  - `LeaveRequest` (server/models/leaveRequest.model.ts) — reads: `find`; **writes:** `create`, `findByIdAndUpdate`
  - `TeamforceLeaveRequest` (server/models/teamforce/teamforceLeaveRequest.model.ts) — reads: `findOne`
  - `TeamforceBreakLog` (server/models/teamforce/teamforceBreakLog.model.ts) — reads: `findOne`, `aggregate`, `find`; **writes:** `create`
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `findOne`, `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/timeTracking.model.ts` — `TimeTracking`
  - `server/models/teamforce/teamforceBreakLog.model.ts` — `TeamforceBreakLog`
  - `server/models/teamforce/teamforceLeaveRequest.model.ts` — `TeamforceLeaveRequest`
  - `server/routes/teamforce/breakSettings.ts` — `findApplicablePolicy`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/models/leaveRequest.model.ts` — `LeaveRequest`
  - `server/models/notification.model.ts` — `Notification`
  - `server/models/user.model.ts` — `User`
  - `server/services/socket.ts` — `emitLeaveRequestNotification`
  - `server/realtime/socket.ts` — `getOnlineUserIds`
  - `server/routes/founderAiProviders.ts` — `getOrgApiKey`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`
  - `@google/generative-ai` — `GoogleGenerativeAI`
  - `openai`
  - `@anthropic-ai/sdk`

## Used by

- `server/app.ts`
- `server/routes/simulatedAudience.ts`
- `server/services/groupTaskClassifier.ts`
- `server/services/messageTranslation.ts`
- `server/services/supportTicketSuggest.ts`
- `server/services/ticketAutoAssign.ts`

Entry: mounted in `server/app.ts` at `/betty`.

## Notes

- Large file (2296 lines) — read it by section; line numbers above point into it.
