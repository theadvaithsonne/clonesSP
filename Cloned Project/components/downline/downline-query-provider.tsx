"use client";

// Scoped React Query provider for the ported one-time-affiliate profile page
// (app/garage-admin/(admin-dashboard)/one-time-affiliates/[userId]). Garage
// doesn't use React Query app-wide (see components/vaults/vaults-query-provider.tsx
// for the same pattern used by the Vaults feature), and the ported NC profile
// page is built on useQuery, so it gets its own QueryClient rather than
// requiring a global provider.

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function DownlineQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
