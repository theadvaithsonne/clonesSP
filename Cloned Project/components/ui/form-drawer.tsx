"use client";

import { X, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DrawerPortal } from "@/components/shared/drawer-portal";
import { cn } from "@/lib/utils";

/**
 * The one shared "form drawer" shell for NetworkChains (design #127). A right-
 * side glass panel that springs in/out with a dimming backdrop. Header carries a
 * bordered ✕ (left), a centered title, and — when `onSubmit` is given — a gold ✓
 * submit (right). Provide `footer` for wizard nav / multi-button forms instead.
 *
 * Controlled via `open` + `onOpenChange` (mirrors the Radix Dialog API these
 * forms used before, so the callers barely change). Keep the component MOUNTED
 * and toggle `open` so the exit animation can play.
 *
 * z-index note: the panel sits at z-[61]. Any Select / Popover / Combobox
 * rendered INSIDE must portal ABOVE it — give its content `z-[70]` (or higher).
 */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  onSubmit,
  submitting = false,
  canSubmit = true,
  submitLabel,
  headerRight,
  footer,
  widthClass = "max-w-[440px]",
  closeDisabled = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** When set, renders the gold ✓ header submit. Omit and use `footer` for
   *  multi-button / wizard forms. */
  onSubmit?: () => void;
  submitting?: boolean;
  canSubmit?: boolean;
  submitLabel?: string;
  /** Custom right-header slot (overrides the ✓). */
  headerRight?: React.ReactNode;
  /** Sticky footer (e.g. Cancel / Next / Save buttons). */
  footer?: React.ReactNode;
  /** Panel width utility, e.g. "max-w-[440px]" (default) or "max-w-[600px]". */
  widthClass?: string;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  const close = () => {
    if (!closeDisabled && !submitting) onOpenChange(false);
  };

  return (
    <DrawerPortal>
    <AnimatePresence>
      {open && (
        <motion.div
          key="form-drawer"
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          initial={false}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          {/* Panel */}
          <motion.aside
            className={cn(
              "absolute right-0 top-0 z-[61] flex h-full w-full flex-col border-l border-white/[0.06] bg-[#0e0e0e] shadow-[-24px_0_80px_-24px_rgba(0,0,0,0.85)]",
              widthClass,
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 42 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 px-5 pt-6 pb-3">
              <button
                type="button"
                onClick={close}
                disabled={submitting || closeDisabled}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-white/70 transition-colors hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <h2 className="truncate text-[17px] font-semibold text-white">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>}
              </div>
              {onSubmit ? (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit || submitting}
                  aria-label={submitLabel ?? "Save"}
                  title={submitLabel}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
              ) : (
                headerRight ?? <span className="h-10 w-10 shrink-0" />
              )}
            </div>

            {/* Body */}
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-6">{children}</div>

            {/* Optional sticky footer */}
            {footer && (
              <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">{footer}</div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
    </DrawerPortal>
  );
}

/**
 * The glass "card" the drawer's fields sit in (matches the Schedule drawer). Wrap
 * field groups in this for the consistent look.
 */
export function FormDrawerCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
