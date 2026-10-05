"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import {
  Bitcoin,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChartLine,
  ChevronDown,
  Clapperboard,
  Cpu,
  GraduationCap,
  HeartHandshake,
  Landmark,
  LayoutGrid,
  type LucideIcon,
  Megaphone,
  Palette,
  PenLine,
  Rocket,
  Shirt,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Tag,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DiscoverCategory } from "@/lib/discover-api";
import { ChipRowSkeleton, SkeletonBar } from "./OfficesSkeletons";

/*
 * Categories are whatever the backend returns — free text set per office.
 * It has no icon per category, so the first keyword that matches picks one
 * (chip and tile differ where the Figma does); anything else gets a tag.
 */
const CATEGORY_ICONS: { match: RegExp; chip: LucideIcon; tile: LucideIcon }[] = [
  { match: /crypto|blockchain|web3|bitcoin/i, chip: Bitcoin, tile: Bitcoin },
  { match: /financ|fintech|invest|wealth|insurance|income|bank/i, chip: Landmark, tile: Landmark },
  { match: /educat|training|learning|course|career|school/i, chip: GraduationCap, tile: GraduationCap },
  { match: /healthcare|medical|clinic|hospital|pharma/i, chip: Stethoscope, tile: Stethoscope },
  { match: /wellbeing|well-being|wellness|health|fitness|lifestyle/i, chip: HeartHandshake, tile: HeartHandshake },
  { match: /restaurant|food|chocolate|cafe|kitchen/i, chip: UtensilsCrossed, tile: UtensilsCrossed },
  { match: /fashion|apparel|clothing|beauty/i, chip: Shirt, tile: Shirt },
  { match: /retail|e-?commerce|shop|store|fmcg|gift/i, chip: ShoppingBag, tile: ShoppingBag },
  { match: /real estate|property|construction|manufactur|horticulture|landscap/i, chip: Building2, tile: Building2 },
  { match: /gaming|games|film|video|entertainment/i, chip: Clapperboard, tile: Clapperboard },
  { match: /marketing|growth|sales|brand|advertis/i, chip: ChartLine, tile: Megaphone },
  { match: /design|creative|\bart\b/i, chip: Palette, tile: Palette },
  { match: /startup|founder|entrepreneur|innovation/i, chip: Rocket, tile: Rocket },
  { match: /\b(ai|tech|technology|software|it services|saas|engineering|developers?|digital)\b/i, chip: Sparkles, tile: Cpu },
  { match: /product|business|consult|management|services/i, chip: BriefcaseBusiness, tile: BriefcaseBusiness },
  { match: /writing|writer|content|publish|media/i, chip: PenLine, tile: BookOpen },
];

function categoryIcon(name: string, surface: "chip" | "tile"): LucideIcon {
  return CATEGORY_ICONS.find((c) => c.match.test(name))?.[surface] ?? Tag;
}

function Chip({
  active,
  icon: Icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={typeof children === "string" ? children : undefined}
      className={cn(
        "inline-flex h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] transition-colors",
        active
          ? "border-[#ffc200] bg-[#ffc200] font-semibold text-black"
          : "border-[#2b2923] bg-[#121210] font-medium text-[#aaa69c] hover:border-[#3a362c] hover:text-[#f5f1e7]"
      )}
    >
      {Icon && <Icon className="size-[15px] shrink-0" />}
      <span className="max-w-[200px] truncate">{children}</span>
    </button>
  );
}

const RAIL_GAP = 10; // gap-2.5

const MoreChip = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function MoreChip(props, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        className="inline-flex h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#2b2923] bg-[#121210] px-4 text-[13px] font-medium text-[#aaa69c] outline-none transition-colors hover:border-[#3a362c] hover:text-[#f5f1e7]"
      >
        <ChevronDown className="size-[15px]" />
        More
      </button>
    );
  }
);

/**
 * "All offices" plus as many categories (most used first) as fit the row at
 * the current width; the rest sit behind "More". The selected category
 * always stays visible.
 */
