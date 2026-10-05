"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Shared "active-page" search for the garage-admin dashboard. The one header
 * search box (layout header) writes `query`; whichever list page is currently
 * open reads it via {@link useAdminSearch} and passes it to its own backend
 * fetch, so the header filters the active tab's table. Resets on tab change so a
 * search never bleeds from one tab to the next.
 */
interface AdminSearchCtx {
  query: string;
  setQuery: (q: string) => void;
}

const AdminSearchContext = createContext<AdminSearchCtx | null>(null);

export function AdminSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  // Each tab owns its own search — clear when the route changes.
  useEffect(() => {
    setQuery("");
  }, [pathname]);
  return (
    <AdminSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </AdminSearchContext.Provider>
  );
}

/** Read the shared header search. Safe no-op default when used outside the
 *  provider (so a page never crashes if rendered standalone). */
export function useAdminSearch(): AdminSearchCtx {
  return useContext(AdminSearchContext) ?? { query: "", setQuery: () => {} };
}
