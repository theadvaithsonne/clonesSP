import { Types } from "mongoose";
import {
  AivatarWalletTransaction,
  AivatarWalletTransactionType,
  AivatarWalletTransactionSource,
  IAivatarWalletTransaction,
} from "../models/aivatarWalletTransaction.model";

export interface RecordTransactionParams {
  walletId: Types.ObjectId;
  orgId: Types.ObjectId;
  type: AivatarWalletTransactionType;
  amount: number;        // cents, always positive
  balanceAfter: number;  // cents
  debtAfter: number;     // cents
  source: AivatarWalletTransactionSource;
  description: string;
  adminEmail?: string;
  note?: string;
  idempotencyKey?: string;
}

/**
 * Insert a transaction row for a wallet mutation. Idempotent when an
 * idempotencyKey is supplied: a duplicate insert returns the prior row
 * instead of creating a new one.
 */
export async function recordTransaction(
  params: RecordTransactionParams
): Promise<IAivatarWalletTransaction> {
  if (params.idempotencyKey) {
    const existing = await AivatarWalletTransaction.findOne({
      idempotencyKey: params.idempotencyKey,
    });
    if (existing) return existing;
  }

  try {
    return await AivatarWalletTransaction.create(params);
  } catch (err: any) {
    // Race: parallel inserts with the same idempotencyKey. The unique
    // sparse index rejects the loser; re-fetch and return the winner.
    if (params.idempotencyKey && err?.code === 11000) {
      const existing = await AivatarWalletTransaction.findOne({
        idempotencyKey: params.idempotencyKey,
      });
      if (existing) return existing;
    }
    throw err;
  }
}
