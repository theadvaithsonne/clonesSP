"use client";

/**
 * FounderCourseOrdersPage — the Founder:Courses:Orders route.
 *
 * Mounts the shared `FounderOrdersTable` pinned to itemType="course". Shows
 * the org-wide view of every customer's course invoice (not the founder's
 * own orders, which is what the legacy
 * `<OrdersPage initialType="course" />` did).
 */

import { GridPageShell } from "./founderGrid/chrome";
import { FounderOrdersTable } from "./founderGrid/orders/FounderOrdersTable";

export function FounderCourseOrdersPage() {
  return (
    <GridPageShell>
      <FounderOrdersTable
        itemType="course"
        itemLabel="Course"
        itemLabelPlural="Courses"
      />
    </GridPageShell>
  );
}
