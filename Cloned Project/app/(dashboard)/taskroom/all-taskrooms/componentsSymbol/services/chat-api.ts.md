# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/services/chat-api.ts`

> Small REST client for the external Garage chat API (`https://uatapi.garage.app/api/chat`) used by the Taskroom chat view to load a conversation, page through its messages and send new ones.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 95

## Purpose
The Taskroom board has a chat tab (`chat-view.tsx`) bound to a conversation that lives in the external UAT API, not in this repo's backend. This module wraps the three calls that view needs and attaches the user's Garage token.

## How it works
- `getToken()` returns `localStorage["garage_tok"]` in the browser (null during SSR).
- `authedFetch(input, init)` adds `Content-Type: application/json` (unless set) and `Authorization: Bearer <token>`, throws `Error("Request failed: <status> <body>")` on a non-2xx response, and returns the parsed JSON.
- `getConversation(id)` - `GET /api/chat/conversations/{id}`, returns `body.data`.
- `getMessages(id, limit = 50, before?)` - `GET /api/chat/conversations/{id}/messages?limit=..&before=..`; returns the whole response (`WireMessage`: `data` array, `pagination.{limit, hasMore}`, `message`, `timestamp`) so the caller can do cursor paging with `before`.
- `sendMessage(id, content, type = "text")` - `POST /api/chat/conversations/{id}/messages` with `{ content, type }` (`"text" | "file" | "image"`), returns `body.data` as a message.

The private `MessagesResponse` type describes a message: `_id`, `organizationId`, `conversationId`, `senderId`, `content`, `type`, `fileUrl`/`fileName`/`fileSize`, `timestamp`, `editedAt`, `isEdited`, `readBy` (`{ userId, readAt }[]`), `replyTo`, `sender` (`{ _id, email, name }`).

## Exports
- `getConversation(conversationId: string)` - fetch conversation metadata.
- `getMessages(conversationId: string, limit?: number, before?: string): Promise<WireMessage>` - fetch a page of messages.
- `sendMessage(conversationId: string, content: string, type?: "text" | "file" | "image")` - post a message.
- `WireMessage` (interface) - paginated messages response.

## Interfaces
- **External services:** Garage UAT chat API at `https://uatapi.garage.app` (hardcoded) - the three endpoints above.
- **Browser storage / cookies:** reads `localStorage` `garage_tok`.

## Dependencies
- **Packages:** `js-cookie` (imported, unused).

## Used by
`componentsSymbol/chat-view.tsx` (imports all three functions under aliased names), which `kanban-board.tsx` renders on `/taskroom/all-taskrooms`.

## Notes
- `authedFetch` logs the raw auth token to the browser console (`console.log("4324234234234", token)`) on every request; that should be removed.
- An older `getMessages` (default limit 10, returning only `data`) is left commented out.
- A near-duplicate client lives in `componentsSymbol/taskroom-chat/lib/chat-api.ts`.
