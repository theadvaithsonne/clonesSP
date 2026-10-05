"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

/**
 * GST for founder-sold items depends on the BUYER's country (profile country,
 * shipping address, else the payment currency), which only the server can
 * resolve. These pages used to recompute 18% client-side behind a
 * `currency === "INR"` gate, so a buyer whose profile says India but who pays
 * in USD saw a different total from the one they were charged.
 *
 * This hook asks the backend — which uses the same helpers as the charge path
 * — so the displayed total and the charged total cannot drift.
 *
 * All money in/out is in the smallest unit (paise/cents).
 */

export type GstQuote = {
  /** Was GST actually charged? False for foreign buyers and exempt items. */
  applies: boolean;
  /** True when the listed price already contained the tax. */
  inclusive: boolean;
  rate: number;
  /** Pre-tax base for the whole line. */
  base: number;
  tax: number;
  /** What the buyer pays, incl. tax. */
  total: number;
  currency: string;
  buyerRegion: "IN" | "INTL";
  regionSource: "shipping" | "billing" | "profile" | "payment_currency";
  buyerCountry: string | null;
};

export function useGstQuote(opts: {
  itemType: "channel" | "course" | "workshop" | "product";
  itemId?: string | null;
  quantity?: number;
  /** Buyer's email once known — lets the server read their profile country. */
  email?: string | null;
  /** Per-unit price after any coupon, smallest unit. Omit to use the listing. */
  subtotalMinor?: number;
  /** Shipping country for physical goods — outranks the profile country. */
  shippingCountry?: string | null;
  /** Skip the request entirely (e.g. free items). */
  enabled?: boolean;
}) {
  const {
    itemType,
    itemId,
    quantity = 1,
    email,
    subtotalMinor,
    shippingCountry,
    enabled = true,
  } = opts;

  const [quote, setQuote] = useState<GstQuote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !itemId) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/checkout/gst-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType,
            itemId,
            quantity,
            ...(email ? { email } : {}),
            ...(subtotalMinor !== undefined ? { subtotalMinor } : {}),
            ...(shippingCountry ? { shippingCountry } : {}),
          }),
        });
        const data = await res.json();
        if (!cancelled && data?.success) setQuote(data as GstQuote);
        // On failure leave `quote` null — callers fall back to showing no GST
        // line rather than inventing a number the server didn't sanction.
      } catch {
        // Same: stay silent, render no GST line.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    itemType,
    itemId,
    quantity,
    email,
    subtotalMinor,
    shippingCountry,
    enabled,
  ]);

  return { quote, loading };
}
