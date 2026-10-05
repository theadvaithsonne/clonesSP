# `app/(dashboard)/cabinet/editor/[documentId]/page.tsx`

> Full-screen page that loads one collaborative Cabinet document from the backend and opens it in the embedded ONLYOFFICE editor.

**Kind:** Next.js page · **Lines:** 213 · **Route:** `/cabinet/editor/[documentId]`

## Purpose
Cabinet is the platform's document store. Word, spreadsheet and presentation documents created through `CreateDocumentDialog` are edited in a self-hosted ONLYOFFICE Document Server. This page is where the user lands after creating or opening such a document: it fetches the document's metadata plus a backend-signed editor configuration, shows a slim header (back button, title, save state, collaborators), and hands everything to `OnlyOfficeEditor`, which mounts the ONLYOFFICE JavaScript editor.

## How it works
- **Client component** (`"use client"`). It reads `documentId` from the route with `useParams()`.
- **Identity and org:** the user's `userId`, `name` and `email` come from the JWT via `getUserDataFromToken()`; the current organisation id is read from `localStorage["garage_org_id"]` (guarded for SSR).
- **Loading:** a `useEffect` calls `loadDocument()` once both `documentId` and `organizationId` are known. `loadDocument` calls `api()` with `GET /cabinet/documents/:documentId?organizationId=...` and the bearer token from `getToken()`, and stores `response.data` as `DocumentInfo`. On failure it stores the error message and shows a `sonner` toast.
- **States:**
  - `loading` - centred spinner "Loading document...".
  - `error` or no document - a "Document Not Found" card with a Go Back button (`router.back()`).
  - Otherwise the editor layout.
  - Note: if `organizationId` is missing from localStorage, the effect never runs and `loading` stays `true`, so the spinner shows forever.
- **Header:** `getDocumentIcon(type)` picks a coloured lucide icon for `word` / `cell` / `slide`. An "Unsaved" badge appears while `isSaved` is false. Up to five collaborator initials appear as avatar bubbles, with a "+N" overflow bubble. "Last saved" shows `updatedAt` from the original fetch formatted as a local time. It is not refreshed while editing.
- **Back:** `handleBack()` asks for `window.confirm` when there are unsaved changes, then calls `router.back()`.
- **Editor:** renders `OnlyOfficeEditor` in `mode="edit"`. It passes the document id, type, title, `fileUrl`, `documentKey`, `callbackUrl`, the backend-signed `token`, the prebuilt `editorConfig` (as `serverConfig`), and the user's identity, falling back to email and then "Anonymous" for the name. `onDocumentStateChange` drives `isSaved`. `onError` shows a toast. `onReady` only writes a console log.

## Exports
- `default DocumentEditorPage()` - the page component. It takes no props and reads the route param itself.

## Interfaces
- **Backend endpoints called:** `GET /backend/cabinet/documents/:documentId?organizationId=<org>` - served by `CollaborativeDocumentController.getDocumentById` (`server/routes/cabinet.ts`, router mounted at `/cabinet`) behind `requireAuth`. The controller only returns a `CollaborativeDocument` in that organisation that the caller created or collaborates on (404 otherwise). It builds the ONLYOFFICE `editorConfig` with a callback URL of `/cabinet/documents/:id/callback` and signs it with `generateOnlyOfficeToken`.
- **External services:** ONLYOFFICE Document Server, reached indirectly through `OnlyOfficeEditor` (`NEXT_PUBLIC_ONLYOFFICE_URL`). The Document Server saves edits by calling the backend callback URL, not this page.
- **Browser storage / cookies:** reads `localStorage["garage_org_id"]`. The auth token comes from `lib/auth`.

## Dependencies
- **Internal:**
  - `components/dashboard/OnlyOfficeEditor.tsx` - the editor and its `DocumentType` (`"word" | "cell" | "slide"`).
  - `components/ui/button.tsx` - the shadcn button.
  - `lib/api.ts` - the `api()` fetch wrapper that prefixes `NEXT_PUBLIC_API_URL`.
  - `lib/auth.ts` - `getToken`, `getUserDataFromToken`.
- **Packages:** `next` (navigation hooks), `react`, `lucide-react` (icons), `sonner` (toasts).

## Used by
No file imports it. It is reached at `/cabinet/editor/<id>`, mainly through `router.push` in `components/dashboard/CreateDocumentDialog.tsx` after a document is created. `app/(dashboard)/layout.tsx` treats paths containing `/cabinet/editor/` as full-bleed routes, so the dashboard does not auto-open popovers over the editor.

## Notes
- `isSaved` reflects only ONLYOFFICE's in-editor state change events. Persistence happens server-side through the ONLYOFFICE callback.
- The local state variable `document` shadows the global `document` inside the component.
