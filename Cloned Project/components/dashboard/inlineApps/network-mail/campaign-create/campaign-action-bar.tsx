"use client";

export function CampaignActionBar({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-t border-white/10 bg-[#111111] px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

export function ActionButton({
  variant = "secondary",
  disabled,
  onClick,
  children,
  className = "",
}: {
  variant?: "primary" | "secondary" | "danger-outline";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    "h-9 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed whitespace-nowrap";
  const variants = {
    primary: disabled
      ? "bg-white/10 text-[#7a7a7a]"
      : "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.98]",
    secondary:
      "border border-white/10 text-[#a8a8a8] hover:bg-white/5 hover:text-white disabled:opacity-50",
    "danger-outline": "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
