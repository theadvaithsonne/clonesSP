/**
 * Will anything actually auto-charge this buyer at their next cycle?
 *
 * Extracted from routes/garageAdminNetworkChainSubs.ts so the NetworkChain Subs
 * admin page and the "$25 + NetworkChain + autodebit" admin notification share
 * ONE definition. Two copies would drift, and then the page would say
 * "Auto-debit ON" for a buyer the notification says has none.
 *
 * Auto-debit is on only when there is a usable stored instrument — an active,
 * unexpired UPI mandate, or a saved card with a Stripe customer. Coverage
 * alone is not enough: a buyer who paid once by card without saving it has
 * active coverage and no way to be charged again.
 *
 * The UPI predicate matches services/invoice.ts's renewal check exactly,
 * expiry included: a mandate past `mandateExpiresAt` cannot be debited.
 */
export function autoDebitInstrument(buyer: any): "upi" | "card" | null {
  if (!buyer) return null;
  const now = new Date();
  const hasUpiMandate = ((buyer?.paymentProfile?.razorpay?.tokens || []) as any[]).some(
    (t) =>
      t?.method === "upi" &&
      t?.mandateId &&
      t?.mandateStatus === "active" &&
      (!t.mandateExpiresAt || new Date(t.mandateExpiresAt) > now),
  );
  if (hasUpiMandate) return "upi";
  const hasCard =
    ((buyer?.paymentProfile?.stripe?.methods || []) as any[]).length > 0 &&
    !!buyer?.paymentProfile?.stripe?.customerId;
  return hasCard ? "card" : null;
}
