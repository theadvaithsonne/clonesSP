# `lib/api/conference-notes.ts`

> An authenticated client for the AI note-taker's conference sessions: list sessions, read summaries and transcripts, download transcripts, and resend the notes email.

**Kind:** frontend library · **Lines:** 153

## Purpose
The backend's note-taker records conference calls, transcribes them with speaker labels and writes an AI summary (overview, key topics, action items, decisions, questions). This file is the frontend wrapper that the Conference Notes page uses to browse those results. Every list call is limited to `source=conference` sessions.

## How it works
- `authHeaders()` adds `Authorization: Bearer <token>` when `getToken()` returns one.
- `handle<T>(res)` reads the error body as text once, then tries to parse it as JSON, and throws with its `error`, `message`, the raw text, or `Request failed: <status>`. It returns `undefined` for a 204 response and parsed JSON otherwise.
- `conferenceNotesApi` methods (all use `cache: "no-store"` except the download and resend calls):
  - `listSessions()`: `GET /note-taker/sessions?source=conference&limit=100`, returns `sessions` or `[]`. The backend filters by the caller's `orgId` and sorts newest first. 100 is also the server's maximum page size, so older sessions beyond that are not listed.
  - `getSession(id)`: one session.
  - `getSummary(id)` and `getTranscript(id)` return `null` on 404 or when the field is null, meaning processing hasn't finished.
  - `downloadTranscript(id, title, format = "txt")`: fetches `.../transcript/download?format=txt|srt|vtt` with auth, turns the response into a blob URL and clicks a temporary `<a download>` link. The filename is the title with non-word characters replaced by `-`, or `conference-notes` when there is no title. Browser only.
  - `resend(id)`: `POST .../send` asks the backend to email the notes to participants again.
- `isNoteSessionTerminal(status)` returns true for `ready` and `failed`, so callers know when to stop polling.

## Exports
- Types: `NoteSessionStatus` (`recording | transcribing | summarizing | ready | failed`), `ConferenceNoteSession`, `ActionItem`, `ConferenceNoteSummary`, `TranscriptSegment`, `ConferenceNoteTranscript`.
- `conferenceNotesApi` - an object with `listSessions()`, `getSession(id)`, `getSummary(id)`, `getTranscript(id)`, `downloadTranscript(id, title, format?)` and `resend(id)`.
- `isNoteSessionTerminal(status: NoteSessionStatus): boolean`

## Interfaces
- **Backend endpoints called** (all `requireAuth`):
  - `GET /backend/note-taker/sessions?source=conference&limit=100` - `server/note-taker/routes/sessions.ts` (mounted at `/note-taker/sessions`).
  - `GET /backend/note-taker/sessions/:id` - same router.
  - `POST /backend/note-taker/sessions/:id/send` - resend the email.
  - `GET /backend/note-taker/sessions/:id/summary` - `server/note-taker/routes/summaries.ts` (mounted at `/note-taker`).
  - `GET /backend/note-taker/sessions/:id/transcript` and `GET /backend/note-taker/sessions/:id/transcript/download?format=` - `server/note-taker/routes/transcripts.ts` (mounted at `/note-taker`).
- **Database (via backend):** `NoteSession` and the related transcript and summary records, read only from this client.
- **Browser storage / cookies:** reads `garage_tok` through `getToken()`.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL`. `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `components/dashboard/ConferenceNotesPage.tsx`.

## Notes
- The header comment calls the backend "roam-backend". In this project that is the merged Express server under `server/`.
