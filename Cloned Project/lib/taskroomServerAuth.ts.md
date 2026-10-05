# `lib/taskroomServerAuth.ts`

> Server-only helpers that Next.js API route handlers use to authenticate a caller against the external Taskroom API before they do paid work such as OpenAI calls.

**Kind:** frontend library (server-side) · **Lines:** 33

## Purpose
The Taskroom AI routes under `app/api/taskroom/*` call OpenAI, which costs money, so they must not be callable anonymously. This module pulls the caller's Garage token (`garage_tok`) from the `Authorization` header and checks it by fetching the user's profile from the external Taskroom service. A route proceeds only when that profile resolves.

## How it works
- `TASKROOM_API_BASE` is `NEXT_PUBLIC_TASKROOM_URL` (default `https://uatapi.garage.app/taskroomv2/v2/`) with trailing slashes trimmed and exactly one `/` added back.
- `getBearerToken(req)` matches `Authorization: Bearer <token>` (case-insensitive) and returns the trimmed token, or `null`.
- `verifyTaskroomUser(req)`:
  1. Returns `null` when there is no token.
  2. Sends `GET ${TASKROOM_API_BASE}users/profile` with the same Bearer token, `cache: "no-store"` and a 10-second `AbortSignal.timeout`.
  3. Returns `json.data` only when the response is OK and has a truthy `status` and `data._id`. Any non-OK response, JSON failure, network error or timeout returns `null`.

## Exports
- `TASKROOM_API_BASE: string` - normalised base URL of the Taskroom API, always ending in `/`.
- `getBearerToken(req: Request): string | null` - extracts the Bearer token.
- `verifyTaskroomUser(req: Request): Promise<{ _id: string } | null>` - resolves the caller's Taskroom profile, or `null`.

## Interfaces
- **External services:** Taskroom API (`https://uatapi.garage.app/taskroomv2/v2/` by default, not part of this repo) - `GET users/profile`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - overrides the Taskroom base URL.

## Dependencies
- **Internal:** none.
- **Packages:** none. It uses the global `fetch`, `Request` and `AbortSignal`.

## Used by
- `app/api/taskroom/ai-chat/route.ts`
- `app/api/taskroom/ask-ai/route.ts`
- `app/api/taskroom/generate-description/route.ts`

## Notes
- The file is intended for server code only, but it has no `server-only` import guard. Importing it from a client component would not fail.
- Every protected AI request costs one round trip to the Taskroom API, up to 10 seconds.
