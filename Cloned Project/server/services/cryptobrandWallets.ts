// Cryptobrand multi-currency wallet lifecycle.
//
// Every member of an org where `officeCreatedFromCryptobrand === true`
// gets one wallet per currency in CRYPTOBRAND_ALL_CURRENCIES. USD is
// the parent (no parentWalletId); INR/ETH/BTC each carry
// `parentWalletId` pointing at the USD wallet for the same
// (userId, orgId) pair.
//
// Contract:
//   • `ensureCryptobrandWallets(userId, orgId)` — no-op on non-cryptobrand
//     orgs; on cryptobrand orgs, upserts the USD wallet first (so it
//     always exists to serve as parent) then the sibling currency
//     wallets.
//   • Idempotent — safe to call from multiple hot paths (org create,
//     invite accept, join-request approve, fetch endpoint safety-net).
//   • Never mutates balance — only creates missing shells.

import { Types } from "mongoose";
import { StoreWallet } from "../models/storeWallet.model";
import { Organization } from "../models/organization.model";
import {
  CRYPTOBRAND_EXTRA_CURRENCIES,
  CRYPTOBRAND_ALL_CURRENCIES,
} from "../config/cryptobrandCurrencies";

export interface EnsureResult {
  isCryptobrandOrg: boolean;
  createdCount: number;
  currencies: string[]; // The currencies now present for this (userId, orgId)
}

/**
 * Ensure the caller has all cryptobrand-currency wallets for this org.
 * No-op on non-cryptobrand orgs.
 */
export async function ensureCryptobrandWallets(
  userId: string,
  orgId: string,
): Promise<EnsureResult> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(orgId)) {
    return { isCryptobrandOrg: false, createdCount: 0, currencies: [] };
  }

  const org = await Organization.findById(orgId)
    .select("officeCreatedFromCryptobrand")
    .lean<{ officeCreatedFromCryptobrand?: boolean }>();
  if (!org?.officeCreatedFromCryptobrand) {
    return { isCryptobrandOrg: false, createdCount: 0, currencies: [] };
  }

  const createdCount = await ensureSiblingWalletsRaw(userId, orgId);

  // Persistent per-user deposit-address allocation. One address per
  // (currency, chain): BTC on bitcoin, ETH on ethereum, USDT × 3 on
  // (tron, polygon, bsc). Fire-and-forget with an internal catch —
  // wallet creation succeeded, and address allocation failing should
  // never revert the wallets. The watcher stack + admin sweeper stay
  // safe if a user's addresses aren't provisioned yet; they'll be
  // allocated on the next ensureCryptobrandWallets call, or via the
  // backfill script (scripts/backfill-user-crypto-addresses.ts).
  try {
    const { allocateUserAddressesFor } = await import("./userCryptoAddress");
    await allocateUserAddressesFor(userId, orgId);
  } catch (err) {
    console.error(
      `[cryptobrandWallets] userCryptoAddress allocation failed for ${userId}@${orgId}:`,
      (err as Error).message,
    );
  }

  return {
    isCryptobrandOrg: true,
    createdCount,
    currencies: [...CRYPTOBRAND_ALL_CURRENCIES],
  };
}

/**
 * Materialize the USD parent + INR/ETH/BTC sibling wallets for a
 * (userId, orgId) pair, WITHOUT checking the org's cryptobrand flag.
 *
 * Callers must have already decided this pair needs multi-currency
 * support (either because the org is a cryptobrand office, or because
 * an invoice's line item — e.g. `hifi_investment` — requires it).
 *
 * Returns the count of newly-created wallet documents. Idempotent —
 * calling repeatedly with the same pair after wallets exist is a no-op.
 */
