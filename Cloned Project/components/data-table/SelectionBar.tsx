"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { DUR, EASE } from "./motion";

/**
 * The Bigin-style selection toolbar. When one or more rows are selected the
 * table's top bar morphs into this: page-supplied bulk `actions` on the left,
 * then an "N Selected ✕" chip to clear. Render it in place of <TableTopBar>
 * inside the `topBar` prop whenever the selection set is non-empty.
 */
export function SelectionBar({
  count,
  onClear,
  actions,
}: {
  count: number;
  onClear: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE.decel }}
      className="flex flex-none items-center gap-2.5 border-b border-white/[0.06] px-4 py-3"
    >
      {actions}
      <span className="ml-0.5 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.05] py-1.5 pl-3.5 pr-1.5 text-sm text-zinc-200">
        {count} Selected
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="grid h-5 w-5 place-items-center rounded-full text-zinc-400 transition hover:bg-white/[0.1] hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    </motion.div>
  );
}
