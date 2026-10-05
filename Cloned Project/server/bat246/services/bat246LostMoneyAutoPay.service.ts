/**
 * bat246LostMoneyAutoPay.service.ts
 *
 * Automatic 3%-of-sale drip into the Lost Money repayment queue.
 *
 * On every REAL Bat246 sale ($650 Board Entry or $160 POD Entry — never on
 * admin manual placements, which always pass saleAmount: 0), 3% of the sale
 * is debited from Alan K's own Garage wallet and deposited into the wallet
 * of whoever is first in line on the Lost Money Paid List. Same
 * debit-Alan-then-credit-recipient accounting style as the existing $200 AT
 * BAT bonus and the $50/$100 3rd Base bonus in bat246Wallet.util.ts.
 *
 * Kept as its own file (not bat246Wallet.util.ts / bat246Entry.service.ts)
 * to avoid circular imports, same reasoning already documented at the top
 * of bat246Wallet.util.ts.
 *
 * "Round" mechanics: each person's approved claim is paid out in rounds of
 * up to $300 (their final round can be smaller, whatever's left on the
 * claim). Money is deposited into their real wallet immediately, every
 * sale, in small increments — but the PUBLIC-facing totalPaid field (and
 * the public visibility / end-of-line reordering that key off it) only
 * jumps once a full round completes. Partial in-progress rounds are
 * tracked in roundAccumulated and stay invisible until they finish.
 *
 * Fully fail-safe — every call site fire-and-forgets this into a
 * .catch(), so a bug here can never block a real purchase or board
 * placement, which have already 100% completed by the time this runs.
 */

