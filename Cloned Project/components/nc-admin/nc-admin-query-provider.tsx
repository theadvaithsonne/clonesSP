"use client";

// Scoped React Query provider for the ported NetworkChains admin section
// (app/garage-admin/(admin-dashboard)/networkchains). Garage doesn't use React
// Query app-wide — see components/downline/downline-query-provider.tsx and
// components/vaults/vaults-query-provider.tsx for the same pattern — and every
// NC admin page is built on useQuery, so the section gets its own QueryClient.

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function NcAdminQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
