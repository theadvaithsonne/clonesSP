"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/** Reusable confirmation modal for destructive actions. Nothing happens until
 *  the user explicitly confirms; while `loading` the buttons + backdrop-close
 *  are disabled so a delete can't be double-fired. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!loading) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[420px] border-[#2E2E2E] bg-[#1F1F1F] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold text-zinc-100">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-[13px] leading-relaxed text-zinc-400">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="mt-3 gap-2 sm:gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
