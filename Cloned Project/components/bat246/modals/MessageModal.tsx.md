# `components/bat246/modals/MessageModal.tsx`

> Modal with a player picker and message box for emailing a player on the current board; the Send button is not wired to anything.

**Kind:** React component · **Lines:** 79

## Purpose
Opened from the board toolbar's "Email / Message Player" action. It lists every occupied seat on the board so the user can pick a recipient and type a message.

## How it works
- Builds `allPlayers` from `homePlate`, `thirdBase`, `secondBaseA`, `secondBaseB`, all of `firstBase`, `atBat` and `dugout`, dropping empty seats.
- A `<select>` lists each player as `playerName (playerEmail)`, using the email as the option value; a `<textarea>` holds the message. Both are local state (`selected`, `message`).
- "Send Message" is disabled until a player is chosen and the message is non-blank, but it has no `onClick`, so nothing is sent.
- Cancel and the header X call `onClose`.

## Exports
- `MessageModal({ board, onClose }: { board: BoardData; onClose: () => void })` - the modal.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData` and its slot shape (`playerName`, `playerEmail`).
- **Packages:** `react` - `useState`; `lucide-react` - `X`, `Mail` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "message"`.

## Notes
- Stub: no backend call exists for sending. Player emails of everyone on the board are exposed in the dropdown to whoever opens the modal.
- Options use the array index as `key`, and two players without an email would share the empty value.
