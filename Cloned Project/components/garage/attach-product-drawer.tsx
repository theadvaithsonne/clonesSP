"use client";

import { useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";
import { LinkPicker } from "./link-picker";
import { linkItemToFunnelLink } from "@/lib/affiliate/link-card-adapters";
import type { LinkItem } from "@/lib/affiliate/links-api";
import type { FunnelLink } from "@/lib/api/funnels";

/**
 * The canonical "Attach a Product" side panel — the same LinkPicker (Physical /
 * Digital / Offices / General) that Funnel Studio uses. Reusable wherever a
 * funnel product/CTA is chosen, so the webinar "Pin an item" modal is never
 * reused outside webinars. Returns the picked product as a FunnelLink.
 */
export function AttachProductDrawer({
  open,
  onOpenChange,
  onSelect,
  currentName,
  subtitle,
  affiliateIdOverride,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (link: FunnelLink) => void;
  /** Author general links under a fixed affiliate — see LinkPicker. */
  affiliateIdOverride?: string | null;
  /** Current product name, if one is already attached (switches the title). */
  currentName?: string | null;
  subtitle?: string;
}) {
  const [selected, setSelected] = useState<LinkItem | null>(null);

  // Reset the picker whenever the drawer closes, so it opens fresh next time.
  const handleOpenChange = (v: boolean) => {
    if (!v) setSelected(null);
    onOpenChange(v);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={currentName ? "Change Product" : "Attach a Product"}
      subtitle={
        subtitle ??
        (currentName
          ? `Currently promoting "${currentName}". Pick a different product.`
          : "Pick a product to promote at the end of this funnel.")
      }
      widthClass="max-w-[600px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!selected) return;
              onSelect(linkItemToFunnelLink(selected));
              handleOpenChange(false);
            }}
            disabled={!selected}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col py-2">
        <LinkPicker
          value={selected?.id ?? null}
          onChange={setSelected}
          affiliateIdOverride={affiliateIdOverride}
        />
      </div>
    </FormDrawer>
  );
}