export function CategoryRail({
  categories,
  selected,
  onSelect,
  loading,
}: {
  categories: DiscoverCategory[];
  /** Category name, or null for "All offices". */
  selected: string | null;
  onSelect: (category: string | null) => void;
  loading?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fitCount, setFitCount] = useState(categories.length);

  // Measure every chip off-screen, then keep as many as fit beside
  // "All offices" and "More"; refit whenever the row changes width.
  useLayoutEffect(() => {
    const rail = railRef.current;
    const measure = measureRef.current;
    if (!rail || !measure) return;
    const fit = () => {
      const widths = [...measure.children].map((el) => (el as HTMLElement).offsetWidth);
      const allWidth = widths[0] ?? 0;
      const moreWidth = widths[widths.length - 1] ?? 0;
      const chipWidths = widths.slice(1, -1);
      let used = allWidth;
      let count = 0;
      for (let i = 0; i < chipWidths.length; i++) {
        const needsMore = i < chipWidths.length - 1;
        if (used + RAIL_GAP + chipWidths[i] + (needsMore ? RAIL_GAP + moreWidth : 0) > rail.clientWidth) break;
        used += RAIL_GAP + chipWidths[i];
        count++;
      }
      setFitCount(count);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(rail);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [categories, loading]);

  if (loading) return <ChipRowSkeleton />;

  const selectedEntry = selected
    ? categories.find((c) => c.name.toLowerCase() === selected.toLowerCase())
    : undefined;
  let visible = categories.slice(0, fitCount);
  if (selectedEntry && !visible.includes(selectedEntry)) {
    visible = [...visible.slice(0, Math.max(fitCount - 1, 0)), selectedEntry];
  }
  const overflow = categories.filter((c) => !visible.includes(c));

  return (
    <div className="relative">
      {/* Off-screen copy of every chip, sized as if selected (the widest). */}
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden">
        <div ref={measureRef} className="flex w-max gap-2.5">
          <Chip active icon={LayoutGrid}>
            All offices
          </Chip>
          {categories.map((c) => (
            <Chip key={c.name} active icon={categoryIcon(c.name, "chip")}>
              {c.name}
            </Chip>
          ))}
          <MoreChip tabIndex={-1} />
        </div>
      </div>

      <div
        ref={railRef}
        className="flex items-center gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Chip active={!selected} icon={LayoutGrid} onClick={() => onSelect(null)}>
          All offices
        </Chip>
        {visible.map((c) => (
          <Chip
            key={c.name}
            active={selectedEntry === c}
            icon={categoryIcon(c.name, "chip")}
            onClick={() => onSelect(c.name)}
          >
            {c.name}
          </Chip>
        ))}
        {overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MoreChip />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[320px] w-[280px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[14px] border-[#3a362c] bg-[#181713] p-1.5 text-[#f5f1e7]"
            >
              {overflow.map((c) => {
                const Icon = categoryIcon(c.name, "chip");
                return (
                  <DropdownMenuItem
                    key={c.name}
                    title={c.name}
                    onSelect={() => onSelect(c.name)}
                    className="flex min-w-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-[#aaa69c] focus:bg-[#201e18] focus:text-[#f5f1e7]"
                  >
                    <Icon className="size-[15px] shrink-0 text-[#ffc200]" />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-[#747169]">{c.count}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

const officesLabel = (n: number) => `${n} ${n === 1 ? "office" : "offices"}`;

export function CategoryTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[154px] flex-col justify-between rounded-[20px] border border-[#2b2923] bg-[#121210] p-5"
        >
          <SkeletonBar className="size-10 rounded-[14px]" />
          <div className="flex items-end justify-between gap-2">
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Browse by category": one tile per category with its office count. */
export function CategoryTiles({
  categories,
  onSelect,
  compact,
}: {
  categories: DiscoverCategory[];
  onSelect: (category: string) => void;
  /** Icon-over-name tiles, as on the no-results screen. */
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((c) => {
        const Icon = categoryIcon(c.name, compact ? "chip" : "tile");
        return compact ? (
          <button
            key={c.name}
            type="button"
            onClick={() => onSelect(c.name)}
            className="flex h-24 flex-col items-center justify-center gap-2 rounded-[20px] border border-[#2b2923] bg-[#121210] px-3 transition-colors hover:border-[#3a362c]"
          >
            <Icon className="size-[18px] text-[#ffc200]" />
            <span className="truncate text-[13px] font-semibold text-[#f5f1e7]">{c.name}</span>
          </button>
        ) : (
          <button
            key={c.name}
            type="button"
            onClick={() => onSelect(c.name)}
            className="flex h-[154px] min-w-0 flex-col items-start justify-between rounded-[20px] border border-[#2b2923] bg-[#121210] p-5 text-left transition-colors hover:border-[#3a362c]"
          >
            <span className="flex size-10 items-center justify-center rounded-[14px] bg-[rgba(229,184,92,0.1)]">
              <Icon className="size-[19px] text-[#ffc200]" />
            </span>
            <span className="flex w-full items-end justify-between gap-2">
              <span className="truncate text-[15px] font-semibold text-[#f5f1e7]">{c.name}</span>
              <span className="shrink-0 text-[11px] text-[#747169]">{officesLabel(c.count)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
