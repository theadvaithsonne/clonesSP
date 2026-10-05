"use client";

export function UnsavedChangesDialog({
  open,
  onClose,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl mx-4"
      >
        <h3
          id="unsaved-changes-title"
          className="text-[16px] font-semibold text-white tracking-tight"
        >
          Unsaved changes
        </h3>
        <p className="text-[13px] text-[#7a7a7a] mt-2 leading-relaxed">
          You have changes that haven&apos;t been saved. If you leave now, your
          changes will be lost.
        </p>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onLeave}
            className="h-10 px-5 rounded-lg border border-white/10 text-[13px] text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
          >
            Leave without saving
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.97] transition-all cursor-pointer"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
