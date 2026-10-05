import type { ReactNode } from "react";
import { NcAdminQueryProvider } from "@/components/nc-admin/nc-admin-query-provider";
import { NcAdminGate } from "@/components/nc-admin/nc-admin-gate";

export default function NetworkChainsAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <NcAdminQueryProvider>
      <NcAdminGate>{children}</NcAdminGate>
    </NcAdminQueryProvider>
  );
}
