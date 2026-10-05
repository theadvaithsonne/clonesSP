# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/chat-api.ts`

> Module exporting `chatAPI`, `chatAPI`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 139

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `chatAPI` | const | `= new ChatAPI()` | 136 |
| `default (chatAPI)` | default |  | 137 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app/api/chat/conversations/${conversationId}` (L35)
  - `POST uatapi.garage.app/api/chat/conversations/${conversationId}/messages` (L66)
  - `PUT uatapi.garage.app/api/chat/conversations/${conversationId}/messages/${messageId}` (L85)
  - `DELETE uatapi.garage.app/api/chat/conversations/${conversationId}/messages/${messageId}` (L100)
  - `POST uatapi.garage.app/api/chat/conversations/${conversationId}/messages/${messageId}/read` (L111)
  - `GET uatapi.garage.app/api/chat/users` (L122)
- **Browser storage / cookies:** `auth-token` (localStorage: get), `auth-token` (cookie: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `ApiResponse`, `Conversation`, `Message`, `PaginatedResponse`, `SendMessageRequest`, `User`
- **Packages:**
  - `js-cookie`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatHeader.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useMessages.ts`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/taskroom-group-chat.tsx`
