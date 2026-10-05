import type { ColumnDef } from "./types";

/**
 * Apply the table's column filters to a row set.
 *
 * Lives outside DataTable because the pages paginate before handing rows
 * over: filtering inside the component would only ever search the page you
 * were looking at, which reads as "the filter is broken" the moment a match
 * sits on page 2. Call this on the FULL dataset, then paginate the result.
 *
 * Matching is case-insensitive "contains", and every active filter must match
 * (AND). A filter on a column with no `filterAccessor` is ignored rather than
 * matching nothing — that combination is a wiring mistake, and silently
 * emptying the table would hide it.
 */
export function applyColumnFilters<T>(
  rows: T[],
  columns: ColumnDef<T>[],
  filters: Record<string, string>,
): T[] {
  const active = Object.entries(filters)
    .map(([id, q]) => [id, q.trim().toLowerCase()] as const)
    .filter(([, q]) => q.length > 0);

  if (active.length === 0) return rows;

  const byId = new Map(columns.map((c) => [c.id, c]));

  return rows.filter((row) =>
    active.every(([id, q]) => {
      const accessor = byId.get(id)?.filterAccessor;
      if (!accessor) return true;
      const value = accessor(row);
      if (value == null) return false;
      return String(value).toLowerCase().includes(q);
    }),
  );
}

/** How many filters are actually doing something — drives the "Clear" chip. */
export function activeFilterCount(filters: Record<string, string>): number {
  return Object.values(filters).filter((v) => v.trim().length > 0).length;
}
