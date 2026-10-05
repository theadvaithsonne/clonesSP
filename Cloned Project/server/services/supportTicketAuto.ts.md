# `server/services/supportTicketAuto.ts`

> Auto-create a support ticket from a member's chat message.

**Kind:** backend service · **Lines:** 87

<!-- docgen:auto -->

## Purpose
Auto-create a support ticket from a member's chat message.

Called (fire-and-forget) whenever a message lands in a group. It cheaply
bails for anything that isn't a member writing in their own support chat,
then asks the AI (with the rule-based fallback) whether the conversation
warrants a ticket, and files one if so — marked aiGenerated so the console
can show "Created using AI".

De-duped two ways: one open chat-sourced ticket per group at a time, and an
in-process lock so two fast messages can't both create one.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `maybeAutoCreateTicket` | function | `async maybeAutoCreateTicket(groupId: string, senderUserId: string): Promise<void>` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/socket.ts`
