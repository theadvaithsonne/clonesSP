"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

type CmsPasswordDialogProps = {
  open: boolean;
  error?: string;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void;
};

export function CmsPasswordDialog({
  open,
  error,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: CmsPasswordDialogProps) {
  const [password, setPassword] = useState("");

  const handleClose = () => {
    setPassword("");
    onOpenChange(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(password);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-[20px] border p-0 sm:max-w-[420px] [&>button]:hidden"
        style={{
          background: "#0f0f0f",
          borderColor: FIGMA.infoBorder,
          boxShadow: "2px 2px 2px black",
        }}
      >
        <div
          className="flex items-center justify-between border-b p-5"
          style={{ borderColor: FIGMA.infoBorder, background: "#0f0f0f" }}
        >
          <DialogTitle className="text-[15px] font-bold text-white">
            CMS Access
          </DialogTitle>
          <button
            type="button"
            aria-label="Close"
            className="flex size-5 cursor-pointer items-center justify-center text-[#9a9a9a] transition-colors hover:text-white"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <p className="text-[13px] leading-relaxed" style={{ color: FIGMA.textSecondary }}>
            Enter the CMS password to open Landing Pages.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: FIGMA.textSecondary }}>
              Password
            </label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="h-9 rounded-lg border px-2.5 text-[13px] shadow-none focus-visible:ring-0"
              style={{
                background: "#1e1e1e",
                borderColor: FIGMA.border,
                color: FIGMA.textPrimary,
              }}
            />
            {error ? (
              <p className="text-[12px]" style={{ color: FIGMA.red }}>
                {error}
              </p>
            ) : null}
          </div>

          <div
            className="flex items-center justify-between border-t px-0 pt-4"
            style={{ borderColor: FIGMA.infoBorder }}
          >
            <button
              type="button"
              className="cursor-pointer text-[14px] font-semibold transition-colors hover:text-white disabled:opacity-50"
              style={{ color: FIGMA.textMuted }}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="h-auto cursor-pointer rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90"
              style={{ background: FIGMA.accent, color: "#0f0f0f" }}
            >
              {isSubmitting ? "Checking..." : "Unlock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
