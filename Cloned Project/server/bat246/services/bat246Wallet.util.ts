/**
 * bat246Wallet.util.ts
 * Shared store-wallet credit helpers used by entry and leaderboard services.
 * Kept separate to avoid circular imports between those two services.
 */

const ALAN_K_EMAIL = "redbaron2020@mail.com";
const AT_BAT_TRANSFER_AMOUNT = 200;
const AT_BAT_THIRD_BASE_TRANSFER_AMOUNT = 100;

// POD "pre-bonus" split ratios — see bat246_pod_pay_structure.md for the
// full writeup. Whenever an AT-BAT-fill bonus (3rd Base green-card payment
// OR the flat Home Plate payment) is earned by a slot tagged with a
// podTeamId — i.e. its occupant is the 4th member of a completed POD cycle
// who has since climbed into a paying slot via successive board splits —
// the payment splits 70% to that occupant and 10% to EACH of the 3
// original POD teammates (30% total), instead of 100% solo.
const POD_SPLIT_MAIN_SHARE = 0.7;
const POD_SPLIT_TEAMMATE_SHARE = 0.1;

/**
 * Builds the recipient list + each one's share for a podTeamId-aware
 * AT-BAT-fill bonus payment. Shared by transferAtBatPayment (Home Plate)
 * and transferAtBatPaymentToThirdBase (3rd Base) — see
 * bat246_pod_pay_structure.md for the full spec and worked examples.
 *
 * - No podTeamId → 100% solo to the occupant (the default, non-POD case —
 *   the vast majority of both Home Plate and 3rd Base occupants).
 * - podTeamId present, origin board found, exactly 3 seat-holders (the
 *   normal case — a completed POD cycle always has exactly 3 by
 *   construction) → 70% to the occupant, 10% to each seat-holder with a
 *   linked Garage account. A seat-holder with no linked account (test/seed
 *   data) simply has their 10% share dropped, never redistributed to
 *   anyone else — same "skip silently, don't inflate someone else's cut"
 *   principle as everywhere else in this file.
 * - podTeamId present but the origin board can't be found, or doesn't have
 *   exactly 3 seat-holders (data anomaly) → defensive fallback to 100%
 *   solo, same as the no-podTeamId case, rather than a broken split.
 * - If the occupant's own account happens to coincide with one of the 3
 *   seat-holders (rare — e.g. a former teammate later became the occupant
 *   through some other path), their shares are combined into a single
 *   recipient entry rather than double-counted or dropped.
 */
async function buildPodSplitRecipients(
  mainGarageUserId: string,
  totalAmount: number,
  podTeamId?: string | null
): Promise<{ recipients: { garageUserId: string; amount: number }[]; isPodSplit: boolean }> {
  const solo = { recipients: [{ garageUserId: mainGarageUserId, amount: totalAmount }], isPodSplit: false };
  if (!podTeamId) return solo;

  const { Bat246Board } = require("../models/bat246Board.model");
  const { Bat246Player } = require("../models/bat246Player.model");

  const originBoard = await Bat246Board.findOne({ podTeamId }).select("pod").lean() as any;
  const seatOccupants = ((originBoard?.pod ?? []) as any[]).filter((s) => s?.playerId);
  if (seatOccupants.length !== 3) return solo;

  const seatPlayerIds = seatOccupants.map((s) => s.playerId.toString());
  const seatPlayers = await Bat246Player.find({ _id: { $in: seatPlayerIds } }).select("userId").lean() as any[];
  const seatGarageUserIds = seatPlayers.map((p) => p.userId?.toString()).filter(Boolean) as string[];

  const mainShare = Math.round(totalAmount * POD_SPLIT_MAIN_SHARE * 100) / 100;
  const teammateShare = Math.round(totalAmount * POD_SPLIT_TEAMMATE_SHARE * 100) / 100;

  const byUser = new Map<string, number>();
  byUser.set(mainGarageUserId, (byUser.get(mainGarageUserId) ?? 0) + mainShare);
  for (const uid of seatGarageUserIds) {
    byUser.set(uid, (byUser.get(uid) ?? 0) + teammateShare);
  }

  const recipients = Array.from(byUser.entries()).map(([garageUserId, amount]) => ({ garageUserId, amount }));
  return { recipients, isPodSplit: true };
}

/**
 * Debit $200 from Alan K's store wallet and credit $200 to the Home Plate
 * user's store wallet whenever a player lands on an AT BAT slot.
 *
 * If the Home Plate slot is tagged with a podTeamId (its occupant is the
 * 4th member of a completed POD cycle who has climbed all the way up to
 * Home Plate via successive board splits — see
 * buildPodSplitRecipients above and bat246_pod_pay_structure.md), the $200
 * splits 70% to Home Plate / 10% to each of the 3 original POD teammates
 * instead of 100% to Home Plate alone. A board split copies the 3rd Base
 * occupant onto BOTH resulting child boards' Home Plate simultaneously
 * (see bat246Split.service.ts), so this can independently pay out twice
 * per AT BAT fill cycle — once per child board — each still podTeamId-aware.
 *
 * Fully fail-safe — never throws, never blocks the entry flow.
 */
