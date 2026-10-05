import { ClientSession, Types } from "mongoose";
import { TerritoryWallet } from "../models/territoryWallet.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";

/**
 * Move USD from a user's TerritoryWallet (aggregate franchise earnings across
 * every country/territory/sub-territory they own) into their per-org
 * StoreWallet in a single Mongo transaction.
 *
 * Mirrors the shape of `transferCampaignToUserWallet`
 * (`services/campaignWallet.ts:666`) — one session, both audit rows written
 * inside it, cross-linked via metadata. No fee applies (matches the
 * NcWallet/CampaignWallet → Store pattern; the 5% platform cut only fires on
 * OUTFLOW paths like affiliate → store, which the territory ledger is not
 * subject to).
 *
 * Currency: V1 USD only. TerritoryWallet.currency defaults to USD; if a row
 * ever ships with anything else the transfer throws before touching balances.
 */
const round2 = (n: number) => Math.round(n * 100) / 100;
const centsToUsd = (cents: number) => round2(cents / 100);

export async function transferTerritoryToStoreWallet(params: {
  userId: string;
  orgId: string;
  amountCents: number;
  description: string;
  note?: string;
  session: ClientSession;
}): Promise<{
  territoryWallet: any;
  storeWallet: any;
  territoryTransaction: any;
  walletTransaction: any;
}> {
  const { userId, orgId, amountCents, description, note, session } = params;

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer");
  }
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid userId");
  }
  if (!Types.ObjectId.isValid(orgId)) {
    throw new Error("Invalid orgId");
  }

  const uid = new Types.ObjectId(userId);
  const oid = new Types.ObjectId(orgId);
  const amountUsd = centsToUsd(amountCents);

  // ── 1) Debit TerritoryWallet ───────────────────────────────────────
  const territoryWallet = await TerritoryWallet.findOne({ userId: uid }).session(
    session,
  );
  if (!territoryWallet) {
    throw new Error("Territory wallet not found for this user");
  }
  if ((territoryWallet as any).isActive === false) {
    throw new Error("Territory wallet is inactive");
  }
  if (territoryWallet.currency && territoryWallet.currency !== "USD") {
    throw new Error(
      `Transfer blocked: territory wallet currency is ${territoryWallet.currency}. V1 supports USD only.`,
    );
  }
  if (territoryWallet.balance < amountUsd) {
    throw new Error(
      `Insufficient territory wallet balance. Available: $${territoryWallet.balance.toFixed(
        2,
      )}, required: $${amountUsd.toFixed(2)}`,
    );
  }

  const twBefore = territoryWallet.balance;
  const twAfter = round2(twBefore - amountUsd);
  territoryWallet.balance = twAfter;
  territoryWallet.totalWithdrawn = round2(
    (territoryWallet.totalWithdrawn || 0) + amountUsd,
  );
  territoryWallet.lastTransactionAt = new Date();
  await territoryWallet.save({ session });

  // ── 2) Credit StoreWallet (lazy-create) + write its audit row ──────
  let sw = await StoreWallet.findOne({ userId: uid, orgId: oid }).session(
    session,
  );
  if (!sw) {
    const created = await StoreWallet.create(
      [{ userId: uid, orgId: oid, balance: 0, currency: "USD" }],
      { session },
    );
    sw = created[0];
  }
  const swBefore = sw.balance;
  const swAfter = round2(swBefore + amountUsd);
  sw.balance = swAfter;
  sw.lastTransactionAt = new Date();
  await sw.save({ session });

  const walletTransaction = (
    await WalletTransaction.create(
      [
        {
          storeWalletId: sw._id,
          walletType: "store",
          userId: uid,
          orgId: oid,
          type: "transfer",
          amount: amountUsd,
          currency: "USD",
          balanceBefore: swBefore,
          balanceAfter: swAfter,
          description,
          note,
          relatedUserId: uid,
          metadata: {
            source: "territory_wallet",
            action: "territory_transfer",
          },
          status: "completed",
        },
      ],
      { session },
    )
  )[0];

  // ── 3) TerritoryWalletTransaction audit row (source-side, withdrawal) ──
  // No entity attribution — the balance is a pool of many entities' credits;
  // the schema treats entity fields as conditional on type !== "withdrawal".
  const territoryTransaction = (
    await TerritoryWalletTransaction.create(
      [
        {
          territoryWalletId: territoryWallet._id,
          userId: uid,
          type: "withdrawal",
          amount: amountUsd,
          currency: "USD",
          description,
          balanceBefore: twBefore,
          balanceAfter: twAfter,
          status: "completed",
          metadata: {
            action: "transfer_to_store_wallet",
            destination: "store",
            destinationOrgId: String(oid),
            walletTransactionId: walletTransaction._id,
            note,
          },
        },
      ],
      { session },
    )
  )[0];

  // ── 4) Reverse-link the store-side row to the source audit row ─────
  // WalletTransaction.relatedTransactionId has ref:"WalletTransaction", so
  // the territory tx id lives in metadata instead.
  walletTransaction.metadata = {
    ...walletTransaction.metadata,
    territoryTransactionId: territoryTransaction._id,
  };
  await walletTransaction.save({ session });

  return {
    territoryWallet,
    storeWallet: sw,
    territoryTransaction,
    walletTransaction,
  };
}
