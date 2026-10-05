"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function CampaignCreateDialog({
  children,
  onClose,
  loading,
}: {
  children: React.ReactNode;
  onClose: () => void;
  loading?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative flex flex-col w-full max-w-2xl h-[80vh] max-h-[80vh] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            Launch a Campaign
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[#7a7a7a] hover:text-white transition-colors" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#7a7a7a]">
              Loading campaign…
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CampaignStepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-white">
        Step {step}: {title}
      </h3>
      <p className="text-sm text-[#7a7a7a] mt-1">{description}</p>
    </div>
  );
}
