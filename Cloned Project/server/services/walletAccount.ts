// src/services/walletAccount.ts
// Thin service for per-wallet payout accounts (bank + crypto).
// Mirrors the upsert pattern from the legacy /wallet/bank-details handler,
// keyed by the wallet slot { userId, walletType, orgId, accountType }.

import { Types } from "mongoose";
import {
  WalletAccount,
  WalletAccountWalletType,
  WalletAccountType,
} from "../models/walletAccount.model";

/** Normalize orgId: a real ObjectId for store wallets, null otherwise. */
function resolveOrgId(
  walletType: WalletAccountWalletType,
  orgId?: string | null
): Types.ObjectId | null {
  if (walletType !== "store") return null;
  if (!orgId) return null;
  return new Types.ObjectId(orgId);
}

/** All accounts (≤2) for a given wallet slot, belonging to the user. */
export async function getWalletAccounts(
  userId: string,
  walletType: WalletAccountWalletType,
  orgId?: string | null
): Promise<any[]> {
  const filter: any = {
    userId: new Types.ObjectId(userId),
    walletType,
    orgId: resolveOrgId(walletType, orgId),
  };
  return WalletAccount.find(filter).sort({ accountType: 1 }).lean();
}

/**
 * Upsert one account by its wallet slot key. accountType decides which field
 * set is meaningful; the caller (route) validates the shape first.
 */
export async function upsertWalletAccount(params: {
  userId: string;
  walletType: WalletAccountWalletType;
  orgId?: string | null;
  accountType: WalletAccountType;
  data: Record<string, any>;
}): Promise<any> {
  const { userId, walletType, accountType, data } = params;
  const orgId = resolveOrgId(walletType, params.orgId);

  if (walletType === "store" && !orgId) {
    throw new Error("orgId is required for store wallet accounts");
  }

  const key = {
    userId: new Types.ObjectId(userId),
    walletType,
    orgId,
    accountType,
  };

  return WalletAccount.findOneAndUpdate(
    key,
    { ...data, ...key, isActive: true },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
}

/** Delete an account, scoped to the owning user. Returns true if removed. */
export async function deleteWalletAccount(
  userId: string,
  accountId: string
): Promise<boolean> {
  if (!Types.ObjectId.isValid(accountId)) return false;
  const res = await WalletAccount.deleteOne({
    _id: new Types.ObjectId(accountId),
    userId: new Types.ObjectId(userId),
  });
  return res.deletedCount > 0;
}

/** Admin/read helper: every account for a user across all wallets. */
export async function getAllWalletAccountsForUser(
  userId: string
): Promise<any[]> {
  return WalletAccount.find({ userId: new Types.ObjectId(userId) }).lean();
}
