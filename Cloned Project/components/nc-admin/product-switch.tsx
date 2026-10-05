"use client";

import { Fragment, useMemo } from "react";

import { ADMIN_PRODUCTS, useAdminProduct } from "@/lib/admin/product";

/**
 * Product switch for the admin observability pages (Sentry + Replays).
 *
 * Six products do not sit as six equal buttons: NetworkChains is one platform,
 * and Garage, Store, Admin, Buyer and Seller are one family. The divider says
 * so, and because it does, the family's buttons can drop the word "Garage" —
 * which is what keeps the whole control inside the page header rather than
 * spilling across it. `title` carries the full name for anyone who needs it.
 *
 * Deliberately still a segmented control and not a dropdown: this gets used
 * every few seconds while triaging, and a menu would hide five of six options
 * behind a click to save width the shortened labels already save.
 */
export function ProductSwitch() {
  const [product, setProduct] = useAdminProduct();

  // Runs of the same family, in declaration order — so adding a product to
  // lib/admin/product.ts places it without touching this file.
  const groups = useMemo(() => {
    const out: { family: string; items: typeof ADMIN_PRODUCTS }[] = [];
    for (const p of ADMIN_PRODUCTS) {
      const last = out[out.length - 1];
      if (last && last.family === p.family) last.items.push(p);
      else out.push({ family: p.family, items: [p] });
    }
    return out;
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Product"
      className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
    >
      {groups.map((group, i) => (
        <Fragment key={group.family}>
          {i > 0 && (
            <span aria-hidden className="mx-1.5 h-4 w-px bg-white/[0.10]" />
          )}
          {group.items.map((p) => {
            const active = product === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={p.label}
                onClick={() => setProduct(p.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                  active
                    ? "bg-brand text-brand-foreground"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                }`}
              >
                {p.short ?? p.label}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
