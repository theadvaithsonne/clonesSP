"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** 0-5. Fractional values render a partially-filled star. */
  value: number;
  /** Pixel size of each star. */
  size?: number;
  /**
   * `muted` greys the fill. For a rating that is being superseded — the "was
   * 3 stars" half of a before/after — where the accent would compete with the
   * value that's actually being submitted.
   */
  tone?: "accent" | "muted";
  className?: string;
}

/**
 * Read-only star display.
 *
 * A fractional average (4.8) renders the last star partially filled rather
 * than rounding — rounding to 5 would overstate the rating on every card.
 */
export function StarRating({
  value,
  size = 14,
  tone = "accent",
  className,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const fillClass =
    tone === "muted"
      ? "text-[#6a6a7a] fill-[#6a6a7a]"
      : "text-brand fill-brand";

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        // Portion of THIS star that should be filled, 0-1.
        const fill = Math.max(0, Math.min(1, clamped - (star - 1)));

        return (
          <span
            key={star}
            className="relative inline-block shrink-0"
            style={{ width: size, height: size }}
          >
            <Star
              className="absolute inset-0 text-[#4a4a57]"
              style={{ width: size, height: size }}
              strokeWidth={1.5}
            />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={fillClass}
                  style={{ width: size, height: size }}
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  /** Highlighted on hover without committing — set to 0 to clear. */
  hoverValue?: number;
  onHoverChange?: (value: number) => void;
  size?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Interactive star picker for the write-review modal. Keyboard accessible:
 * each star is a real button, so arrow/tab navigation works for free.
 */
export function StarRatingInput({
  value,
  onChange,
  hoverValue = 0,
  onHoverChange,
  size = 26,
  disabled = false,
  className,
}: StarRatingInputProps) {
  const active = hoverValue || value;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      onMouseLeave={() => onHoverChange?.(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => onHoverChange?.(star)}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={value === star}
          className={cn(
            "bg-transparent border-0 p-0 transition-transform",
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:scale-110 active:scale-95"
          )}
        >
          <Star
            style={{ width: size, height: size }}
            strokeWidth={1.5}
            className={cn(
              "transition-colors",
              star <= active
                ? "text-brand fill-brand"
                : "text-[#5a5a67]"
            )}
          />
        </button>
      ))}
    </div>
  );
}
