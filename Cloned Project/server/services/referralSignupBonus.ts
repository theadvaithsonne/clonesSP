import mongoose, { Types } from "mongoose";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { ReferralBonusConfig } from "../models/referralBonusConfig.model";
import { ReferralBonusPayout } from "../models/referralBonusPayout.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "./commission";

/**
 * Global signup referral bonus.
 *
 * When a referred user completes their profile, BOTH sides are paid the
 * configured amount: the referrer for bringing them, the new user for
 * arriving. Funded by debiting the platform's store wallet (Shorupan /
 * Garage HQ) — so this is real money leaving the platform, not an accrual.
 *
 * ── Why STORE wallets, not affiliate wallets ─────────────────────────────
 * `creditAffiliateOrPlatform` looks like the obvious helper, but it gates on
 * the recipient holding an active Unilevel Plus licence: without one it shows
 * the balance in their affiliate wallet while routing the ACTUAL money to the
 * platform. A brand-new signup never holds a licence, so that path would have
 * the platform debit itself and re-credit itself, leaving the new user with a
 * balance they cannot spend. Store wallets carry no such lock.
 *
 * ── Which org's store wallet ─────────────────────────────────────────────
 * Store wallets are keyed (userId, orgId). Each side is paid into the wallet
 * for the org they actually joined — `organizations[0]`, which is Garage HQ
 * for ~95% of users and their own white-label org for the rest. Paying into a
 * fixed org would put money in a wallet white-label users never see.
 *
 * ── Safety ───────────────────────────────────────────────────────────────
 * - Idempotent on `ReferralBonusPayout.refereeUserId` (unique index). Profile
 *   completion can fire repeatedly; without this every edit pays again.
 * - Skips (loudly) when the platform wallet cannot cover the pair — nobody
 *   gets a balance the platform can't back.
 * - Never throws. A wallet problem must never cost someone their profile save.
 */

export type ReferralBonusResult =
  | "paid"
  | "already_paid"
  | "no_referrer"
  | "disabled"
  | "insufficient_platform_balance"
  | "skipped";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whichever org this user actually joined. */
function primaryOrgId(user: any): string | null {
  const org = user?.organizations?.[0]?.organization;
  return org ? String(org) : null;
}

