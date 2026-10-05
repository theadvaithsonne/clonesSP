# `lib/hooks/useSlashCardSync.ts`

> Client hook that attaches one shared set of Socket.IO listeners for server-side slash-card updates (approvals, deals, tasks) and pipes them into the `slashState` store.

**Kind:** React hook · **Lines:** 74

## Purpose
Chat messages can render interactive "slash cards" (approval requests, CRM deals, tasks) whose live state lives in the module store `lib/slash-state.ts`. Rather than having each card open its own socket subscription, every chat page calls this hook once, and the cards read state through `useSyncExternalStore`-based selectors in `slash-state`.

## How it works
- Module-level `refCount` and `attached` flags make the subscription global: the first mounted caller runs `attach()`, the last unmounting caller runs `detach()`. Mounting on DM, global-DM and group pages at the same time still registers exactly one listener per event.
- `attach()` gets the socket singleton with `getSocket()` (it does not connect it) and registers three handlers:
  - `slash:approval-decided` `{ approvalId, userId, decision, overallStatus? }` -> `slashState.applyApprovalDecision(...)`.
  - `slash:deal-updated` `{ dealId, stage }` -> `slashState.setDealStage(dealId, stage)`.
  - `slash:task-updated` `{ taskId, stageId }` -> `slashState.setTaskStage(taskId, stageId)`.
- Each handler ignores payloads missing their required ids.

## Exports
- `useSlashCardSync()` - mount-only effect; returns nothing.

## Interfaces
- **Socket.IO events:** listens for `slash:approval-decided` (emitted to `org:<orgId>` by `server/routes/slashApprovals.ts`, mounted at `/slash/approvals`), `slash:deal-updated` (emitted to `org:<orgId>` by `server/routes/slashDeals.ts`, mounted at `/slash/deals`) and `slash:task-updated`. Emits nothing.

## Dependencies
- **Internal:** `lib/socket.ts` - `getSocket()` singleton; `lib/slash-state.ts` - `slashState` store and `ApprovalDecision` type; `lib/chat-markers.ts` - `DealStage` type.
- **Packages:** `react` - `useEffect`.

## Used by
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- No server code in this repo emits `slash:task-updated`; that listener is currently inert.
- The related `/task`, `/deal` and `/approve` slash commands are commented out in `lib/hooks/useSlashCommands.ts`, so these cards only appear for messages created earlier or by other clients.
- If `getSocket()` ever returned a new socket instance (e.g. after a reconnect that recreates the singleton), the listeners on the old instance would not move over until all callers unmount and remount.
