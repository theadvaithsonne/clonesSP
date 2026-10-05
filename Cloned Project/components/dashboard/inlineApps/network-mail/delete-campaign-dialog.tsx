"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DeleteCampaignDialogProps {
  open: boolean;
  campaignName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCampaignDialog({
  open,
  campaignName,
  onClose,
  onConfirm,
}: DeleteCampaignDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
      {/* Glassmorphic backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Dialog container */}
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden transform transition-all duration-300 scale-100 flex flex-col gap-4">
        {/* Warning accent top stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-rose-600 to-red-700" />

        <div className="flex gap-4 items-start mt-2">
          {/* Warning Icon Container */}
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-medium text-white tracking-wide">
              Delete campaign?
            </h3>
            <p className="text-sm text-[#98989f] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">“{campaignName}”</span>? All recipients list, metrics, and associated data will be permanently removed.
            </p>
          </div>
        </div>

        {/* Warning label */}
        <div className="p-3 bg-[#1e1a1c] border border-red-500/10 rounded-xl flex items-center gap-2 text-xs text-rose-400/90 font-medium select-none">
          <Trash2 className="h-4 w-4 shrink-0" />
          This action is permanent and cannot be undone.
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl border border-white/10 text-sm text-[#a8a8a8] hover:text-white hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer font-medium active:scale-95 select-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-semibold shadow-lg shadow-red-950/20 hover:shadow-red-500/10 transition-all cursor-pointer active:scale-95 flex items-center gap-2 select-none"
          >
            <Trash2 className="h-4 w-4" />
            Delete Campaign
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
