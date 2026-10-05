"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { SlashCommand, SlashCommandId } from "@/lib/hooks/useSlashCommands";

interface SlashCommandMenuProps {
  open: boolean;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (id: SlashCommandId) => void;
  onHoverIndex?: (i: number) => void;
  onClose: () => void;
  // Anchor element above which the menu floats — typically the textarea.
  anchorRef: React.RefObject<HTMLElement | null>;
}

// Popover above the textarea while composing a "/" trigger. Each row shows a
// monospace command tag on the left and a plain-text description on the right.
// Keyboard-selected row gets a gold outline + an "Enter" affordance.
export function SlashCommandMenu({
  open,
  commands,
  selectedIndex,
  onSelect,
  onHoverIndex,
  onClose,
  anchorRef,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside-click. Clicks inside the anchor (textarea) are allowed
  // so the user can keep typing without the menu jumping shut.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, onClose, anchorRef]);

  // Keep the selected item scrolled into view as keyboard nav moves it.
  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector<HTMLElement>(
      `[data-slash-index="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  if (!open || commands.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-1.5 z-50 w-[360px] max-h-[340px]
                 overflow-y-auto rounded-md border border-[#2E2E2E] bg-[#0e0e12] shadow-xl"
      role="listbox"
    >
      {/* Header — title + keyboard hint, all on one line */}
      <div className="px-3 py-2 flex items-center gap-3 border-b border-[#2E2E2E] sticky top-0 bg-[#0e0e12] z-10">
        <span className="text-[12px] font-semibold text-white">Slash Commands</span>
        <span className="text-[10px] text-white/40">arrows to navigate</span>
        <span className="text-[10px] text-white/40">enter to select</span>
      </div>

      {/* Command rows */}
      <div className="p-1.5 space-y-0.5">
        {commands.map((cmd, i) => {
          const isActive = i === selectedIndex;
          return (
            <button
              key={cmd.id}
              data-slash-index={i}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onHoverIndex?.(i)}
              onClick={() => onSelect(cmd.id)}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors border",
                isActive
                  ? "border-brand bg-transparent"
                  : "border-transparent hover:bg-white/5"
              )}
            >
              {/* Command tag pill */}
              <span
                className={cn(
                  "shrink-0 px-2 py-0.5 rounded-md font-mono text-[11px] leading-none",
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "bg-black/50 text-white"
                )}
              >
                {cmd.trigger}
              </span>

              {/* Description */}
              <span
                className={cn(
                  "flex-1 truncate text-[12px]",
                  isActive ? "text-white/80" : "text-white/70"
                )}
              >
                {cmd.description}
              </span>

              {/* Enter affordance — only on the highlighted row */}
              {isActive && (
                <span className="shrink-0 text-[10px] font-semibold text-brand">
                  Enter
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
