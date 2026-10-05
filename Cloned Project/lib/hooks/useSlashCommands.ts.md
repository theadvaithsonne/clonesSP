# `lib/hooks/useSlashCommands.ts`

> UI-agnostic slash-command engine for chat composers: detects a `/` trigger in the textarea, filters a command list, handles keyboard navigation and tracks which command form is open.

**Kind:** React hook · **Lines:** 262

## Purpose
DMs, global DMs and group chats all support typing `/` to pick a rich action (poll, meeting, product share, Taskroom task). This hook holds the shared logic so each page only renders the menu (`components/chat/SlashCommandMenu.tsx`) and form (`components/chat/SlashCommandForm.tsx`) and wires the textarea to it. It keeps no per-page state and does not touch the text itself.

## How it works
- **Command catalogue (`COMMANDS`):** active entries are `/poll` (Create Poll), `/meet` (Schedule Meeting - "Book a conference room"), `/share` (Share Product - course/webinar/product, `orgOnly`) and `/taskroom` (add a task to the linked board, `orgOnly`). `/task`, `/deal`, `/approve` and `/doc` are commented out (marked "BackOffice"), both in the list and in the `SlashCommandId` union; their icons are still imported.
- **Availability:** in `global-dm` chats (no shared org) every `orgOnly` command is removed. `/taskroom` survives only when `chatType === "group"` and `taskroomEnabled` is true.
- **Trigger detection:** `TRIGGER_RE = /(?:^|\n)\/(\w*)$/` matches a slash at the start of the text or right after a newline, followed by word characters up to the caret-end of the string. `handleInputChange(text)` opens the menu with the captured partial as `query` and resets `selectedIndex` to 0; with no match it closes the menu and clears the dismissal marker.
- **Dismissal:** `dismissedTriggerRef` is compared against the full text so the menu is not reopened for an already dismissed trigger. Note that nothing in this file ever assigns it a non-null value (Escape only closes the menu), so in practice the next keystroke that still matches reopens the menu.
- **Filtering:** case-insensitive match on command id, label, or trigger prefix.
- **Keyboard (`handleKeyDown`)**, active only while the menu is open: Escape closes; ArrowDown/ArrowUp cycle `selectedIndex` with wrap-around; Enter or Tab selects the highlighted command. Returns `true` when the key was consumed so the page can skip its own send-on-Enter.
- **Selection (`selectCommand(id)`):** ignores ids not currently available, closes the menu, sets `activeCommand` (the form to render) and calls `onClearTrigger` so the page can strip `/xyz` from the textarea. `closeForm()` resets `activeCommand`; `closeMenu()` hides the menu.

## Exports
- `useSlashCommands({ chatType, onClearTrigger?, taskroomEnabled? = false }): UseSlashCommandsReturn` - the engine.
- `type ChatType` - `"dm" | "global-dm" | "group"`.
- `type SlashCommandId` - `"poll" | "meet" | "share" | "taskroom"`.
- `interface SlashCommand` - `{ id, trigger, label, description, icon: LucideIcon, orgOnly }`.
- `interface UseSlashCommandsReturn` - `{ menuOpen, query, filteredCommands, selectedIndex, activeCommand, handleInputChange, handleKeyDown, selectCommand, closeMenu, closeForm }`.
- `SLASH_COMMANDS` - re-export of the full `COMMANDS` array (unfiltered).

## Dependencies
- **Packages:** `react` - `useState`, `useMemo`, `useCallback`, `useRef`; `lucide-react` - command icons (`BarChart3`, `Calendar`, `ShoppingBag`, `ListChecks`, plus unused `CheckSquare`, `TrendingUp`, `ShieldCheck`, `FileText`).

## Used by
- `components/chat/SlashCommandForm.tsx`
- `components/chat/SlashCommandMenu.tsx`
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- The file is pure client logic: no network calls. What each command actually does (create poll, book a room, share a product, call Taskroom) lives in the form components.
- `SLASH_COMMANDS` includes `/taskroom` and the `orgOnly` entries regardless of chat type; consumers that need the filtered set should use `filteredCommands`.
