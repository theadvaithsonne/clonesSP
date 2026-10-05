# `server/routes/askCabinet.ts`

> Express router with 1 endpoint, mounted at `/ask-cabinet`.

**Kind:** Express router · **Lines:** 103 · **Mounted at:** `/ask-cabinet` (browser: `/backend/ask-cabinet`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/ask-cabinet` | `requireAuth`, `upload.single("file")` | inline | 24 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 100 |

## Interfaces

- **Timers / queues:** `setTimeout` at L68
- **Filesystem writes:** `writeFile(tmpPath)` (L46)

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
- **Packages:**
  - `express` — `Router`
  - `multer`
  - `@google/generative-ai` — `GoogleGenerativeAI`, `GoogleAIFileManager`
  - `fs` — `promises as fs`
  - `os`
  - `path`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/ask-cabinet`.
