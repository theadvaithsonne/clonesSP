// src/routes/gstQuote.ts
//
// Buyer-facing GST quote for founder-sold items.
//
// GST applicability depends on the BUYER's country, which only the server can
// resolve (profile country, shipping address). The checkout pages used to
// recompute GST client-side behind a `currency === "INR"` gate, which meant a
// buyer whose profile says India but who is paying in USD saw one total and
// was charged another. This endpoint is the single source of truth for what
// the checkout pages render, using the exact same helpers the charge path
// uses (utils/gstTax + utils/gstBuyerRegion) so display and charge cannot
// drift.
//
// Read-only: no coupons are consumed, no invoice is created.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Product } from "../models/product.model";
import { User } from "../models/user.model";
import { applyGstToLine, GST_CONFIG } from "../utils/gstTax";
import { resolveBuyerGstRegion } from "../utils/gstBuyerRegion";

const router = Router();

const schema = z.object({
  itemType: z.enum(["channel", "course", "workshop", "product"]),
  itemId: z.string(),
  quantity: z.number().int().min(1).max(100).optional().default(1),
  // Identifies the buyer so their profile country can be read. Optional —
  // an unknown buyer falls back to the payment currency, same as checkout.
  email: z.string().email().optional(),
  // What the buyer will actually pay in, when they've picked a currency.
  // Defaults to the item's own currency, which is what paymentCurrency
  // defaults to at the pay step.
  paymentCurrency: z.string().optional(),
  // Per-unit listed price in the smallest unit, AFTER any coupon the page
  // has already applied. Omit to quote the item's own listed price.
  // Display-only: the authoritative charge is recomputed at checkout.
  subtotalMinor: z.number().int().min(0).optional(),
  // Physical products: the shipping country outranks the profile country.
  shippingCountry: z.string().optional(),
});

async function loadItem(itemType: string, itemId: string) {
  if (!Types.ObjectId.isValid(itemId)) return null;
  const _id = new Types.ObjectId(itemId);

  switch (itemType) {
    case "channel": {
      const c = await Channel.findById(_id)
        .select("price currency gstInclusive isFree")
        .lean();
      return c && { doc: c, exempt: false };
    }
    case "course": {
      const c = await Course.findById(_id)
        .select("price currency gstInclusive")
        .lean();
      return c && { doc: c, exempt: false };
    }
    case "workshop": {
      const w = await Workshop.findById(_id)
        .select("price currency gstInclusive")
        .lean();
      return w && { doc: w, exempt: false };
    }
    case "product": {
      const p = await Product.findById(_id)
        .select("price currency gstInclusive tags")
        .lean();
      return (
        p && {
          doc: p,
          // Same carve-out productCheckout applies: bat246 entries are
          // priced net of tax.
          exempt:
            Array.isArray((p as any).tags) &&
            (p as any).tags.includes("bat246_entry"),
        }
      );
    }
    default:
      return null;
  }
}

/**
 * POST /checkout/gst-quote
 *
 * → {
 *     applies, inclusive, rate,
 *     base, tax, total,          // per the requested quantity, smallest unit
 *     currency,
 *     buyerRegion: "IN" | "INTL",
 *     regionSource,
 *   }
 */
router.post("/gst-quote", async (req: Request, res: Response) => {
  try {
    const body = schema.parse(req.body);

    const found = await loadItem(body.itemType, body.itemId);
    if (!found) {
      return res
        .status(404)
        .json({ success: false, error: `${body.itemType} not found` });
    }
    const { doc, exempt } = found as any;

    const currency = (body.paymentCurrency || doc.currency || "USD").toUpperCase();
    const listedMain = doc.price || 0;
    const listedMinor =
      body.subtotalMinor !== undefined
        ? body.subtotalMinor
        : Math.round(listedMain * 100);

    // Resolve the buyer the same way checkout does. `email` may be absent
    // (pre-OTP) — then this is purely the currency fallback.
    let buyerUser: any = null;
    if (body.email) {
      buyerUser = await User.findOne({ email: body.email.trim().toLowerCase() })
        .select("country state city postalCode")
        .lean();
    }

    const region = await resolveBuyerGstRegion({
      buyerUser,
      shippingAddress: body.shippingCountry
        ? { country: body.shippingCountry }
        : undefined,
      paymentCurrency: currency,
    });

    const line = applyGstToLine({
      listedAmountMinor: listedMinor,
      quantity: body.quantity,
      gstInclusive: !!doc.gstInclusive,
      buyerInIndia: region.inIndia,
      exempt,
    });

    return res.json({
      success: true,
      applies: !!line.gstMetadata,
      inclusive: line.gstMetadata?.inclusive ?? !!doc.gstInclusive,
      rate: GST_CONFIG.rate,
      base: line.lineUnitPrice * body.quantity,
      tax: line.taxTotal,
      total: line.chargeTotal,
      currency,
      buyerRegion: region.inIndia ? "IN" : "INTL",
      regionSource: region.source,
      buyerCountry: region.country,
    });
  } catch (error: any) {
    if (error?.issues) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid request", details: error.issues });
    }
    console.error("[GstQuote] Failed to build quote:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to compute GST quote" });
  }
});

export default router;
