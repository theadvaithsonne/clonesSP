"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { DUR, EASE } from "./motion";

/** One active filter criterion, rendered as a removable chip above the table.
 *  This is the Bigin trick that keeps always-on filters (a date range, a status)
 *  visible without a bespoke inline widget — set them in the drawer/Views, see
 *  and clear them here. */
export interface FilterChip {
  id: string;
  /** e.g. "Status: Active" or "Joined: Last 30 days". */
  label: string;
  onClear: () => void;
}

/** Shared applied-filter chip bar. Renders nothing when empty, so pages can pass
 *  it unconditionally. Compose it right under <TableTopBar> inside the `topBar`
 *  prop so it sits between the bar and the grid. */
export function AppliedFilterChips({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll?: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: DUR.base, ease: EASE.decel }}
          className="flex flex-none flex-wrap items-center gap-2 overflow-hidden border-b border-white/[0.05] px-4 pb-3"
        >
          {chips.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/[0.08] py-1 pl-3 pr-1.5 text-[12px] text-zinc-200"
            >
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                onClick={c.onClear}
                aria-label={`Remove ${c.label}`}
                className="grid h-4 w-4 place-items-center rounded-full text-zinc-400 transition hover:bg-white/[0.1] hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {chips.length > 1 && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="ml-1 text-[12px] text-zinc-500 transition hover:text-white"
            >
              Clear all
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
