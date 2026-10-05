import { cn } from "@/lib/utils";

type Props = {
  /** Tiny uppercase label above the title (e.g. "Coverfi · Module") */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Subtle yellow-tinted icon shown next to the title */
  icon?: React.ReactNode;
  /** Right-aligned action area (button, group, etc.) */
  action?: React.ReactNode;
  /** Optional metadata row shown under the description (badges, counts, etc.) */
  meta?: React.ReactNode;
  /** When true, suppresses the bottom divider — useful when a tab strip follows */
  noDivider?: boolean;
  className?: string;
};

/**
 * Consistent page header used across Coverfi.
 *  - Tight `-0.015em` letter-spacing on the title for a sharp modern feel
 *  - Optional subtle yellow icon chip
 *  - Soft 5% white bottom divider that disappears against a following tab strip
 *  - Action area floats right with proper baseline alignment
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
  meta,
  noDivider = false,
  className,
}: Props) {
  return (
    <header
      className={cn(
        "px-8 pt-7 pb-5",
        !noDivider && "border-b border-white/5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-white/35">
              {eyebrow}
            </div>
          )}
          <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-tight leading-tight">
            {icon && (
              <span className="h-7 w-7 shrink-0 rounded-lg bg-brand/8 border border-brand/20 flex items-center justify-center text-brand">
                {icon}
              </span>
            )}
            <span className="truncate">{title}</span>
          </h1>
          {description && (
            <p className="text-[13px] text-white/45 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
          {meta && <div className="pt-1">{meta}</div>}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </header>
  );
}
