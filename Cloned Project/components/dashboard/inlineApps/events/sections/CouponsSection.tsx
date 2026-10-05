"use client";

// Coupons that apply to this event.
//
// Read-only on purpose. Events do not own a discount system — coupons are the
// org's existing coupons (routes/founderCoupons.ts) with
// `applicableTo: ["event_ticket"]`, and they are created and edited on the
// Coupons surface. Duplicating that CRUD here would give founders two places to
// manage one thing, and two places for the rules to drift.

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Percent } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, GOLD } from "../ui";
import { listEventCoupons, type OrgCoupon } from "../api";

export default function CouponsSection({
  eventId,
  eventName,
  onManageCoupons,
}: {
  eventId: string;
  eventName: string;
  onManageCoupons?: () => void;
}) {
  const [coupons, setCoupons] = useState<OrgCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listEventCoupons(eventId)
      .then((res) => {
        if (!cancelled) setCoupons(res.coupons || []);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || "Could not load coupons");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="px-8 py-8">
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-10 w-10" strokeWidth={1.25} />}
          title="No coupons target this event"
          description={`Create one on the Coupons page with "Event tickets" selected — leave the item list empty to cover every event, or pick "${eventName}" to scope it to this one.`}
          action={
            onManageCoupons ? (
              <Button onClick={onManageCoupons}>
                <ExternalLink className="h-4 w-4" />
                Go to Coupons
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {coupons.map((c) => {
            const expired = c.validUntil && new Date(c.validUntil) < new Date();
            const exhausted =
              c.maxUsageCount != null && (c.usageCount || 0) >= c.maxUsageCount;
            const dead = c.status !== "active" || expired || exhausted;
            return (
              <Card key={c._id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className="font-mono text-lg font-semibold"
                      style={{ color: dead ? "#4f5065" : GOLD }}
                    >
                      {c.code}
                    </div>
                    <p className="mt-1 truncate text-sm text-[#c7c7da]">{c.name}</p>
                  </div>
                  {dead && (
                    <span className="shrink-0 rounded bg-[#22222b] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#7c7d94]">
                      {expired ? "Expired" : exhausted ? "Used up" : c.status}
                    </span>
                  )}
                </div>

                <dl className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#7c7d94]">Discount</dt>
                    <dd className="text-[#c7c7da]">
                      {c.discountValue}%
                      {c.maxDiscountAmount
                        ? ` (max ${(c.maxDiscountAmount / 100).toFixed(2)})`
                        : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#7c7d94]">Used</dt>
                    <dd className="text-[#c7c7da]">
                      {c.usageCount || 0}
                      {c.maxUsageCount ? ` / ${c.maxUsageCount}` : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#7c7d94]">Expires</dt>
                    <dd className="text-[#c7c7da]">
                      {c.validUntil
                        ? new Date(c.validUntil).toLocaleDateString()
                        : "Never"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#7c7d94]">Scope</dt>
                    <dd className="text-[#c7c7da]">
                      {c.specificItemIds?.length ? "This event" : "All events"}
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
