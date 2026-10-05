"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The one canonical office card (#43), shared by the Links page and anywhere
 * else an office/organization is surfaced (e.g. EarnGPT suggestions). Org banner
 * + avatar/name/country, then Members / Offers / Industry as boxed stats. Stats
 * show "—" when the source payload doesn't carry them. Offices are NOT products,
 * so they never render the product card (no Price / Commissions).
 */
export interface OfficeCardItem {
  id: string;
  name: string;
  image?: string | null;
  /** Small avatar/badge image (falls back to `image`, then the name initial). */
  logo?: string | null;
  /** Large card banner image (falls back to `image`). */
  coverPhoto?: string | null;
  country?: string | null;
  memberCount?: number | null;
  offerCount?: number | null;
  industry?: string | null;
}

export function OfficeCard({
  item,
  selected,
  dimmed,
  onClick,
}: {
  item: OfficeCardItem;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={dimmed ? undefined : { y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col overflow-hidden rounded-2xl border p-3 text-left backdrop-blur-xl transition-[border-color,box-shadow,opacity,background-color] duration-300",
        "bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_32px_-14px_rgba(0,0,0,0.6)]",
        selected
          ? "border-brand/70 shadow-[0_0_0_1px_rgba(255,194,0,0.45)]"
          : "border-white/[0.1] hover:border-white/[0.18] hover:bg-white/[0.1]",
        dimmed && "opacity-35",
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-white/[0.03]">
        {item.coverPhoto || item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(item.coverPhoto || item.image) as string} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">No image</div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        {item.logo || item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(item.logo || item.image) as string}
            alt=""
            loading="lazy"
            className="h-8 w-8 shrink-0 rounded-full border border-white/[0.1] bg-white/[0.06] object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#FFA800] text-xs font-semibold text-brand-foreground">
            {(item.name || "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">{item.name}</p>
          {item.country && <p className="text-[11px] text-zinc-500">{item.country}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Stat label="Members" value={item.memberCount != null ? String(item.memberCount) : "—"} />
        <Stat label="Offers" value={item.offerCount != null ? String(item.offerCount) : "—"} />
      </div>
      <div className="mt-2.5">
        <Stat label="Industry" value={item.industry || "—"} />
      </div>
    </motion.button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-zinc-500">{label}</p>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[13px] text-zinc-200">{value}</div>
    </div>
  );
}
