"use client";

export function CampaignStepper({
  returnToReview,
  onReturnToReview,
}: {
  currentStep?: number;
  returnToReview?: boolean;
  onReturnToReview?: () => void;
}) {
  if (!returnToReview || !onReturnToReview) return null;

  return (
    <div className="shrink-0 border-b border-white/10 px-5 sm:px-6 py-3">
      <button
        type="button"
        onClick={onReturnToReview}
        className="text-xs text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_87%,black)] flex items-center gap-1 cursor-pointer"
      >
        ← Return to Review
      </button>
    </div>
  );
}
