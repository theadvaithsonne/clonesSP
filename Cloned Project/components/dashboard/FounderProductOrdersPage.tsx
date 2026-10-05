"use client";

/**
 * FounderProductOrdersPage — the Founder:Products:Orders route.
 *
 * Mounts the shared `FounderOrdersTable` pinned to itemType="product".
 * Shows the org-wide view of every customer's product invoice (not the
 * founder's own orders, which is what the legacy
 * `<OrdersPage initialType="product" />` did).
 */

import { GridPageShell } from "./founderGrid/chrome";
import { FounderOrdersTable } from "./founderGrid/orders/FounderOrdersTable";

export function FounderProductOrdersPage() {
  return (
    <GridPageShell>
      <FounderOrdersTable
        itemType="product"
        itemLabel="Digital Product"
        itemLabelPlural="Digital Products"
      />
    </GridPageShell>
  );
}
