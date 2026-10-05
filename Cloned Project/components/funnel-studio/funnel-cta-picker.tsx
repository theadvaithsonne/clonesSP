"use client";

import { useState } from "react";
import { Tag, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachProductDrawer } from "@/components/garage/attach-product-drawer";
import type { FunnelCta } from "@/lib/nc-admin-api/admin-funnels";

/**
 * Attach a product from the NC catalog to a funnel as its call-to-action, using
 * the SAME "Attach a Product" side panel as Funnel Studio (never the webinar pin
 * modal). The funnel's end screen drives visitors to this product.
 */
export function FunnelCtaPicker({
  value,
  onChange,
  affiliateIdOverride,
}: {
  value: FunnelCta | null;
  onChange: (cta: FunnelCta | null) => void;
  /** Author general links under a fixed affiliate — see LinkPicker. */
  affiliateIdOverride?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-9 gap-2 rounded-xl border-white/[0.08] text-sm text-zinc-200"
        >
          <Tag className="h-4 w-4 text-brand" />
          {value?.name ? (
            <span className="max-w-[220px] truncate">{value.name}</span>
          ) : (
            <span className="text-zinc-400">Attach a product</span>
          )}
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Remove product"
            onClick={() => onChange(null)}
            className="h-9 w-9 rounded-xl text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AttachProductDrawer
        open={open}
        onOpenChange={setOpen}
        affiliateIdOverride={affiliateIdOverride}
        currentName={value?.name ?? null}
        subtitle="Pick the product this funnel promotes. Every affiliate's copy drives to it."
        onSelect={(link) =>
          onChange({
            itemType: link.itemType,
            itemId: link.itemId,
            category: link.category,
            orgSlug: link.orgSlug,
            name: link.name,
            image: link.image,
            price: link.price,
            currency: link.currency,
          })
        }
      />
    </>
  );
}