export async function transferAtBatPayment(
  homePlatePlayerId: string | null | undefined,
  homePlatePodTeamId?: string | null
): Promise<void> {
  if (!homePlatePlayerId) return;

  const { StoreWallet }      = require("../../models/storeWallet.model");
  const { WalletTransaction } = require("../../models/walletTransaction.model");
  const { User }             = require("../../models/user.model");
  const { Bat246Player }     = require("../models/bat246Player.model");
  const { Product }          = require("../../models/product.model");

  // Resolve orgId from the bat246_entry product (same source as creditRootHpUser)
  const entryProduct = await Product.findOne({ tags: "bat246_entry" }).select("organizationId").lean() as any;
  if (!entryProduct?.organizationId) return;
  const orgId = entryProduct.organizationId.toString();

  // Resolve Alan's garage userId
  const alanUser = await User.findOne({ email: ALAN_K_EMAIL }).select("_id").lean() as any;
  if (!alanUser) return;
  const alanUserId = alanUser._id.toString();

  // Resolve Home Plate player's garage userId
  const hpPlayer = await Bat246Player.findById(homePlatePlayerId).select("userId").lean() as any;
  if (!hpPlayer?.userId) return;
  const hpGarageUserId = hpPlayer.userId.toString();

  const { recipients, isPodSplit } = await buildPodSplitRecipients(hpGarageUserId, AT_BAT_TRANSFER_AMOUNT, homePlatePodTeamId);
  const amountToDebit = recipients.reduce((sum, r) => sum + r.amount, 0);
  if (amountToDebit <= 0) return;

  // Check Alan's wallet has sufficient balance. Admin balance figures are
  // never logged here — this is server-side only and reaches no player
  // (the caller always fire-and-forgets this into a local .catch()), but
  // keeping the actual number out of the message text is a cheap extra
  // guard against it ever leaking through logs/monitoring later.
  const alanWallet = await StoreWallet.findOne({ userId: alanUserId, orgId });
  if (!alanWallet || alanWallet.balance < amountToDebit) {
    console.warn("[bat246] AT BAT transfer skipped — insufficient admin wallet balance");
    return;
  }

  // Debit Alan
  const alanBefore = alanWallet.balance;
  alanWallet.balance = alanBefore - amountToDebit;
  alanWallet.lastTransactionAt = new Date();
  await alanWallet.save();
  await WalletTransaction.create({
    storeWalletId: alanWallet._id,
    walletType: "store",
    userId: alanUserId,
    orgId,
    type: "debit",
    amount: amountToDebit,
    currency: "USD",
    balanceBefore: alanBefore,
    balanceAfter: alanWallet.balance,
    description: `Bat246 AT BAT entry — payment to Home Plate${isPodSplit ? " (POD pre-bonus split across team of 4)" : ""}`,
    status: "completed",
  });

  // Credit each recipient their share
  for (const r of recipients) {
    await directCreditStoreWallet(
      r.garageUserId,
      orgId,
      r.amount,
      `Bat246 AT BAT entry payment${isPodSplit ? " (Home Plate — POD pre-bonus share)" : ""}`
    );
  }
}

/**
 * Debit $50 per Green Card (`salesCredits`, capped 0-2 — same convention as
 * the frontend's ppbGreens() display) that the 3rd Base occupant currently
 * has on THIS slot, from Alan K's store wallet, whenever a player lands on
 * an AT BAT slot — separate from, and in addition to, the $200 Home Plate
 * transfer above:
 *   0 Green Cards → $0 (no transfer at all)
 *   1 Green Card  → $50
 *   2 Green Cards → $100 (max)
 *
 * Normally the full amount is credited to the 3rd Base occupant alone. BUT
 * if this 3rd Base slot is tagged with a `podTeamId` — meaning its occupant
 * is the 4th member of a POD cycle who has since advanced all the way up to
 * 3rd Base (a slot's podTeamId travels forward through every board split,
 * see copySlot() in bat246Split.service.ts) — the amount instead splits
 * 70% to the 3rd Base occupant and 10% to EACH of the 3 original POD
 * seat-holders (`board.pod[0/1/2]` on the board where `podTeamId` was
 * assigned, found via `Bat246Board.findOne({ podTeamId })`; those 3 seats
 * never move on a split, only the 4th entrant's own slot does) — see
 * buildPodSplitRecipients above and bat246_pod_pay_structure.md:
 *   1 Green Card  → $35 occupant / $5 each teammate
 *   2 Green Cards → $70 occupant / $10 each teammate
 *
 * Scoped to a single board only: the caller always passes that board's own
 * thirdBase.playerId + thirdBase.salesCredits (+ thirdBase.podTeamId), so
 * this never crosses into a parent/child board except for the one
 * documented lookup above (finding the *origin* board of an already-known
 * podTeamId, not an arbitrary parent/child). Fully fail-safe — never
 * throws, never blocks the entry flow.
 */
