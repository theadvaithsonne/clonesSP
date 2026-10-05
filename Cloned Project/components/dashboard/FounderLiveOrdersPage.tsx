"use client";

/**
 * FounderLiveOrdersPage — the Founder:Live:Orders route.
 *
 * Mounts the shared `FounderOrdersTable` pinned to itemType="workshop".
 * Shows the org-wide view of every customer's live stream invoice (not the
 * founder's own orders, which is what the legacy
 * `<OrdersPage initialType="workshop" />` did).
 */

import { GridPageShell } from "./founderGrid/chrome";
import { FounderOrdersTable } from "./founderGrid/orders/FounderOrdersTable";

export function FounderLiveOrdersPage() {
  return (
    <GridPageShell>
      <FounderOrdersTable
        itemType="workshop"
        itemLabel="Live Stream"
        itemLabelPlural="Live Streams"
      />
    </GridPageShell>
  );
}
