import { Types } from "mongoose";
import { AivatarWallet, IAivatarWallet } from "../models/aivatarWallet.model";
import { recordTransaction } from "./aivatarWalletTransaction.service";

export const ENRICH_COST_CENTS = 10;
export const MAX_DEBT_CENTS = 200;
export const WELCOME_BONUS_CENTS = 2500;

export class InsufficientBalanceError extends Error {
  constructor(balance: number) {
    super(
      `Insufficient wallet balance. Current balance: $${(balance / 100).toFixed(2)}. ` +
      `Please add credits.`
    );
    this.name = "InsufficientBalanceError";
  }
}

export class DebtLimitReachedError extends Error {
  constructor(debt: number) {
    super(
      `Debt limit reached ($${(debt / 100).toFixed(2)}/$${(MAX_DEBT_CENTS / 100).toFixed(2)}). ` +
      `Please add credits to clear your debt and continue.`
    );
    this.name = "DebtLimitReachedError";
  }
}

export interface MutatorOptions {
  source?: "user" | "admin" | "system"; // default "system"
  adminEmail?: string;
  note?: string;
  idempotencyKey?: string;
}

export async function getOrCreateAivatarWallet(orgId: string): Promise<IAivatarWallet> {
  const oid = new Types.ObjectId(orgId);
  let wallet = await AivatarWallet.findOne({ orgId: oid });
  if (!wallet) {
    wallet = await AivatarWallet.create({ orgId: oid, balance: 0, debt: 0 });
  }
  return wallet;
}

export async function deductAivatarCreditsWithDebt(
  orgId: string,
  amountCents: number,
  description: string,
  options: MutatorOptions = {}
): Promise<{ wallet: IAivatarWallet; deductedFromBalance: number; addedToDebt: number }> {
  const wallet = await getOrCreateAivatarWallet(orgId);

  if (wallet.debt >= MAX_DEBT_CENTS) {
    throw new DebtLimitReachedError(wallet.debt);
  }

  const currentBalance = wallet.balance;
  let deductedFromBalance: number;
  let addedToDebt: number;

  if (currentBalance >= amountCents) {
    deductedFromBalance = amountCents;
    addedToDebt = 0;
  } else {
    deductedFromBalance = currentBalance;
    const remainder = amountCents - currentBalance;
    const debtRoom = Math.max(0, MAX_DEBT_CENTS - wallet.debt);
    addedToDebt = Math.min(remainder, debtRoom);
  }

  const balanceAfter = currentBalance - deductedFromBalance;
  const debtAfter = wallet.debt + addedToDebt;
  const now = new Date();

  const updated = await AivatarWallet.findOneAndUpdate(
    { orgId: wallet.orgId },
    {
      $inc: { balance: -deductedFromBalance, debt: addedToDebt },
      $set: { lastTransactionAt: now },
    },
    { new: true }
  );

  await recordTransaction({
    walletId: wallet._id,
    orgId: wallet.orgId,
    type: "debit",
    amount: amountCents,
    balanceAfter,
    debtAfter,
    source: options.source ?? "system",
    adminEmail: options.adminEmail,
    note: options.note,
    description: addedToDebt > 0
      ? `${description} (partial — $${(addedToDebt / 100).toFixed(2)} added to debt)`
      : description,
    idempotencyKey: options.idempotencyKey,
  });

  return {
    wallet: updated!,
    deductedFromBalance,
    addedToDebt,
  };
}

export async function addAivatarCredits(
  orgId: string,
  amountCents: number,
  description: string,
  options: MutatorOptions = {}
): Promise<IAivatarWallet> {
  const existing = await getOrCreateAivatarWallet(orgId);
  const currentDebt = existing.debt || 0;

  let creditToBalance: number;
  let debtCleared: number;
  if (currentDebt > 0) {
    debtCleared = Math.min(currentDebt, amountCents);
    creditToBalance = amountCents - debtCleared;
  } else {
    debtCleared = 0;
    creditToBalance = amountCents;
  }

  const balanceAfter = existing.balance + creditToBalance;
  const debtAfter = currentDebt - debtCleared;
  const now = new Date();

  const inc: Record<string, number> = { balance: creditToBalance };
  if (debtCleared > 0) inc.debt = -debtCleared;

  const updated = await AivatarWallet.findOneAndUpdate(
    { orgId: existing.orgId },
    { $inc: inc, $set: { lastTransactionAt: now } },
    { new: true, upsert: true }
  );

  await recordTransaction({
    walletId: existing._id,
    orgId: existing.orgId,
    type: "credit",
    amount: amountCents,
    balanceAfter,
    debtAfter,
    source: options.source ?? "system",
    adminEmail: options.adminEmail,
    note: options.note,
    description: debtCleared > 0
      ? `${description} ($${(debtCleared / 100).toFixed(2)} used to clear debt)`
      : description,
    idempotencyKey: options.idempotencyKey,
  });

  return updated!;
}

/** Admin-only: zero out a wallet's debt without requiring a credit. */
export async function clearAivatarDebt(
  orgId: string,
  options: MutatorOptions & { adminEmail: string; note: string }
): Promise<IAivatarWallet> {
  const wallet = await getOrCreateAivatarWallet(orgId);
  if (wallet.debt === 0) {
    return wallet;
  }
  const debtBefore = wallet.debt;
  const now = new Date();

  const updated = await AivatarWallet.findOneAndUpdate(
    { orgId: wallet.orgId },
    { $set: { debt: 0, lastTransactionAt: now } },
    { new: true }
  );

  await recordTransaction({
    walletId: wallet._id,
    orgId: wallet.orgId,
    type: "clear_debt",
    amount: debtBefore,
    balanceAfter: wallet.balance,
    debtAfter: 0,
    source: "admin",
    adminEmail: options.adminEmail,
    note: options.note,
    description: `Admin cleared $${(debtBefore / 100).toFixed(2)} of debt`,
    idempotencyKey: options.idempotencyKey,
  });

  return updated!;
}