const ALAN_K_EMAIL = "redbaron2020@mail.com";
const AUTO_PAY_ROUND_TARGET = 300;
const AUTO_PAY_PERCENT = 0.03;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function runLostMoneyAutoPay(saleAmount: number): Promise<void> {
  try {
    if (!Number.isFinite(saleAmount) || saleAmount <= 0) return;

    const { Bat246LostMoneyPaymentSettings } = require("../models/bat246LostMoneyPaymentSettings.model");
    const settings = await Bat246LostMoneyPaymentSettings.findOne().select("paymentsEnabled").lean() as any;
    if (settings?.paymentsEnabled === false) return; // paused — do nothing at all, money simply stays with Alan

    const cut = round2(saleAmount * AUTO_PAY_PERCENT);
    if (cut <= 0) return;

    const { Product } = require("../../models/product.model");
    const entryProduct = await Product.findOne({ tags: "bat246_entry" }).select("organizationId").lean() as any;
    if (!entryProduct?.organizationId) return;
    const orgId = entryProduct.organizationId.toString();

    const { User } = require("../../models/user.model");
    const alanUser = await User.findOne({ email: ALAN_K_EMAIL }).select("_id").lean() as any;
    if (!alanUser) return;
    const alanUserId = alanUser._id.toString();

    const { Bat246LostMoneyPaid } = require("../models/bat246LostMoneyPaid.model");

    // ── Pass 1: simulate the queue walk in memory, no writes yet ──────────
    // Only people with a linked Garage account can receive an automated
    // wallet deposit — entries added by name only (no account) are simply
    // not eligible for the automatic rotation.
    type PlanRow = { person: any; applyAmount: number; roundTarget: number; finalize: boolean };
    const plan: PlanRow[] = [];
    const skipIds: string[] = [];
    let remainingCut = cut;
    let guard = 0;

    while (remainingCut > 0.004 && guard < 25) {
      guard++;
      const person = await Bat246LostMoneyPaid.findOne({
        fullyRepaid: { $ne: true },
        userId: { $ne: null },
        _id: { $nin: skipIds },
        // 90-day waiting period gate (bat246LostMoneyPaid.model.ts /
        // bat246LostMoney.routes.ts): skip anyone still parked in the "90
        // Days Waiting Period" admin grid — same ACTIVE_LINEUP_FILTER used
        // there. Legacy rows (field never set) count as already-active.
        $or: [{ movedToLineupAt: { $exists: false } }, { movedToLineupAt: { $ne: null } }],
      }).sort({ order: 1 });
      if (!person) break; // nobody left eligible this pass — leftover cut is simply not paid out

      const remainingApproved = person.approvedAmount - person.totalPaid;
      if (remainingApproved <= 0) {
        // Stale-state safety net — totalPaid already caught up with
        // approvedAmount but fullyRepaid wasn't set. Fix it and move on,
        // regardless of whether Alan's balance covers this sale's cut
        // (no money involved in this correction).
        await Bat246LostMoneyPaid.updateOne({ _id: person._id }, { $set: { fullyRepaid: true } });
        skipIds.push(person._id.toString());
        continue;
      }

      const roundTarget = Math.min(AUTO_PAY_ROUND_TARGET, remainingApproved);
      const spaceLeft = round2(Math.max(0, roundTarget - person.roundAccumulated));
      if (spaceLeft <= 0) {
        skipIds.push(person._id.toString());
        continue;
      }

      const applied = round2(Math.min(remainingCut, spaceLeft));
      if (applied <= 0) break;

      plan.push({ person, applyAmount: applied, roundTarget, finalize: applied >= spaceLeft });
      skipIds.push(person._id.toString()); // this person is spoken for this sale — don't revisit in this same pass
      remainingCut = round2(remainingCut - applied);
    }

    if (plan.length === 0) return; // nobody eligible at all — nothing debited, nothing credited

    const totalToDebit = round2(plan.reduce((sum, r) => sum + r.applyAmount, 0));
    if (totalToDebit <= 0) return;

    // ── Balance check BEFORE any writes — never leave bookkeeping and real
    // money out of sync ─────────────────────────────────────────────────
    const { StoreWallet } = require("../../models/storeWallet.model");
    const { WalletTransaction } = require("../../models/walletTransaction.model");
    const { directCreditStoreWallet } = require("./bat246Wallet.util");
    const { Bat246LostMoneyPayment } = require("../models/bat246LostMoneyPayment.model");

    const alanWallet = await StoreWallet.findOne({ userId: alanUserId, orgId });
    if (!alanWallet || alanWallet.balance < totalToDebit) {
      console.warn("[bat246] Lost Money auto-pay skipped — insufficient admin wallet balance");
      return;
    }

    // ── Pass 2: commit — debit Alan once, credit each recipient ───────────
    const alanBefore = alanWallet.balance;
    alanWallet.balance = alanBefore - totalToDebit;
    alanWallet.lastTransactionAt = new Date();
    await alanWallet.save();
    await WalletTransaction.create({
      storeWalletId: alanWallet._id,
      walletType: "store",
      userId: alanUserId,
      orgId,
      type: "debit",
      amount: totalToDebit,
      currency: "USD",
      balanceBefore: alanBefore,
      balanceAfter: alanWallet.balance,
      description: "Bat246 Lost Money auto-pay (3% of sale)",
      status: "completed",
    });

    for (const row of plan) {
      const { person, applyAmount, roundTarget, finalize } = row;
      const garageUserId = person.userId.toString();

      await directCreditStoreWallet(garageUserId, orgId, applyAmount, "Bat246 Lost Money auto-pay");

      person.roundAccumulated = round2(person.roundAccumulated + applyAmount);

      if (finalize) {
        person.totalPaid = round2(person.totalPaid + roundTarget);
        person.lastPaymentAmount = roundTarget;
        person.lastPaymentAt = new Date();
        person.roundAccumulated = 0;
        if (person.totalPaid >= person.approvedAmount) person.fullyRepaid = true;

        const highest = await Bat246LostMoneyPaid.findOne().sort({ order: -1 }).select("order").lean() as any;
        person.order = (highest?.order ?? 0) + 1; // → end of the line

        await person.save();
        await Bat246LostMoneyPayment.create({
          paidEntryId: person._id,
          amount: roundTarget,
          recordedByEmail: "system",
          note: "Automated 3% sale drip",
          source: "auto",
        });
      } else {
        await person.save();
      }
    }
  } catch (err: any) {
    console.error("[bat246] Lost Money auto-pay failed:", err?.message);
  }
}
