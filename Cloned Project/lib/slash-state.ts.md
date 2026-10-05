# `lib/slash-state.ts`

> Client-side, localStorage-backed store (read through `useSyncExternalStore`) that holds the runtime state of chat slash-command cards: poll votes, RSVPs, approval decisions, deal stages, and task stage and assignee overrides.

**Kind:** frontend library · **Lines:** 253

## Purpose
Chat messages can carry "slash cards" (polls, events, approvals, deals, tasks) whose payload is embedded in the message marker when it is sent (see `lib/chat-markers.ts`). After that the card's live state has to come from somewhere other than the marker. This module is that place. It is a tiny module-level store with React hooks, built the same way as `lib/messageExtras.ts` (localStorage plus `useSyncExternalStore`), so reads return stable snapshots and the backend is never called on render.

## How it works
- **Two kinds of state** (from the header comment):
  1. *Per-user only* (`pollVotes`, `rsvps`). Only this browser knows about them. Other clients never see them.
  2. *Cross-user* (`approvalStatuses`, `approvalOverall`, `dealStages`, `taskStages`, `taskAssignees`). The card first renders the snapshot from send time. Values written here override that snapshot as socket events arrive. `lib/hooks/useSlashCardSync.ts` writes them when it receives `slash:approval-decided`, `slash:deal-updated` and `slash:task-updated`. Cards always prefer slash-state over the marker payload, so every visible card re-renders without polling.
- **Persistence:** the whole `State` object is stored as JSON under the localStorage key `garage_slash_state_v1`. `load()` runs once at module init. It is SSR-safe: on the server it returns an empty state. Each sub-map falls back to `{}`, and any parse error resets to empty. `persist()` writes after every mutation and swallows quota and privacy errors.
- **Cross-tab sync:** a `storage` event listener reloads the state and notifies subscribers when another tab changes the same key.
- **Immutability:** every setter builds a new top-level `state` object and new sub-maps, then calls `emit()`. Snapshot identity therefore changes only when data changes. The frozen constants `EMPTY_VOTE` and `EMPTY_STATUS_MAP` are returned for missing entries so that `useSyncExternalStore` does not loop on fresh `[]` or `{}` values.
- **Business rules:**
  - `togglePollVote(pollId, optionId, multi)`: in multi-select mode it adds or removes the option. In single-select mode, clicking the current choice clears it and clicking any other option replaces it. An empty vote list deletes the key.
  - `setRsvp(eventId, "pending")` deletes the entry. `getRsvp` defaults to `"pending"`.
  - `applyApprovalDecision(approvalId, userId, decision, overall?)` merges one approver's decision into the per-approval map. It updates the overall result only when `overall` is passed. It is called both on the socket echo and right after the local POST succeeds, so the card flips instantly.
  - `setTaskAssignee` stores `{ id, name? }` so the card can show the new assignee's name without fetching members again.

## Exports
- `slashState` - the store object: `subscribe(listener)`, `getPollVote` / `togglePollVote`, `getRsvp` / `setRsvp`, `getApprovalStatuses` / `getApprovalOverall` / `applyApprovalDecision`, `getDealStage` / `setDealStage`, `getTaskStage` / `setTaskStage`, `getTaskAssignee` / `setTaskAssignee`.
- `usePollVote(pollId): string[]` - selected option IDs. Returns an empty array on the server.
- `useRsvp(eventId): Rsvp` - defaults to `"pending"`.
- `useApprovalStatuses(approvalId): ApprovalStatusMap` - userId to decision.
- `useApprovalOverall(approvalId): ApprovalDecision | undefined`
- `useDealStage(dealId): DealStage | undefined`
- `useTaskStage(taskId): string | undefined` - Taskroom stage ID.
- `useTaskAssignee(taskId): TaskAssigneeOverride | undefined`
- Types: `Rsvp` (`"accepted" | "declined" | "pending"`), `ApprovalDecision` (`"pending" | "approved" | "rejected"`), `ApprovalStatusMap` (`Record<string, ApprovalDecision>`), `TaskAssigneeOverride` (`{ id: string; name?: string }`).

## Interfaces
- **Browser storage / cookies:** localStorage key `garage_slash_state_v1`. It listens for `window` `storage` events on that key.
- **Socket.IO events:** none directly. Its writers in `useSlashCardSync` react to `slash:approval-decided`, `slash:deal-updated` and `slash:task-updated`.

## Dependencies
- **Internal:** `lib/chat-markers.ts` - `DealStage` type (`"lead" | "qualified" | "proposal" | "won" | "lost"`).
- **Packages:** `react` - `useSyncExternalStore`.

## Used by
- `components/chat/SlashCommandCards.tsx` - renders the cards and calls the setters on user action.
- `lib/hooks/useSlashCardSync.ts` - applies socket-driven updates.

## Notes
- The file is marked `"use client"`. The module-level `state` is evaluated at import time, so it should only be imported from client code.
- The state is never pruned, so entries for old polls, deals and tasks pile up in localStorage indefinitely.
- Per-user poll votes and RSVPs are only local. Clearing site data loses them, and they are not sent anywhere from this file.
