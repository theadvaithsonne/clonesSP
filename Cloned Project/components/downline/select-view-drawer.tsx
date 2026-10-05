"use client";

// The "Select View" right-side drawer — opened by the "As A Shopper" (role) and
// "Digital/Physical" (product type) switcher pills on the one-time-affiliate
// profile page. Both use this same panel with a different option set.
// `{name}` in a description is replaced with the member's name.
// Ported verbatim from NetworkChains' components/downline/select-view-drawer.tsx.

import { useEffect } from "react";
import { X, Search, Check } from "lucide-react";

type IconCmp = React.ComponentType<{ className?: string }>;

export type ViewOption = {
  id: string;
  title: string;
  description: string; // may contain {name}
  icon: IconCmp;
  disabled?: boolean; // shown but not yet selectable (e.g. Affiliate/Founder)
};

export function SelectViewDrawer({
  open,
  options,
  selectedId,
  memberName,
  onSelect,
  onClose,
}: {
  open: boolean;
  options: ViewOption[];
  selectedId: string;
  memberName?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0e0e12] shadow-2xl">
        {/* Header: close · title · search */}
        <div className="flex items-center gap-3 px-6 py-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.12] text-zinc-300 transition hover:bg-white/[0.05]"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="flex-1 text-center text-lg font-semibold text-white">Select View</h3>
          <button
            type="button"
            aria-label="Search"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.12] text-zinc-300 transition hover:bg-white/[0.05]"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Options — one rounded panel, hairline dividers between rows. */}
        <div className="px-5">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {options.map((o, i) => {
              const sel = o.id === selectedId;
              const Icon = o.icon;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    if (!o.disabled) {
                      onSelect(o.id);
                      onClose();
                    }
                  }}
                  className={`flex w-full items-center gap-4 px-4 py-4 text-left transition ${
                    i > 0 ? "border-t border-white/[0.06]" : ""
                  } ${sel ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"} ${
                    o.disabled ? "cursor-not-allowed opacity-45" : ""
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0 text-zinc-200" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
                      {o.title}
                      {o.disabled && (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                          Soon
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-zinc-400">
                      {o.description.replace("{name}", memberName || "this member")}
                    </div>
                  </div>
                  {sel && <Check className="h-5 w-5 shrink-0 text-brand" />}
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
