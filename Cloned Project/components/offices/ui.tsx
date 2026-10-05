"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared pieces of the Offices page (app/select-organization), built from the
 * "Customer -> Discover Office" Figma. Colours are the design's own palette:
 * page #090908, surfaces #121210 / #181713 / #201e18, borders #2b2923 /
 * #3a362c, text #f5f1e7 / #aaa69c / #747169, accent #ffc200.
 */

// ── formatting ────────────────────────────────────────────────────────────

const compact = (v: number) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ""));

/** 12840 -> "12.8k", 950 -> "950". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${compact(n / 1_000_000)}m`;
  if (n >= 1_000) return `${compact(n / 1_000)}k`;
  return String(n);
}

export function membersLabel(count: number | undefined): string | null {
  if (count === undefined || count === null) return null;
  return `${formatCount(count)} ${count === 1 ? "member" : "members"}`;
}

export function initials(name: string | undefined, max = 2): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, max)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Offices created within this many days get the "New" badge. */
const NEW_OFFICE_DAYS = 30;

export function isNewOffice(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  return !Number.isNaN(created) && Date.now() - created < NEW_OFFICE_DAYS * 24 * 60 * 60 * 1000;
}

export function joinedLabel(joinedAt: string | undefined): string | null {
  if (!joinedAt) return null;
  const d = new Date(joinedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

// ── primitives ───────────────────────────────────────────────────────────

/** The warm glow and star specks behind every Offices screen. */
export function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-240px] h-[1000px] w-[1200px] max-w-[140vw] -translate-x-1/2 bg-[radial-gradient(540px_450px_at_50%_500px,rgba(178,118,37,0.12),rgba(110,68,16,0.047)_55%,rgba(9,9,8,0)_100%)]" />
      {SPECKS.map(([x, y, size], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-[#ffc200] opacity-45"
          style={{ left: `${x}%`, top: y, width: size, height: size }}
        />
      ))}
    </div>
  );
}

// [left %, top px, size px] — the design's specks, scaled to any width.
const SPECKS: [number, number, number][] = [
  [6.5, 211, 2], [14.8, 546, 1], [93.7, 293, 2], [82.4, 618, 1],
  [4.8, 950, 1], [95.3, 1151, 2], [12.3, 1488, 1], [89.2, 1690, 1],
  [6.2, 2151, 2], [93.8, 2420, 1], [15.3, 2850, 1], [84.7, 3181, 2],
];

/** "← Offices" above a sub-view's title, back to the Offices home. */
export function BackLink({ onClick, label = "Offices" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[#aaa69c] transition-colors hover:text-[#f5f1e7]"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[12px] font-semibold uppercase tracking-normal text-[#ffc200]", className)}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="text-[24px] font-semibold leading-[1.15] text-[#f5f1e7] sm:text-[28px]">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-[#ffc200] transition-opacity hover:opacity-80"
        >
          {action.label}
          <ArrowRight className="size-[15px]" />
        </button>
      )}
    </div>
  );
}

type PillTone = "accent" | "neutral" | "success";

const PILL_TONES: Record<PillTone, string> = {
  accent: "border-[rgba(229,184,92,0.3)] bg-[rgba(229,184,92,0.1)] text-[#f3cb78]",
  neutral: "border-transparent bg-[#201e18] text-[#aaa69c]",
  success: "border-transparent bg-[rgba(85,201,138,0.1)] text-[#55c98a]",
};

export function Pill({
  tone = "accent",
  children,
  className,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold",
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-[#ffc200] text-black hover:bg-[#ffcd33]",
  secondary: "border-[#3a362c] bg-[#181713] text-[#f5f1e7] hover:bg-[#201e18]",
  ghost: "border-transparent bg-transparent px-2 text-[#f5f1e7] hover:bg-white/[0.04]",
};

export const PillButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function PillButton({ variant = "secondary", className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-[18px] text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
});

/**
 * An office's mark: its uploaded icon when it has one, otherwise its initial
 * on the accent square.
 */
export function OfficeEmblem({
  name,
  icon,
  className,
  textClassName,
  letters = 1,
}: {
  name: string;
  icon?: string;
  className?: string;
  textClassName?: string;
  letters?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cn(
        // Uploaded logos sit on a dark tile: many are transparent PNGs, and
        // Garage's own yellow mark vanishes on the accent colour.
        "flex shrink-0 items-center justify-center overflow-hidden",
        icon ? "bg-[#201e18]" : "bg-[#ffc200]",
        className
      )}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            "size-full object-contain p-[12%] transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : (
        <span className={cn("font-bold leading-none text-black", textClassName)}>
          {initials(name, letters)}
        </span>
      )}
    </div>
  );
}

/** Page numbers with the ends and the neighbours of the current page. */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
      <PillButton variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ArrowLeft className="size-4" />
        Previous
      </PillButton>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span
            key={`gap-${i}`}
            className="flex size-[38px] items-center justify-center rounded-full bg-[#121210] text-[13px] font-semibold text-[#aaa69c]"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex size-[38px] items-center justify-center rounded-full text-[13px] font-semibold transition-colors",
              p === page
                ? "bg-[#ffc200] text-black"
                : "bg-[#121210] text-[#aaa69c] hover:bg-[#201e18] hover:text-[#f5f1e7]"
            )}
          >
            {p}
          </button>
        )
      )}
      <PillButton variant="ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
        <ArrowRight className="size-4" />
      </PillButton>
    </nav>
  );
}
