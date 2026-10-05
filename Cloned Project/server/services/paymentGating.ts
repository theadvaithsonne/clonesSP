// Shared predicate for "how do we charge a saved Stripe card off-session?"
//
// Two call sites today:
//   - services/invoice.ts saved-card branch (a buyer clicked "Pay with
//     saved card" during checkout).
//   - routes/garageAdminSavedCards.ts (an admin triggered a one-time
//     charge on behalf of the user).
//
// Rules (mirror of what /billing docs say about RBI e-mandates):
//
//   USD (or any non-INR) → off_session works out of the box. Foreign
//     issuer or presentment-conversion path; no mandate needed.
//
//   INR + Indian issuer WITHOUT mandate (or over cap) → CIT: OTP is
//     required for every charge. Caller must set off_session:false and
//     hand the returned clientSecret to the buyer for a 3DS challenge.
//
//   INR + Indian issuer WITH active mandate AND amount ≤ mandateAmount
//     → MIT: off_session:true + mandate=<mandateId>. Zero OTP. This is
//     the reuse fast path we set up in prior work.
//
// `card` accepts the loose shape stored on User.paymentProfile.stripe.methods
// so callers don't have to normalise before invoking.

export interface SavedCardChargeMode {
  /** Pass to chargeSavedPaymentMethod. */
  offSession: boolean;
  /** Mandate id to pass to Stripe when off-session on an Indian card.
   *  Undefined when the caller shouldn't send a mandate at all. */
  mandate?: string;
  /**
   * Machine-readable label describing why we picked this mode. Useful
   * for admin dashboards ("MIT — zero OTP", "CIT — user OTP required",
   * "USD off-session") without duplicating the branching logic.
   */
  reason:
    | "usd_off_session"
    | "inr_mit_zero_otp"
    | "inr_cit_otp_required";
}

/**
 * Given a saved card row + the invoice's amount/currency, decide how
 * the off-session Stripe call should be shaped. Pure — no I/O.
 */
export function resolveSavedCardChargeMode(opts: {
  card: {
    country?: string | null;
    mandateId?: string | null;
    mandateAmount?: number | null;
    mandateStatus?: string | null;
  };
  invoiceAmount: number;
  invoiceCurrency: string;
}): SavedCardChargeMode {
  const isINR = (opts.invoiceCurrency || "").toLowerCase() === "inr";

  if (!isINR) {
    return { offSession: true, reason: "usd_off_session" };
  }

  const mandateId = opts.card.mandateId || undefined;
  const mandateAmount = Number(opts.card.mandateAmount || 0);
  const mandateActive = (opts.card.mandateStatus || "") === "active";
  const canUseMandate =
    !!mandateId && mandateActive && opts.invoiceAmount <= mandateAmount;

  if (canUseMandate) {
    return {
      offSession: true,
      mandate: mandateId,
      reason: "inr_mit_zero_otp",
    };
  }

  return { offSession: false, reason: "inr_cit_otp_required" };
}
