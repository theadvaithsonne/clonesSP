// Cryptobrand checkout status — answers "does this org still owe Pro
// ($96) or Cryptosub ($600) from its cryptobrand-bootstrap?" server-
// authoritatively, and hands back the pending invoice(s) the founder
// still needs to pay.
//
// Called by GET /org/:orgId/cryptobrand-checkout. Decoupled from
// bootstrapCryptobrandOfficeInvoices (which mints BOTH sides
// unconditionally) so re-hitting this endpoint after one side is paid
// doesn't re-mint the paid side.

import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { hasActiveAddon } from "./officeAddonSubscription";
import {
  mintProOfficeInvoice,
  mintCryptosubInvoice,
  BootstrapInvoiceRef,
} from "./cryptobrandOfficeBootstrap";
import { CRYPTOSUB_ADDON } from "../config/cryptosubAddon";

export interface CryptobrandCheckoutStatus {
  needsCheckout: boolean;
  officePaid: boolean;
  cryptosubPaid: boolean;
  officeInvoice: BootstrapInvoiceRef | null;
  cryptosubInvoice: BootstrapInvoiceRef | null;
}

/**
 * True when the cryptobrand-bootstrap Pro office_plan invoice for this
 * org is `status = "paid"`. Scope: cryptobrand-bootstrap only — orgs
 * that got Pro via the standard Razorpay office checkout are out of
 * scope for this endpoint's contract.
 */
export async function isProOfficeSatisfied(orgId: string): Promise<boolean> {
  const paid = await Invoice.exists({
    organizationId: new Types.ObjectId(orgId),
    status: "paid",
    "lineItems.itemType": "office_plan",
    "metadata.source": "cryptobrand_bootstrap",
    "metadata.planSlug": "pro",
  });
  return !!paid;
}

/**
 * Full checkout state for the org. When either side is unpaid, that
 * side's `*Invoice` is populated with the pending (or re-minted)
 * invoice the founder should pay. Reuses `createInvoice`'s pending
 * dedup — a still-pending invoice from the original bootstrap comes
 * back unchanged. Never mints for already-paid sides.
 */
export async function getCryptobrandCheckoutStatus(
  orgId: string,
  founderUserId: string,
): Promise<CryptobrandCheckoutStatus> {
  const [officePaid, cryptosubPaid] = await Promise.all([
    isProOfficeSatisfied(orgId),
    hasActiveAddon(orgId, CRYPTOSUB_ADDON.slug),
  ]);

  const [officeInvoice, cryptosubInvoice] = await Promise.all([
    officePaid
      ? Promise.resolve(null)
      : mintProOfficeInvoice({ orgId, founderUserId }),
    cryptosubPaid
      ? Promise.resolve(null)
      : mintCryptosubInvoice({ orgId, founderUserId }),
  ]);

  return {
    needsCheckout: !officePaid || !cryptosubPaid,
    officePaid,
    cryptosubPaid,
    officeInvoice: officeInvoice || null,
    cryptosubInvoice: cryptosubInvoice || null,
  };
}
