# `server/services/__tests__/affiliateLinksPage.test.ts`

> Tests: 10 test cases.

**Kind:** test · **Lines:** 88

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (10)

- **paginateByCategory**
  - filters to one category and orders by name
  - counts every category across the whole list, not the filtered page
  - serves each item on exactly one page
  - pages a shuffled list identically — the sort is what makes paging safe
  - searches by name, case-insensitively, across the whole category
  - an out-of-range page is empty, not a wrapped slice
  - totalPages is 1 when nothing matches, so the UI never shows 'page 1 of 0'
  - survives items with no name
  - paging is opt-in: no page/limit means the whole list, as before
  - clamps page and limit once a caller asks for a page

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/affiliateLinksPage.ts` — `linksPageParams`, `paginateByCategory`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
