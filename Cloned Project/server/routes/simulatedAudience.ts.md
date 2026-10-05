# `server/routes/simulatedAudience.ts`

> Simulated audience — fabricated attendees and chat shown alongside the real ones, for LIVE webinars as well as evergreen.

**Kind:** Express router · **Lines:** 337 · **Mounted at:** `/simulated-audience` (browser: `/backend/simulated-audience`)

<!-- docgen:auto -->

## Purpose
Simulated audience — fabricated attendees and chat shown alongside the real
ones, for LIVE webinars as well as evergreen.

Host-facing and founder-guarded, same shape as evergreen.ts. Generation is
AI-assisted but never automatic: the model proposes people and lines, the
host reviews and edits them, and nothing appears in a room until they
explicitly enable it.

The timeline anchor is `manualStartedAt` on the session override — when the
host ACTUALLY went live, not the scheduled time — so `atSec` offsets mean
"this many seconds into the session".

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:workshopId` | `/backend/simulated-audience/:workshopId` | `requireAuth` | inline | 124 |
| PATCH | `/:workshopId` | `/backend/simulated-audience/:workshopId` | `requireAuth` | inline | 152 |
| POST | `/:workshopId/generate` | `/backend/simulated-audience/:workshopId/generate` | `requireAuth` | inline | 212 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 336 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/services/review.ts` — `isUserFounder`
  - `server/routes/founderAiProviders.ts` — `getOrgApiKey`
  - `server/routes/betty.ts` — `DEFAULT_GEMINI_KEY`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`
  - `@google/generative-ai` — `GoogleGenerativeAI`
  - `openai`
  - `@anthropic-ai/sdk`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/simulated-audience`.