async function ensureSiblingWalletsRaw(
  userId: string,
  orgId: string,
): Promise<number> {
  const userObjectId = new Types.ObjectId(userId);
  const orgObjectId = new Types.ObjectId(orgId);

  // Step 1 — USD wallet first. Needed as `parentWalletId` for the
  // siblings. Upsert-by-currency to survive the pre-migration unique
  // index on (userId, orgId) — after the index migration runs, this
  // is a plain findOne / create.
  let usdWallet = await StoreWallet.findOne({
    userId: userObjectId,
    orgId: orgObjectId,
    currency: "USD",
  });
  let createdCount = 0;
  if (!usdWallet) {
    usdWallet = await StoreWallet.create({
      userId: userObjectId,
      orgId: orgObjectId,
      currency: "USD",
      balance: 0,
      isActive: true,
      // Parent — no parentWalletId set.
    });
    createdCount += 1;
  }

  // Step 2 — sibling currency wallets. Skip any that already exist.
  const existingCurrencies = new Set(
    (
      await StoreWallet.find({
        userId: userObjectId,
        orgId: orgObjectId,
        currency: { $in: [...CRYPTOBRAND_EXTRA_CURRENCIES] },
      })
        .select("currency")
        .lean<Array<{ currency: string }>>()
    ).map((w) => w.currency),
  );

  for (const cur of CRYPTOBRAND_EXTRA_CURRENCIES) {
    if (existingCurrencies.has(cur)) continue;
    await StoreWallet.create({
      userId: userObjectId,
      orgId: orgObjectId,
      currency: cur,
      balance: 0,
      isActive: true,
      parentWalletId: usdWallet._id,
    });
    createdCount += 1;
  }

  return createdCount;
}

/**
 * Ensure multi-currency wallets for `userId` in the invoice's issuing
 * org — the invoice's own line items decide whether the ensure fires
 * even when the org isn't marked as a cryptobrand office.
 *
 * Fires on either:
 *   (a) `Organization.officeCreatedFromCryptobrand === true` — same
 *       trigger as `ensureCryptobrandWallets`, OR
 *   (b) any invoice line item has `itemType === "hifi_investment"` —
 *       HiFi bond/product invoices always need INR/ETH/BTC wallets on
 *       BOTH sides (buyer for at-parity debit, seller founder for the
 *       fulfillment credit), regardless of the seller org's flag. HiFi
 *       seller orgs are provisioned outside the cryptobrand-office code
 *       path so the flag is `false` there by default.
 *
 * No-op on any other invoice / org combination.
 */
export async function ensureMultiCurrencyWalletsForInvoice(
  userId: string,
  invoiceId: string,
): Promise<EnsureResult> {
  if (!Types.ObjectId.isValid(userId)) {
    return { isCryptobrandOrg: false, createdCount: 0, currencies: [] };
  }

  const { getInvoice } = await import("./invoice");
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    return { isCryptobrandOrg: false, createdCount: 0, currencies: [] };
  }

  const orgId = invoice.organizationId ? String(invoice.organizationId) : null;
  if (!orgId || !Types.ObjectId.isValid(orgId)) {
    return { isCryptobrandOrg: false, createdCount: 0, currencies: [] };
  }

  // Trigger (a) — cryptobrand-office flag on the org.
  const org = await Organization.findById(orgId)
    .select("officeCreatedFromCryptobrand")
    .lean<{ officeCreatedFromCryptobrand?: boolean }>();
  const cryptobrandOrg = !!org?.officeCreatedFromCryptobrand;

  // Trigger (b) — invoice line item indicates a multi-currency-native
  // product family. HiFi is the current member; add other product-type
  // slugs to this list as they ship.
  const MULTI_CURRENCY_ITEM_TYPES = new Set(["hifi_investment"]);
  const hasMultiCurrencyItem = (invoice.lineItems || []).some((li: any) =>
    MULTI_CURRENCY_ITEM_TYPES.has(li?.itemType),
  );

  if (!cryptobrandOrg && !hasMultiCurrencyItem) {
    return { isCryptobrandOrg: false, createdCount: 0, currencies: [] };
  }

  const createdCount = await ensureSiblingWalletsRaw(userId, orgId);
  return {
    isCryptobrandOrg: cryptobrandOrg,
    createdCount,
    currencies: [...CRYPTOBRAND_ALL_CURRENCIES],
  };
}

/**
 * Fire-and-forget wrapper for hot paths where wallet creation
 * shouldn't block the caller's response. Logs on failure.
 */
export function ensureCryptobrandWalletsFireAndForget(
  userId: string,
  orgId: string,
  context: string,
): void {
  ensureCryptobrandWallets(userId, orgId).catch((err) => {
    console.error(
      `[ensureCryptobrandWallets] ${context} failed userId=${userId} orgId=${orgId}:`,
      err?.message || err,
    );
  });
}