export async function transferAtBatPaymentToThirdBase(
  thirdBasePlayerId: string | null | undefined,
  thirdBaseGreenCards: number | null | undefined,
  thirdBasePodTeamId?: string | null
): Promise<void> {
  if (!thirdBasePlayerId) return;

  const greenCards = Math.max(0, Math.min(2, thirdBaseGreenCards ?? 0));
  const totalAmount = greenCards * (AT_BAT_THIRD_BASE_TRANSFER_AMOUNT / 2); // $50/card, $100 max at 2 cards
  if (totalAmount <= 0) return; // 0 Green Cards — no sale, no payout

  const { StoreWallet }      = require("../../models/storeWallet.model");
  const { WalletTransaction } = require("../../models/walletTransaction.model");
  const { User }             = require("../../models/user.model");
  const { Bat246Player }     = require("../models/bat246Player.model");
  const { Product }          = require("../../models/product.model");

  // Resolve orgId from the bat246_entry product (same source as transferAtBatPayment)
  const entryProduct = await Product.findOne({ tags: "bat246_entry" }).select("organizationId").lean() as any;
  if (!entryProduct?.organizationId) return;
  const orgId = entryProduct.organizationId.toString();

  // Resolve Alan's garage userId
  const alanUser = await User.findOne({ email: ALAN_K_EMAIL }).select("_id").lean() as any;
  if (!alanUser) return;
  const alanUserId = alanUser._id.toString();

  // Resolve 3rd Base player's garage userId — some test/seed players have no
  // linked User (e.g. freshly-created identities with no real account), so
  // this can legitimately be missing; skip silently rather than crash.
  const thirdBasePlayer = await Bat246Player.findById(thirdBasePlayerId).select("userId").lean() as any;
  if (!thirdBasePlayer?.userId) return;
  const thirdBaseGarageUserId = thirdBasePlayer.userId.toString();

  const { recipients, isPodSplit } = await buildPodSplitRecipients(thirdBaseGarageUserId, totalAmount, thirdBasePodTeamId);

  // Debit Alan for exactly what's being paid out — never more than what
  // actually lands in a real wallet (an unresolvable teammate's share is
  // simply never debited either, not silently pocketed as a phantom charge).
  const amountToDebit = recipients.reduce((sum, r) => sum + r.amount, 0);
  if (amountToDebit <= 0) return;

  // Check Alan's wallet has sufficient balance. Same note as
  // transferAtBatPayment above — admin balance figure intentionally kept
  // out of the log message text.
  const alanWallet = await StoreWallet.findOne({ userId: alanUserId, orgId });
  if (!alanWallet || alanWallet.balance < amountToDebit) {
    console.warn("[bat246] AT BAT 3rd Base transfer skipped — insufficient admin wallet balance");
    return;
  }

  // Debit Alan
  const alanBefore = alanWallet.balance;
  alanWallet.balance = alanBefore - amountToDebit;
  alanWallet.lastTransactionAt = new Date();
  await alanWallet.save();
  await WalletTransaction.create({
    storeWalletId: alanWallet._id,
    walletType: "store",
    userId: alanUserId,
    orgId,
    type: "debit",
    amount: amountToDebit,
    currency: "USD",
    balanceBefore: alanBefore,
    balanceAfter: alanWallet.balance,
    description: `Bat246 AT BAT entry — payment to 3rd Base (${greenCards} Green Card${greenCards === 1 ? "" : "s"}${isPodSplit ? ", POD pre-bonus split across team of 4" : ""})`,
    status: "completed",
  });

  // Credit each recipient their share
  for (const r of recipients) {
    await directCreditStoreWallet(
      r.garageUserId,
      orgId,
      r.amount,
      `Bat246 AT BAT entry payment (3rd Base${isPodSplit ? " — POD pre-bonus share" : ""})`
    );
  }
}

