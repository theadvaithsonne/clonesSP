"use client";

/**
 * FounderProductCustomersPage — the Founder:Products:Customers route.
 *
 * The same `FounderOrdersTable` the Orders page mounts, opened on its
 * Customers view with the view switcher hidden — this page sits in the nav
 * beside its own Orders entry, so a second route back to Invoices from here
 * would make two nav items lead to the same screen.
 *
 * Parity with the other founder-facing buyer views (Community Members / Live
 * Streams Attendees / Courses Students). Reads the same
 * `/feed/founder/item-users?itemType=product` endpoint.
 */

import { GridPageShell } from "./founderGrid/chrome";
import { FounderOrdersTable } from "./founderGrid/orders/FounderOrdersTable";

export function FounderProductCustomersPage() {
  return (
    <GridPageShell>
      <FounderOrdersTable
        itemType="product"
        itemLabel="Digital Product"
        itemLabelPlural="Digital Products"
        initialView="users"
        hideViewSwitch
      />
    </GridPageShell>
  );
}
