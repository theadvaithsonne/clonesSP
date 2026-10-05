"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function DiscardDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[710] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-xl p-6 shadow-2xl mx-4">
        <h3 className="text-base font-semibold text-white">Discard this campaign?</h3>
        <p className="text-sm text-[#7a7a7a] mt-2">Your progress will not be saved.</p>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-white/10 text-sm text-[#a8a8a8] hover:bg-white/5 cursor-pointer"
          >
            No
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 cursor-pointer"
          >
            Yes, discard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
