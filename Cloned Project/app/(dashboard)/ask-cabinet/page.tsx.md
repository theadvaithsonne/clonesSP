# `app/(dashboard)/ask-cabinet/page.tsx`

> Client page with a small form: you upload a video, type a question, and the backend answers it using Google Gemini.

**Kind:** Next.js page · **Lines:** 113 · **Route:** `/ask-cabinet`

## Purpose
This is the standalone "Ask Cabinet" screen. A signed-in user picks a video file, asks a free-text question about it and gets a plain-text answer back. The AI work runs in the Express backend (`server/routes/askCabinet.ts`, mounted at `/ask-cabinet`). The old Next.js handler at `app/api/ask-cabinet/route.ts` is retired: it now always returns HTTP 410 with the message "Deprecated. Use Roam backend /ask-cabinet."

## How it works
- **State:** four `useState` values: `file` (the selected `File`), `question`, `answer` and `loading`.
- **Validation (`onSubmit`):** if no file is chosen or the question is blank, it shows a `sonner` toast (`"Please select a video to upload"` / `"Please enter a question"`) and stops.
- **Submission:** builds a `FormData` with `file` and the trimmed `question`, then calls `api<{ answer: string }>("/ask-cabinet", { method: "POST", body: form })`. The `api()` helper in `lib/api.ts` sees a `FormData` body and does not set `Content-Type`, so the browser adds the multipart boundary. It also attaches `Authorization: Bearer <token>` from `getToken()`.
- **Result:** on success it stores `data.answer` and shows the toast "Answer generated". On failure it logs the error and shows the error message in a toast. `api()` throws using the backend's `error` field, for example "Question is required" or "Video not ready. Please retry.".
- **Reset button:** clears the file, question and answer state. It does not clear the native file input, so the old file name can still show in the input.
- **Rendering:** a dark `Card` holding a file input (`accept="video/*"`), a native `<textarea>` (the comment says this avoids adding another UI dependency), Ask/Reset buttons, and an answer box styled with `whitespace-pre-wrap`. The Ask button reads "Analyzing..." while the request runs.

### What the backend does with the request
`POST /backend/ask-cabinet` runs `requireAuth` and multer with memory storage (1 GB limit; accepts video and PDF MIME types). The handler then:
1. writes the upload to a temp file;
2. uploads it to the Gemini File API;
3. polls for up to 20 s until the file is `ACTIVE`;
4. calls the model `gemini-2.5-flash-lite` with an "expert analyst" prompt;
5. returns `{ answer }`.

If the file is still not ACTIVE after 20 s, the handler returns 502.

## Exports
- `default AskCabinetPage()`: the page component (no props).

## Interfaces
- **Backend endpoints called:** `POST /backend/ask-cabinet` (multipart: `file`, `question`). Returns `{ answer: string }`.
- **External services:** Google Gemini, reached indirectly through the backend.

## Dependencies
- **Internal:** `lib/api.ts` (`api()` fetch wrapper with the bearer token); `components/ui/button.tsx`, `card.tsx`, `input.tsx`, `label.tsx` (shadcn UI).
- **Packages:** `react` (state); `sonner` (toasts).

## Used by
No module imports this file. It is reached directly as the Next.js route `/ask-cabinet`. The `(dashboard)` route group does not appear in the URL.

## Notes
- The file input only accepts `video/*`, even though the backend also accepts PDFs.
- The backend route hardcodes a Google Gemini API key on line 26 of `server/routes/askCabinet.ts` instead of reading an environment variable. That is a secret in source code, and it is not reproduced here.
- Gemini processing can take tens of seconds, and the page has no cancel or timeout handling.
