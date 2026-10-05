import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value (search inputs). Replaces the
 * useState+useEffect(setTimeout) pattern that was re-implemented across the
 * EarnGPT product grid, product-browser dialog, and contact picker with
 * drifting delays (200 vs 250ms) — 250ms is now the one canonical default.
 *
 * Note: page-reset side-effects (e.g. `setPage(1)` on a new term) stay in the
 * caller — run a `useEffect(..., [debounced])` next to the call site.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
