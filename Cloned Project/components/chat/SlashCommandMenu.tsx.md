# `components/chat/SlashCommandMenu.tsx`

> Popover list of available slash commands that floats above a chat composer while the user types a `/` trigger.

**Kind:** React component · **Lines:** 125

## Purpose
The chat pages (DMs, global DMs and group chats) support slash commands such as `/poll`, `/meet`, `/share` and `/taskroom`. The command list, filtering and keyboard selection live in `lib/hooks/useSlashCommands.ts`; this component is only the presentational menu for that hook's state. Choosing a command usually opens `components/chat/SlashCommandForm.tsx`.

## How it works
- Fully controlled: the parent passes `open`, the filtered `commands`, and the keyboard-driven `selectedIndex`. The component never filters or tracks selection itself.
- Renders nothing when `open` is false or the list is empty.
- Positioned `absolute bottom-full left-0` so it sits just above the composer, which must be inside a positioned container. It is 360px wide, scrolls past 340px, and has a sticky header ("Slash Commands", "arrows to navigate", "enter to select").
- Each row shows the command's `trigger` in a monospace pill and its `description`. The active row gets a brand-coloured border and an "Enter" hint.
- Outside-click dismissal: a `mousedown` listener on `document` calls `onClose()` unless the click lands inside the menu or inside `anchorRef` (the textarea), so the user can keep typing.
- When `selectedIndex` changes, the matching row (found via `data-slash-index`) is scrolled into view with `scrollIntoView({ block: "nearest" })`.
- Hovering a row calls `onHoverIndex(i)` so mouse and keyboard selection stay in sync; clicking calls `onSelect(cmd.id)`.
- Uses `role="listbox"` / `role="option"` with `aria-selected` for accessibility.

## Exports
- `SlashCommandMenu(props: SlashCommandMenuProps)` - the menu. Props:
  - `open: boolean` - whether the menu is shown.
  - `commands: SlashCommand[]` - commands to list (already filtered).
  - `selectedIndex: number` - highlighted row.
  - `onSelect(id: SlashCommandId)` - a command was picked.
  - `onHoverIndex?(i: number)` - mouse moved over a row.
  - `onClose()` - dismiss (outside click).
  - `anchorRef: React.RefObject<HTMLElement | null>` - the composer element; clicks inside it do not close the menu.

## Dependencies
- **Internal:** `lib/hooks/useSlashCommands.ts` - `SlashCommand` and `SlashCommandId` types; `lib/utils.ts` - `cn` class merging.
- **Packages:** `react` - `useEffect`, `useRef`.

## Used by
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- Enter/arrow key handling is not here; the host page's textarea `onKeyDown` drives `selectedIndex` through `useSlashCommands`.
