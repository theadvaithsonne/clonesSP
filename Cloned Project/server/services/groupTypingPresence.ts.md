# `server/services/groupTypingPresence.ts`

> Short-lived, in-memory record of who is typing in which group.

**Kind:** backend service · **Lines:** 41

<!-- docgen:auto -->

## Purpose
Short-lived, in-memory record of who is typing in which group.

The apps show typing over the socket, but the admin support-chats console has
no socket (it polls). The group:typing socket handler records here, and the
console polls GET /garage-admin/support-chats/:groupId/typing to read it.

In-memory on purpose: typing is ephemeral (a few seconds), single pm2 fork,
and losing it on deploy is harmless.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `markTyping` | function | `markTyping(groupId: string, userId: string): void` | 15 |
| `clearTyping` | function | `clearTyping(groupId: string, userId: string): void` | 24 |
| `typingUserIds` | function | `typingUserIds(groupId: string): string[]` — Currently-typing user ids for a group, pruning anything expired. | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/realtime/socket.ts`
- `server/routes/garageAdminSupportChats.ts`