export async function payReferralSignupBonus(
  userOrId: any
): Promise<ReferralBonusResult> {
  try {
    const config: any = await ReferralBonusConfig.findOne({ key: "global" }).lean();
    // Absent config = feature off. Never fall back to a default amount: a
    // bonus that starts paying because a row is missing is the wrong failure.
    if (!config || !config.isActive || !(config.amountUsd > 0)) return "disabled";

    const amount = round2(config.amountUsd);
    const total = round2(amount * 2);

    const referee: any =
      typeof userOrId === "string" || userOrId instanceof Types.ObjectId
        ? await User.findById(String(userOrId)).lean()
        : userOrId;
    if (!referee) return "skipped";
    if (!referee.referredBy) return "no_referrer";

    const refereeId = new Types.ObjectId(String(referee._id));
    const referrerId = new Types.ObjectId(String(referee.referredBy));

    // Nobody should be paid for referring themselves.
    if (String(refereeId) === String(referrerId)) return "skipped";

    // Cheap pre-check. The unique index below is the real guarantee — this
    // just avoids opening a transaction for the common repeat case.
    if (await ReferralBonusPayout.exists({ refereeUserId: refereeId })) {
      return "already_paid";
    }

    const referrer: any = await User.findById(referrerId)
      .select("organizations email name")
      .lean();
    if (!referrer) return "skipped";

    const refereeOrg = primaryOrgId(referee);
    const referrerOrg = primaryOrgId(referrer);
    if (!refereeOrg || !referrerOrg) {
      console.warn(
        `[referral-bonus] Skipping ${referee.email}: missing org membership (referee=${refereeOrg}, referrer=${referrerOrg})`
      );
      return "skipped";
    }

    const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
      .select("_id")
      .lean();
    if (!platformUser) {
      console.error(`[referral-bonus] Platform user ${PLATFORM_USER_EMAIL} not found`);
      return "skipped";
    }

    // `currency` MUST be pinned. Cryptobrand orgs hold INR/ETH/BTC siblings
    // beside the USD wallet, and a bare {userId, orgId} match resolves through
    // the {userId, orgId, currency} unique index — where "BTC" sorts first — so
    // an unpinned lookup silently returns the BTC wallet. See the same note on
    // getStoreWalletBalance in services/wallet.ts, which fixed the read path
    // and left the write paths to select their own wallet.
    const platformWallet: any = await StoreWallet.findOne({
      userId: platformUser._id,
      orgId: new Types.ObjectId(PLATFORM_ORG_ID),
      currency: "USD",
    });
    if (!platformWallet || (platformWallet.balance || 0) < total) {
      console.error(
        `[referral-bonus] INSUFFICIENT PLATFORM BALANCE — need $${total}, have $${platformWallet?.balance ?? 0}. ` +
          `Skipping bonus for ${referee.email}. Top up the platform store wallet to resume payouts.`
      );
      return "insufficient_platform_balance";
    }

    const session = await mongoose.startSession();
    // Annotated wide on purpose: TS narrows to the initialiser because the
    // assignment happens inside the withTransaction callback it cannot follow.
    let result = "skipped" as ReferralBonusResult;
    let payoutId: Types.ObjectId | null = null;
    try {
      await session.withTransaction(async () => {
        // ── Debit the platform ──
        const pw: any = await StoreWallet.findById(platformWallet._id).session(session);
        const pBefore = pw.balance;
        const pAfter = round2(pBefore - total);
        if (pAfter < 0) throw new Error("platform balance went negative mid-transaction");
        pw.balance = pAfter;
        pw.lastTransactionAt = new Date();
        await pw.save({ session });

        const platformTxn = await WalletTransaction.create(
          [
            {
              storeWalletId: pw._id,
              walletType: "store",
              userId: platformUser._id,
              orgId: new Types.ObjectId(PLATFORM_ORG_ID),
              type: "debit",
              amount: total,
              currency: "USD",
              balanceBefore: pBefore,
              balanceAfter: pAfter,
              description: "Signup referral bonus",
              note: `$${amount} to referrer + $${amount} to new user (${referee.email})`,
              relatedUserId: refereeId,
              metadata: {
                kind: "referral_signup_bonus",
                refereeUserId: String(refereeId),
                referrerUserId: String(referrerId),
                amountEach: amount,
              },
              status: "completed",
            },
          ],
          { session }
        ).then((d) => d[0]);

        // ── Credit each side's own store wallet ──
        const credit = async (
          uid: Types.ObjectId,
          orgId: string,
          description: string,
          note: string
        ) => {
          // Pinned for the same reason as the platform lookup above: an
          // unpinned match credits the recipient's BTC wallet, where the money
          // is real but invisible on the USD balance they actually see.
          let w: any = await StoreWallet.findOne({
            userId: uid,
            orgId: new Types.ObjectId(orgId),
            currency: "USD",
          }).session(session);
          if (!w) {
            w = (
              await StoreWallet.create(
                [
                  {
                    userId: uid,
                    orgId: new Types.ObjectId(orgId),
                    balance: 0,
                    currency: "USD",
                  },
                ],
                { session }
              )
            )[0];
          }
          const before = w.balance || 0;
          const after = round2(before + amount);
          w.balance = after;
          w.lastTransactionAt = new Date();
          await w.save({ session });

          return WalletTransaction.create(
            [
              {
                storeWalletId: w._id,
                walletType: "store",
                userId: uid,
                orgId: new Types.ObjectId(orgId),
                type: "credit",
                amount,
                currency: "USD",
                balanceBefore: before,
                balanceAfter: after,
                description,
                note,
                relatedUserId:
                  String(uid) === String(refereeId) ? referrerId : refereeId,
                metadata: {
                  kind: "referral_signup_bonus",
                  role:
                    String(uid) === String(refereeId) ? "referee" : "referrer",
                  refereeUserId: String(refereeId),
                  referrerUserId: String(referrerId),
                },
                status: "completed",
              },
            ],
            { session }
          ).then((d) => d[0]);
        };

        const referrerTxn = await credit(
          referrerId,
          referrerOrg,
          "Referral bonus",
          `${referee.email} signed up using your referral`
        );
        const refereeTxn = await credit(
          refereeId,
          refereeOrg,
          "Welcome bonus",
          "For joining through a referral"
        );

        // Written INSIDE the transaction: the unique index on refereeUserId is
        // what makes a concurrent second call fail rather than double-pay.
        const payoutDoc = await ReferralBonusPayout.create(
          [
            {
              refereeUserId: refereeId,
              referrerUserId: referrerId,
              amountUsd: amount,
              totalDebitedUsd: total,
              refereeOrgId: new Types.ObjectId(refereeOrg),
              referrerOrgId: new Types.ObjectId(referrerOrg),
              refereeTransactionId: refereeTxn._id,
              referrerTransactionId: referrerTxn._id,
              platformTransactionId: platformTxn._id,
            },
          ],
          { session }
        );
        payoutId = payoutDoc[0]._id;

        result = "paid";
      });

      if (result === "paid") {
        console.log(
          `[referral-bonus] Paid $${amount} each to referrer ${referrer.email} and referee ${referee.email} ($${total} from platform)`
        );

        // AFTER the commit, never inside it. A rollback must not leave behind
        // an email announcing money that was never paid, and Resend has no
        // undo. Not awaited: the caller is a profile save, and an email that
        // is merely slow must not hold that request open.
        void notifyPaid({
          payoutId,
          amount,
          referrer: {
            email: referrer.email,
            name: referrer.name,
            orgId: referrerOrg,
          },
          referee: {
            email: referee.email,
            name: referee.name,
            orgId: refereeOrg,
          },
        });
      }
      return result;
    } finally {
      await session.endSession();
    }
  } catch (err: any) {
    // A duplicate key here means a concurrent call won the race — correct
    // behaviour, not an error worth shouting about.
    if (err?.code === 11000) return "already_paid";
    console.error("[referral-bonus] payout failed:", err?.message);
    return "skipped";
  }
}


