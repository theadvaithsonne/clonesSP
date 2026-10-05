"use client";

/**
 * FounderUnsubLogPage — the Unsub Log route for every item kind.
 *
 * Mounts the shared `UnsubLogTable`; the parent route pins `itemKind`, so
 * this serves Founder:Communities:UnsubLog, Founder:Live:UnsubLog and
 * Founder:Courses:UnsubLog from one component. (The product variant is wired
 * and functional but has no nav entry today — see layout.tsx.)
 *
 * Data sources and filters are unchanged from the sidebar-and-panel layout
 * this replaced; see `UnsubLogTable` for which endpoint each kind reads.
 */

import { GridPageShell } from "./founderGrid/chrome";
import {
  UnsubLogTable,
  type FounderUnsubLogKind,
} from "./founderGrid/unsubLog/UnsubLogTable";

export type { FounderUnsubLogKind };

interface FounderUnsubLogPageProps {
  itemKind: FounderUnsubLogKind;
  /** "Community" | "Live Stream" | "Course" | "Digital Product" */
  itemLabel: string;
  /** "Communities" | "Live Streams" | … */
  itemLabelPlural: string;
}

export function FounderUnsubLogPage({
  itemKind,
  itemLabel,
  itemLabelPlural,
}: FounderUnsubLogPageProps) {
  return (
    <GridPageShell>
      <UnsubLogTable
        itemKind={itemKind}
        itemLabel={itemLabel}
        itemLabelPlural={itemLabelPlural}
      />
    </GridPageShell>
  );
}
