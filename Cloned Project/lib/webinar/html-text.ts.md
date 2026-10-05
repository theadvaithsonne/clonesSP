# `lib/webinar/html-text.ts`

> Seller-authored product descriptions come out of a rich-text editor, so `description` is an HTML fragment (`<ul><li><b>…</b></li></ul>`), not plain text.

**Kind:** frontend library · **Lines:** 96

<!-- docgen:auto -->

## Purpose
Seller-authored product descriptions come out of a rich-text editor, so
`description` is an HTML fragment (`<ul><li><b>…</b></li></ul>`), not plain
text. Rendering it as a React child prints the tags verbatim; rendering it
with dangerouslySetInnerHTML would inject untrusted seller markup into the
webinar page. Neither is acceptable for a one- or two-line card snippet, so
we flatten it to text instead.

Block-level tags become a space so `<li>A</li><li>B</li>` reads "A B"
rather than "AB".

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `htmlToPlainText` | function | `htmlToPlainText(html?: string \| null): string` — Flatten an HTML fragment to a single line of plain text. | 42 |
| `htmlToPlainLines` | function | `htmlToPlainLines(html?: string \| null): string` — Same flattening, but block tags become NEWLINES instead of spaces. | 71 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/webinar/PinnedProductCard.tsx`
- `components/webinar/ProductPickerDialog.tsx`
- `components/webinar/ShopPanel.tsx`
- `components/webinar/WebinarPreJoin.tsx`
