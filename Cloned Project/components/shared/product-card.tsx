"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  deriveProductCommercials,
  type ProductCommercialRow,
} from "@/lib/money/format-money";
import { PlatformMark, isPlatformProductType } from "@/components/icons/platform-logos";

/**
 * The one canonical product card, shared across EarnGPT, Opportunities and the
 * Links page (#41). Cover + type badge, then Sold By / Price / Commissions as
 * boxed inset rows. Supports a selectable state (gold ring when selected, dimmed
 * when a sibling is selected). Callers normalise their item into `ProductCardItem`.
 */
export interface ProductCardItem {
  id: string;
  name: string;
  image?: string | null;
  /** Corner badge — e.g. "Physical" / "Digital" / "course". */
  badge?: string | null;
  sellerName?: string | null;
  sellerLogo?: string | null;
  /** Preformatted price, e.g. "Free" or "₹1,019.00". */
  priceLabel: string;
  /** Preformatted L1 commission amount, e.g. "₹1,019.00" — null when none. */
  commissionAmount?: string | null;
  /** L1 commission percent (number), e.g. 25 — null when none. */
  commissionPct?: number | null;
  /** A rendered cover (e.g. a platform monogram) used instead of `image`. */
  coverNode?: React.ReactNode;
  /** "Always-available" platform product (NetworkChains/Garage/Garage Shop) —
   *  a relationship play, so Sold By / Price / Commissions are hidden. */
  isPlatform?: boolean;
}

/** A catalog row shape (CatalogBrowseItem / ProductSuggestion) → the card item.
 *  One place for the identity + price/commission mapping every product surface
 *  repeated inline. */
export type CatalogRowLike = ProductCommercialRow & {
  itemId: string;
  name: string;
  itemType?: string | null;
  orgName?: string | null;
  orgSlug?: string | null;
  coverUrl?: string | null;
};

export function toProductCardItem(row: CatalogRowLike): ProductCardItem {
  const { priceLabel, commissionAmount, commissionPct } =
    deriveProductCommercials(row);
  // Platform products (NetworkChains/Garage/Garage Shop) have no catalog cover
  // or commission — render a monogram + hide the commercial rows.
  if (isPlatformProductType(row.itemType)) {
    return {
      id: row.itemId,
      name: row.name,
      badge: "Platform",
      priceLabel: "",
      coverNode: <PlatformMark itemId={row.itemId} />,
      isPlatform: true,
    };
  }
  return {
    id: row.itemId,
    name: row.name,
    image: row.coverUrl,
    badge: row.itemType,
    sellerName: row.orgName || row.orgSlug,
    priceLabel,
    commissionAmount,
    commissionPct,
  };
}

export function ProductCard({
  item,
  selected,
  dimmed,
  onClick,
}: {
  item: ProductCardItem;
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
        // Liquid glass: whitish translucent fill + top rim highlight + a diagonal
        // catch-light painted behind content (::before), soft lift.
        "group relative isolate flex w-full flex-col overflow-hidden rounded-2xl border p-3 text-left backdrop-blur-xl transition-[border-color,box-shadow,opacity,background-color] duration-300",
        "bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_32px_-14px_rgba(0,0,0,0.6)]",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-[radial-gradient(130%_110%_at_0%_0%,rgba(255,255,255,0.1),transparent_46%)]",
        selected
          ? "border-brand/70 shadow-[0_0_0_1px_rgba(255,194,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "border-white/[0.1] hover:border-white/[0.18] hover:bg-white/[0.1]",
        dimmed && "opacity-35",
      )}
    >
      {/* Cover */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/[0.03]">
        {item.coverNode ? (
          item.coverNode
        ) : item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
            No image
          </div>
        )}
        {item.badge && (
          <span className="absolute left-2 top-2 rounded-md bg-brand px-2 py-0.5 text-[10px] font-semibold capitalize text-brand-foreground">
            {item.badge}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-white">
        {item.name || "Untitled"}
      </p>

      {item.isPlatform ? (
        /* Platform product — a relationship play, no commercials. */
        <Field label="Opportunity">
          <span className="text-[13px] text-zinc-200">
            Introduce them to {item.name}
          </span>
        </Field>
      ) : (
        <>
          {/* Sold By */}
          <Field label="Sold By">
            <div className="flex items-center gap-2">
              <SellerAvatar name={item.sellerName} logo={item.sellerLogo} />
              <span className="truncate text-[13px] capitalize text-zinc-200">
                {item.sellerName || "—"}
              </span>
            </div>
          </Field>

          {/* Price */}
          <Field label="Price">
            <span className="text-[13px] text-zinc-200">{item.priceLabel}</span>
          </Field>

          {/* Commissions — split box: amount | percent */}
          <Field label="Commissions" noPad>
            <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
              <span className="px-3 py-2 text-[13px] font-medium text-emerald-400">
                {item.commissionAmount ?? "-"}
              </span>
              <span className="px-3 py-2 text-[13px] font-medium text-brand">
                {item.commissionPct != null ? `${item.commissionPct.toFixed(2)}%` : "-"}
              </span>
            </div>
          </Field>
        </>
      )}
    </motion.button>
  );
}

function Field({
  label,
  children,
  noPad,
}: {
  label: string;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="mt-2.5">
      <p className="mb-1 text-[11px] font-medium text-zinc-500">{label}</p>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-white/[0.06] bg-black/30",
          !noPad && "px-3 py-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SellerAvatar({ name, logo }: { name?: string | null; logo?: string | null }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />;
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#FFA800] text-[10px] font-semibold text-brand-foreground">
      {initial}
    </span>
  );
}
