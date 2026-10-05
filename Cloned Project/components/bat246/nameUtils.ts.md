# `components/bat246/nameUtils.ts`

> Two tiny string helpers that shorten a BAT246 player's full name for display on the board.

**Kind:** Utility module (listed as React component) · **Lines:** 12

## Purpose
BAT246 boards deliberately show players by a shortened name rather than their full legal name. This module centralises the two shortening rules so every card component formats names the same way.

## How it works
- `firstName` trims the input, splits on runs of whitespace and returns the first word. A `null`, `undefined`, empty or whitespace-only name returns `""`.
- `firstNameInitial` splits the trimmed name into non-empty words. With no words it returns `""`; with one word it returns that word; with two or more it returns the first word plus the upper-cased first letter of the **last** word and a full stop (`"Alan Kippax"` -> `"Alan K."`). Middle names are ignored.

Callers usually add their own fallback, e.g. `firstName(slot.playerName) || "—"`.

## Exports
- `firstName(name?: string | null): string` - first word of the name ("Alan Kippax" -> "Alan").
- `firstNameInitial(name?: string | null): string` - first name plus last-name initial ("Alan Kippax" -> "Alan K.").

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `components/bat246/BaseCard.tsx`, `components/bat246/BoardLayout.tsx`, `components/bat246/HomePlateCard.tsx` - use `firstName` for the name line on desktop board cards.
- `components/bat246/BoardMobileSections.tsx` - uses `firstNameInitial` in the mobile board layout (where a POD slot shows `podTeamId` instead of a name when set).
