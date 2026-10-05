"use client";

/**
 * FounderCommunityOrdersPage — the Founder:Communities:Orders route.
 *
 * Mounts the shared `FounderOrdersTable` pinned to itemType="channel".
 * Data source is unchanged: `/feed/founder/invoices?itemType=channel` and
 * `/feed/founder/item-users?itemType=channel`.
 */

import { GridPageShell } from "./founderGrid/chrome";
import { FounderOrdersTable } from "./founderGrid/orders/FounderOrdersTable";

export function FounderCommunityOrdersPage() {
  return (
    <GridPageShell>
      <FounderOrdersTable
        itemType="channel"
        itemLabel="Community"
        itemLabelPlural="Communities"
      />
    </GridPageShell>
  );
}