/**
 * Sends both notifications and stamps the payout row with what went out.
 *
 * Deliberately swallows everything: by the time this runs the wallets have
 * already been written, so a mail failure is a missing notification, not a
 * failed payout, and must never surface as one. The stamp is what makes such
 * a failure visible afterwards — an unsent side shows as a blank timestamp on
 * the row rather than vanishing.
 */
async function notifyPaid(args: {
  payoutId: Types.ObjectId | null;
  amount: number;
  referrer: { email?: string; name?: string; orgId: string };
  referee: { email?: string; name?: string; orgId: string };
}): Promise<void> {
  try {
    const { sendReferralBonusEmails } = await import("./referralBonusEmail");
    const { referrerSent, refereeSent } = await sendReferralBonusEmails({
      amount: args.amount,
      referrer: args.referrer,
      referee: args.referee,
    });

    if (args.payoutId && (referrerSent || refereeSent)) {
      const now = new Date();
      const stamp: any = {};
      if (referrerSent) stamp.referrerEmailedAt = now;
      if (refereeSent) stamp.refereeEmailedAt = now;
      await ReferralBonusPayout.updateOne(
        { _id: args.payoutId },
        { $set: stamp }
      );
    }
  } catch (err: any) {
    console.error("[referral-bonus] notification failed:", err?.message);
  }
}
