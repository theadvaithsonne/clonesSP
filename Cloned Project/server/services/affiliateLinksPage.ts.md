# `server/services/affiliateLinksPage.ts`

> Paging, search and per-category counts for the 1Network Links page (`GET /affiliate/catalog` and `GET /affiliate/offices`).

**Kind:** backend service · **Lines:** 98

<!-- docgen:auto -->

## Purpose
Paging, search and per-category counts for the 1Network Links page
(`GET /affiliate/catalog` and `GET /affiliate/offices`).

Both routes used to return the whole catalog, and the page rendered every
matching card at once — a few hundred cards, each with an image, in one DOM.

An honest note on what this does and does not fix: it bounds the RESPONSE and
therefore the DOM, not the server's work. Both routes assemble their list by
querying six or more heterogeneous collections and merging in JS, so the
query cost is the same whether one page or all of it is returned. Pushing the
paging down to the database would need a single materialized catalog
collection to sort and skip over, which is a different piece of work.

Pure, so the ordering, the filter and the counts are testable without a
database.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Paged` | interface | Paging, search and per-category counts for the 1Network Links page (`GET /affiliate/catalog` and `GET /affiliate/offices`). | 19 |
| `linksPageParams` | function | `linksPageParams(query: { page?: unknown; limit?: unknown }): \| { page: number; limit: number } \| null` — Clamp the query string's page/limit into something safe to slice with, or `null` when the caller asked for neither. | 39 |
| `paginateByCategory` | function | `paginateByCategory(all: readonly T[], opts: { /** Which tab an item belongs to. */ categoryOf: (i…): Paged<T>` | 49 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/affiliate.ts`
- `server/services/__tests__/affiliateLinksPage.test.ts`