/**
 * Every real BAT246 "earning" a distributor ever receives — AT-BAT
 * Home Plate/3rd-Base transfers and POD splits above, board sale revenue
 * and AT-BAT-fill payouts (bat246Entry.service.ts), Leaderboard trophy
 * payouts (bat246Leaderboard.service.ts), and the Lostmoney "No Wait"
 * auto-pay drip (bat246LostMoneyAutoPay.service.ts) — funnels through
 * this one function. That makes it the single choke point for Snap Back
 * Loan repayment: if the recipient has an outstanding loan,
 * applySnapBackLoanRepayment() diverts up to the full earning toward it
 * before anything reaches their spendable balance, same "100% until
 * repaid" rule the Lineup-1 pool already established for a different
 * pot of money. Every caller above needs zero changes — same precedent
 * ("the existing cash drip needed zero code changes") that already
 * applies here.
 */
export async function directCreditStoreWallet(
  userId: string,
  orgId: string,
  amount: number,
  description: string,
  dedupeKey?: string
): Promise<void> {
  if (amount <= 0) return;
  const { StoreWallet } = require("../../models/storeWallet.model");
  const { WalletTransaction } = require("../../models/walletTransaction.model");
  const { applySnapBackLoanRepayment } = require("./bat246SnapBackLoan.service");

  const { divert, remainder } = await applySnapBackLoanRepayment(userId, amount, description);
  if (divert > 0) {
    // Logged so the borrower's own StoreWallet transaction history stays
    // honest about what happened to an earning that never reached their
    // spendable balance — same StoreWallet/WalletTransaction pair every
    // other entry in this file writes, just tagged as a loan repayment
    // rather than a plain credit (no balance change here: the loan
    // ledger, not the wallet, tracks this money).
    let wallet = await StoreWallet.findOne({ userId, orgId });
    if (!wallet) {
      wallet = await StoreWallet.create({ userId, orgId, balance: 0, currency: "USD" });
    }
    await WalletTransaction.create({
      storeWalletId: wallet._id,
      walletType: "store",
      userId,
      orgId,
      type: "credit",
      amount: divert,
      currency: "USD",
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      description: `Snap Back Loan repayment (from: ${description})`,
      status: "completed",
      metadata: { snapBackLoanRepayment: true },
    });
  }
  if (remainder <= 0) return; // fully absorbed by the loan

  let wallet = await StoreWallet.findOne({ userId, orgId });
  if (!wallet) {
    wallet = await StoreWallet.create({ userId, orgId, balance: 0, currency: "USD" });
  }
  const before = wallet.balance;
  wallet.balance = before + remainder;
  wallet.lastTransactionAt = new Date();
  await wallet.save();
  await WalletTransaction.create({
    storeWalletId: wallet._id,
    walletType: "store",
    userId,
    orgId,
    type: "credit",
    amount: remainder,
    currency: "USD",
    balanceBefore: before,
    balanceAfter: wallet.balance,
    description,
    status: "completed",
    ...(dedupeKey ? { metadata: { dedupeKey } } : {}),
  });
}

/**
 * Debits a store wallet WITHOUT a balance check and WITHOUT the schema's
 * `balance: { min: 0 }` guard — the one place in this codebase a store
 * wallet is deliberately allowed to go negative. Used only by the Bat246
 * monthly membership fee (bat246MembershipBilling.service.ts): if the
 * member doesn't have $12, the fee still goes through and their wallet
 * carries the deficit rather than the membership being blocked/suspended.
 * Every other debit in this codebase (transferAtBatPayment, etc.) checks
 * balance first and skips instead — this is intentionally different.
 *
 * `updateOne`/`$inc` bypasses Mongoose's document validators (which only
 * run on `save()`/`create()`), which is what lets this go below zero; a
 * `dedupeKey` may be passed so the caller's billing sweeper can never
 * double-charge the same cycle even under a rare concurrent re-run.
 */
export async function directDebitStoreWalletAllowNegative(
  userId: string,
  orgId: string,
  amount: number,
  description: string,
  dedupeKey?: string
): Promise<void> {
  if (amount <= 0) return;
  const { StoreWallet } = require("../../models/storeWallet.model");
  const { WalletTransaction } = require("../../models/walletTransaction.model");

  let wallet = await StoreWallet.findOne({ userId, orgId });
  if (!wallet) {
    wallet = await StoreWallet.create({ userId, orgId, balance: 0, currency: "USD" });
  }
  const before = wallet.balance;
  const after = before - amount;
  await StoreWallet.updateOne(
    { _id: wallet._id },
    { $inc: { balance: -amount }, $set: { lastTransactionAt: new Date() } }
  );
  await WalletTransaction.create({
    storeWalletId: wallet._id,
    walletType: "store",
    userId,
    orgId,
    type: "debit",
    amount,
    currency: "USD",
    balanceBefore: before,
    balanceAfter: after,
    description,
    status: "completed",
    ...(dedupeKey ? { metadata: { dedupeKey } } : {}),
  });
}
