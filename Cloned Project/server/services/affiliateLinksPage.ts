/**
 * Paging, search and per-category counts for the 1Network Links page
 * (`GET /affiliate/catalog` and `GET /affiliate/offices`).
 *
 * Both routes used to return the whole catalog, and the page rendered every
 * matching card at once — a few hundred cards, each with an image, in one DOM.
 *
 * An honest note on what this does and does not fix: it bounds the RESPONSE and
 * therefore the DOM, not the server's work. Both routes assemble their list by
 * querying six or more heterogeneous collections and merging in JS, so the
 * query cost is the same whether one page or all of it is returned. Pushing the
 * paging down to the database would need a single materialized catalog
 * collection to sort and skip over, which is a different piece of work.
 *
 * Pure, so the ordering, the filter and the counts are testable without a
 * database.
 */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Items per category across the WHOLE list, ignoring `category` and `q` —
   *  these are the tab badges, which count what a tab holds, not what the
   *  current search found in it. */
  counts: Record<string, number>;
}

/**
 * Clamp the query string's page/limit into something safe to slice with, or
 * `null` when the caller asked for neither.
 *
 * Paging is OPT-IN. The mobile app and the desktop app call these same two
 * routes and expect the whole list, so a request without `page`/`limit` still
 * gets everything — only a caller that asks for a page gets one.
 */
export function linksPageParams(query: { page?: unknown; limit?: unknown }):
  | { page: number; limit: number }
  | null {
  if (query.page === undefined && query.limit === undefined) return null;
  return {
    page: Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(String(query.limit ?? "24"), 10) || 24)),
  };
}

export function paginateByCategory<T>(
  all: readonly T[],
  opts: {
    /** Which tab an item belongs to. */
    categoryOf: (item: T) => string;
    /** A stable unique key. The two routes disagree on the field name — the
     *  catalog calls it `itemId`, offices call it `id` — so it is read through
     *  an accessor rather than assumed. */
    keyOf: (item: T) => string;
    nameOf: (item: T) => string;
    category?: string;
    q?: string;
    /** Omit both to return every match on one page (the pre-paging contract). */
    page?: number;
    limit?: number;
  },
): Paged<T> {
  const { categoryOf, keyOf, nameOf } = opts;
  const page = opts.page ?? 1;
  const limit = opts.limit;
  const q = (opts.q ?? "").trim().toLowerCase();

  const counts: Record<string, number> = {};
  for (const it of all) {
    const c = categoryOf(it);
    counts[c] = (counts[c] ?? 0) + 1;
  }

  let matches = opts.category ? all.filter((it) => categoryOf(it) === opts.category) : [...all];
  if (q) matches = matches.filter((it) => (nameOf(it) ?? "").toLowerCase().includes(q));

  // Paging needs a total order. The catalog is assembled by walking one
  // collection after another, and that order is not guaranteed stable between
  // requests, so without this an item could be served on two pages or on none.
  // Name, then key to break ties between items that share a name.
  const ordered = [...matches].sort(
    (a, b) =>
      (nameOf(a) ?? "").localeCompare(nameOf(b) ?? "") || keyOf(a).localeCompare(keyOf(b)),
  );

  return {
    items: limit === undefined ? ordered : ordered.slice((page - 1) * limit, page * limit),
    total: ordered.length,
    page,
    limit: limit ?? ordered.length,
    totalPages: limit === undefined ? 1 : Math.max(1, Math.ceil(ordered.length / limit)),
    counts,
  };
}
