# `server/utils/plainText.ts`

> Plain-text normalization for user-authored content that is rendered as text, never as markup.

**Kind:** backend utility · **Lines:** 67

<!-- docgen:auto -->

## Purpose
Plain-text normalization for user-authored content that is rendered as text,
never as markup.

Reviews are shown in the community feed, on Discover cards and on public
guest pages. Unlike feed posts (which are deliberately rich HTML), a review
body has no formatting affordance, so the safe move is to reject markup at
the boundary rather than rely on every downstream renderer escaping it.

This is defence in depth, not a substitute for escaping on output.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `toPlainText` | function | `toPlainText(input: string): string` — Strip markup and invisible characters, normalize newlines and whitespace, and trim. | 47 |
| `toPlainSingleLine` | function | `toPlainSingleLine(input: string): string` — Same normalization, but for single-line fields (titles): newlines collapse to spaces rather than paragraph breaks. | 64 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/review.ts`
