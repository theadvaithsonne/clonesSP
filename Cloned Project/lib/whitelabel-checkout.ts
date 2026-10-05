// Small shared helper for the whitelabel add-on flow.
//
// The purchase itself moved to the hosted invoice pay page (see
// WhitelabelPurchaseDialog), so nothing here charges a card — this only
// opens an invoice.

/**
 * Open a whitelabel invoice in a new tab.
 * Accepts either an invoiceNumber (e.g. INV-XXXX-XXXX) or MongoDB invoiceId.
 *
 * New tab rather than a redirect: the entry points sit inside settings
 * pages, and navigating away would drop the founder out of what they
 * were configuring. noopener/noreferrer because window.open otherwise
 * hands the invoice page a reference back to this one.
 */
export function openWhitelabelInvoice(invoiceNumberOrId?: string) {
  if (!invoiceNumberOrId) return;
  window.open(`/invoice/${invoiceNumberOrId}`, "_blank", "noopener,noreferrer");
}
