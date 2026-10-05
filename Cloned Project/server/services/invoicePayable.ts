import type { Types } from "mongoose";

/**
 * Whether an invoice may still be paid.
 *
 * `expiresAt` was written on every invoice from the day the field existed and
 * then never checked — no payment path looked at it. The daily
 * `expireStaleInvoices()` sweep was the only thing that would have caught a
 * stale row, and it flipped exactly 6 invoices ever, leaving 394 draft/pending
 * invoices payable past their expiry, the oldest by 155 days.
 *
 * What that costs is not theoretical. A Unilevel Plus invoice minted in May at
 * $25 was paid in September, 129 days after it expired. The price was right
 * for the invoice and wrong for the moment: by then the buyer's 24-hour
 * free-first-month window had long closed, so the correct cart was $25 + the
 * first subscription cycle. She was charged $25, received the licence, and got
 * no NetworkChains subscription — because fulfilment re-checks the window live
 * and correctly declined to grant a free month. 13 other invoices are in the
 * same state.
 *
 * A stale invoice is a stale QUOTE. Prices, offer windows and bundle terms all
 * move; settling an old invoice silently applies terms nobody would offer
 * today. The buyer must be sent back to checkout for a current cart.
 *
 * Enforced at payment INITIATION, never at fulfilment — rejecting after the
 * money has moved means a refund, and the buyer has already been charged for
 * something we then refuse to deliver.
 */

/** Statuses from which a payment may legitimately be started. */
const PAYABLE_STATUSES = new Set(["draft", "pending", "failed"]);

export type UnpayableReason =
  | "already_paid"
  | "cancelled"
  | "expired"
  | "refunded"
  | "bad_status";

export interface PayabilityResult {
  payable: boolean;
  reason?: UnpayableReason;
  /** Safe to show a buyer. */
  message?: string;
  /** Whether the row's status should be corrected to "expired". */
  shouldMarkExpired?: boolean;
}

export function checkInvoicePayable(
  invoice: {
    status?: string;
    expiresAt?: Date | string | null;
    _id?: Types.ObjectId | string;
  },
  now: Date = new Date()
): PayabilityResult {
  const status = String(invoice?.status || "");

  if (status === "paid") {
    return {
      payable: false,
      reason: "already_paid",
      message: "This invoice has already been paid.",
    };
  }
  if (status === "cancelled") {
    return {
      payable: false,
      reason: "cancelled",
      message: "This invoice was cancelled.",
    };
  }
  if (status === "refunded") {
    return {
      payable: false,
      reason: "refunded",
      message: "This invoice was refunded.",
    };
  }
  if (status === "expired") {
    return {
      payable: false,
      reason: "expired",
      message:
        "This invoice has expired. Start a new checkout to get current pricing.",
    };
  }
  if (!PAYABLE_STATUSES.has(status)) {
    return {
      payable: false,
      reason: "bad_status",
      message: "This invoice cannot be paid.",
    };
  }

  // Past expiry but never swept — the common case, since the sweep depends on
  // an external scheduler. Report it so the caller can correct the row as well
  // as refuse the payment; that makes the state self-healing without a cron.
  if (invoice?.expiresAt) {
    const exp = new Date(invoice.expiresAt as any).getTime();
    if (Number.isFinite(exp) && exp < now.getTime()) {
      return {
        payable: false,
        reason: "expired",
        message:
          "This invoice has expired. Start a new checkout to get current pricing.",
        shouldMarkExpired: true,
      };
    }
  }

  return { payable: true };
}

/**
 * Refuses payment on a stale invoice and lazily corrects its status.
 *
 * Returns null when the invoice is payable; otherwise the JSON body to send
 * with a 409. The status correction is fire-and-forget — a failed write must
 * not turn a clean refusal into a 500.
 */
export async function refuseIfNotPayable(
  invoice: any,
  now: Date = new Date()
): Promise<{ success: false; error: string; code: UnpayableReason } | null> {
  const result = checkInvoicePayable(invoice, now);
  if (result.payable) return null;

  if (result.shouldMarkExpired && invoice?._id) {
    try {
      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: invoice._id, status: { $in: ["draft", "pending"] } },
        { $set: { status: "expired" } }
      );
      console.log(
        `[Invoice] ${invoice.invoiceNumber || invoice._id} refused at payment and marked expired`
      );
    } catch (err: any) {
      console.error("[Invoice] lazy expire failed:", err?.message);
    }
  }

  return {
    success: false,
    error: result.message || "This invoice cannot be paid.",
    code: result.reason!,
  };
}
