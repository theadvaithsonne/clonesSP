// Turns a new UnilevelPlusPurchase into "$25 payment" admin notification events.
//
// Triggered by the post-save hook on UnilevelPlusPurchase, the one model every
// $25 payment path writes: invoice fulfilment, the Razorpay webhook fallback,
// and the direct verify route. They are idempotent against each other (each
// checks `getUserPurchase` first), so one real payment creates one purchase and
// raises one set of events.
//
// NOT EVERY PURCHASE IS A PAYMENT. Prod data, 2026-09-13, by metadata.source:
//   invoice_fulfillment 231 · (none — direct verify) 56 · webhook_fallback 11
//   reserve_assignment 7 · synthetic_mint_google_oauth 2 · manual_activation 1
//   backfill 1
// A reserve licence being assigned moves no money — the buyer paid when they
// bought the licence. Backfills, synthetic mints and manual activations aren't
// payments either. Those are excluded, as are $0 coupon activations.

import { Types } from "mongoose";
import { User } from "../../models/user.model";
import { Invoice } from "../../models/invoice.model";
import { autoDebitInstrument } from "../autoDebitInstrument";
import { emitAdminEvent, EmitSummaryRow } from "./dispatch";
import type { EvalUser } from "./evaluate";

/** Sources that create a purchase WITHOUT a payment happening. */
const NON_PAYMENT_SOURCES = new Set([
  "reserve_assignment",
  "synthetic_mint_google_oauth",
  "manual_activation",
  "backfill",
]);

/**
 * The autodebit instrument is written by a separate webhook (Razorpay token /
 * Stripe payment-method) that can land AFTER fulfilment. So a combo buyer who
 * has no instrument yet is re-checked after these delays. The dispatch log's
 * (rule, event) unique index makes a late fire safe to repeat.
 *
 * Known limit: these timers live in memory, so a process restart inside the
 * window drops the re-check — the $25 and $25+NetworkChain notifications are
 * unaffected, only a late-arriving autodebit one can be missed.
 */
const AUTODEBIT_RECHECK_MS = [60_000, 5 * 60_000];

export async function emitUp25PaymentEvents(purchase: any): Promise<void> {
  try {
    const meta = (purchase?.metadata || {}) as Record<string, any>;
    const rawSource: string | undefined = meta.source;
    if (rawSource && NON_PAYMENT_SOURCES.has(rawSource)) return;

    const amount = Number(purchase?.amount) || 0;
    if (amount <= 0) return; // $0 coupon activation — nobody paid

    const payer = await loadEvalUser(purchase.userId, true);
    if (!payer) return;
    const sponsor = payer.referredBy ? await loadEvalUser(payer.referredBy, false) : null;

    const invoice = meta.invoiceId && Types.ObjectId.isValid(meta.invoiceId)
      ? await Invoice.findById(meta.invoiceId).select("invoiceNumber metadata").lean<any>()
      : null;
    const combo = invoice?.metadata?.combo;
    // A combo checkout is not automatically NetworkChain — GarageGo is also a
    // third-party client that can be sold alongside the $25 plan.
    const isNetworkChain = !!combo && /networkchain/i.test(String(combo.clientName || ""));

    const source = rawSource === "invoice_fulfillment" || rawSource === "webhook_fallback" ? rawSource : "direct";
    const eventId = String(purchase._id);

    const base = {
      user: payer,
      sponsor,
      amount,
      country: (payer as any).country ?? null,
      source,
      termMonths: isNetworkChain ? Number(combo.termMonths) || null : null,
      freeFirstMonth: isNetworkChain ? combo.freeFirstCycle === true : false,
      autoDebitVia: (payer as any).autoDebitVia ?? "none",
    };

    const summary = (autoDebitVia: string): EmitSummaryRow[] => {
      const rows: EmitSummaryRow[] = [
        { label: "Payer", value: `${payer.name || "—"} <${payer.email || "no email"}>` },
        { label: "Amount", value: `$${amount}` },
        { label: "Sponsor", value: sponsor ? `${sponsor.name || "—"} <${sponsor.email || "no email"}>` : "—" },
        { label: "Paid via", value: source },
      ];
      if (invoice?.invoiceNumber) rows.push({ label: "Invoice", value: String(invoice.invoiceNumber) });
      if (isNetworkChain) {
        // Free-first-month combos carry NO termMonths at all (verified on prod
        // invoices, 2026-09-13), so "? month(s)" is what a naive format prints.
        const term = Number(combo.termMonths);
        rows.push({
          label: "NetworkChain",
          value:
            term > 0
              ? `${term} month(s)${combo.freeFirstCycle ? " · free first month" : ""}`
              : combo.freeFirstCycle
                ? "Free first month"
                : "Included",
        });
        rows.push({ label: "Auto-debit", value: autoDebitVia === "none" ? "not set up" : autoDebitVia.toUpperCase() });
      }
      if ((payer as any).country) rows.push({ label: "Country", value: String((payer as any).country) });
      rows.push({ label: "Time", value: new Date(purchase.createdAt || Date.now()).toUTCString() });
      return rows;
    };

    await emitAdminEvent({ eventName: "payment.up25", eventId, payload: base, summary: summary(base.autoDebitVia) });

    if (!isNetworkChain) return;
    await emitAdminEvent({
      eventName: "payment.up25.networkchain",
      eventId,
      payload: base,
      summary: summary(base.autoDebitVia),
    });

    const fireAutodebit = async (via: string) =>
      emitAdminEvent({
        eventName: "payment.up25.networkchain.autodebit",
        eventId,
        payload: { ...base, autoDebitVia: via },
        summary: summary(via),
      });

    if (base.autoDebitVia !== "none") {
      await fireAutodebit(base.autoDebitVia);
      return;
    }

    for (const delay of AUTODEBIT_RECHECK_MS) {
      setTimeout(() => {
        User.findById(purchase.userId)
          .select("paymentProfile")
          .lean()
          .then((u) => {
            const via = autoDebitInstrument(u);
            if (via) return fireAutodebit(via);
          })
          .catch((err) => console.error("[AdminNotifications] autodebit re-check failed:", err));
      }, delay).unref?.();
    }
  } catch (err) {
    console.error("[AdminNotifications] payment event emit failed:", err);
  }
}

async function loadEvalUser(
  id: unknown,
  withPayment: boolean,
): Promise<(EvalUser & { country?: string | null; autoDebitVia?: string }) | null> {
  if (!id || !Types.ObjectId.isValid(String(id))) return null;
  const u = await User.findById(id)
    .select(`name email country ancestors referredBy typeFlags${withPayment ? " paymentProfile" : ""}`)
    .lean<any>();
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name ?? null,
    email: u.email ?? null,
    ancestors: Array.isArray(u.ancestors) ? u.ancestors.map((a: any) => String(a)) : [],
    referredBy: u.referredBy ? String(u.referredBy) : null,
    typeFlags: u.typeFlags && typeof u.typeFlags === "object" ? { ...u.typeFlags } : {},
    country: u.country ?? null,
    ...(withPayment ? { autoDebitVia: autoDebitInstrument(u) ?? "none" } : {}),
  };
}
