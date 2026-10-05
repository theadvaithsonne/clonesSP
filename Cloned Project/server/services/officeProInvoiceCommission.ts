// Fire the Pro-plan 3-bucket commission ($24 UP + $24 direct + $48
// platform) for an office_plan Pro invoice that was paid OUTSIDE of
// Razorpay — the cryptobrand-bootstrap flow (wallet / crypto / manual)
// otherwise skips it entirely because `distributeOfficeCommission` in
// officeSubscription.ts only fires from Razorpay webhook handlers.
//
// The Razorpay flow still runs its own distributeOfficeCommission — that
// path stays unchanged. This function is the sibling for
// non-Razorpay-paid invoices, wired from fulfillInvoice's `office_plan`
// case.
//
// Idempotency: guarded by `invoice.metadata.officeProCommissionAt`. Also
// UP dedupe via a unique `paymentId` per invoice (not per-payment-cycle
// like the Razorpay path, because these invoices only ever have one
// payment event — they're not recurring on the Razorpay side).

import mongoose, { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { OfficePlan, OFFICE_PLAN_IDS } from "../models/officePlan.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "./commission";

export interface DistributeResult {
  status: "distributed" | "skipped_not_pro" | "already_distributed";
  breakdown?: {
    upSaleUsd: number;
    directFlatUsd: number;
    directRecipientId: string | null;
    directRouted: "recipient" | "platform_no_referrer";
    platformShareUsd: number;
    upDistributionId?: string;
  };
}

/**
 * Fire the Pro-plan commission for `invoice` if it's a paid Pro invoice
 * that hasn't been distributed yet. Safe to call multiple times.
 */
export async function distributeProOfficeCommissionForInvoice(
  invoiceOrId: any,
): Promise<DistributeResult> {
  const invoice: any =
    typeof invoiceOrId === "string" || invoiceOrId instanceof Types.ObjectId
      ? await Invoice.findById(invoiceOrId)
      : invoiceOrId;
  if (!invoice) throw new Error("Invoice not found");

  const primary = invoice.lineItems?.[0];
  if (primary?.itemType !== "office_plan") {
    return { status: "skipped_not_pro" };
  }

  // Look up the plan doc to check it's Pro. Fall back to the itemId
  // matching OFFICE_PLAN_IDS.pro so we don't require the plan doc to
  // exist (it always does, but defensive).
  const planId = String(primary.itemId || "");
  const isProById = planId === OFFICE_PLAN_IDS.pro;
  let plan: any = null;
  if (!isProById) {
    plan = await OfficePlan.findById(planId).lean();
  }
  if (!isProById && plan?.slug !== "pro") {
    return { status: "skipped_not_pro" };
  }

  // Idempotency stamp.
  if (invoice.metadata?.officeProCommissionAt) {
    return { status: "already_distributed" };
  }

  // If this invoice belongs to a Razorpay-driven subscription (regular
  // /checkout/office/subscribe → Razorpay hosted card auth flow), the
  // Razorpay `subscription.charged` webhook already runs the equivalent
  // distribution via distributeOfficeCommission in officeSubscription.ts.
  // Don't double-fire. Only cryptobrand-bootstrap + wallet/crypto invoices
  // (no razorpaySubscriptionId) need this fulfillment-time path.
  if (invoice.razorpaySubscriptionId) {
    return { status: "already_distributed" };
  }

  /**
   * Nobody paid — nobody gets paid.
   *
   * The split below is priced off `subtotal`, which a 100%-off coupon never
   * touches: it zeroes `totalAmount` and leaves `subtotal` at $96. Without this
   * guard a fully-discounted cycle distributes the full $25 UP carve-out + $24
   * direct + $47 platform out of revenue that was never collected.
   *
   * This is not hypothetical. On 2026-09-01 twelve `FOUNDERSOFFICE` cycles
   * settled at $0 and distributed anyway — twelve UnilevelPlusDistribution rows
   * against invoices nobody paid for. The follow-up fix that day addressed the
   * other half of that incident (the customer wasn't actually getting an
   * office); the commission side was never guarded.
   *
   * `third_party_subscription` and `unilevel_plus` already do exactly this in
   * fulfillInvoice — office was the one product missing it.
   *
   * Keyed on `totalAmount`, deliberately NOT on `subtotal`: genuinely free
   * plans (Starter, trials) carry `subtotal: 0` and are already caught further
   * down by the negative-share throw. Keying on subtotal would leave the
   * coupon case — the one that actually leaks — wide open.
   */
  if ((invoice.totalAmount ?? 0) <= 0) {
    console.log(
      `[OfficeProInvoiceCommission] ${invoice.invoiceNumber}: $0 invoice (subtotal ${invoice.subtotal}, discount ${invoice.discount}) — skipping commission`,
    );
    invoice.metadata = {
      ...(invoice.metadata as any),
      officeProCommissionAt: new Date(),
      officeProCommissionSkipped: "zero_pay",
    };
    await invoice.save();
    return { status: "skipped_zero_pay" as any };
  }

  // Invoice subtotal is stored in cents (GST-exclusive). Divide for USD.
  const baseUsd = (invoice.subtotal || 0) / 100;

  // ── The UP carve-out is ONE Unilevel Plus licence, priced by the plan ──
  //
  // This used to be a hardcoded 24 while the plan's productPrice is 25, so
  // every Office Pro sale funded 96% of a licence. `planScale` inside
  // distributeUnilevelPlusCommission is min(saleAmount / productPrice, 1),
  // which meant EVERY payout came out at 96% of nominal — direct $8.64
  // instead of $9.00, infinity T1 $0.38 instead of $0.40, pointValue
  // $0.0192 instead of $0.02 — with nothing anywhere explaining the gap.
  //
  // Reading it off the plan keeps the carve-out and the licence in step: a
  // future reprice moves both together instead of silently re-opening the
  // same shortfall.
  const { getActiveUnilevelPlusPlan, distributeUnilevelPlusCommission } =
    await import("./unilevelPlusCommission");
  const upPlan = await getActiveUnilevelPlusPlan();
  if (!upPlan) {
    // Without a plan we can't price the carve-out, and guessing would either
    // overpay the network or overpay the platform. Refuse rather than split
    // on a number nobody chose.
    throw new Error(
      "No active Unilevel Plus plan — cannot price the Office Pro carve-out",
    );
  }
  const upSaleUsd = upPlan.productPrice;
  const directFlatUsd = 24;
  const platformShareUsd =
    Math.round((baseUsd - upSaleUsd - directFlatUsd) * 100) / 100;

  // The carve-outs are flat while `baseUsd` comes from the invoice, so a
  // cheaper plan reaching this path would hand the platform a NEGATIVE
  // credit. Today an isPro gate upstream makes that unreachable, but the
  // margin on the $48 basic plan is exactly $0 — one reprice from going
  // under. Fail loudly instead of writing a negative wallet credit.
  if (platformShareUsd < 0) {
    throw new Error(
      `Office Pro carve-out exceeds the sale: base $${baseUsd} < ` +
        `$${upSaleUsd} (UP licence) + $${directFlatUsd} (direct flat)`,
    );
  }

  const founderId = String(invoice.userId);
  const founder: any = await User.findById(founderId)
    .select("referredBy")
    .lean();
  const directRecipientId = founder?.referredBy
    ? String(founder.referredBy)
    : null;

  const platformUser: any = await User.findOne({
    email: PLATFORM_USER_EMAIL,
  })
    .select("_id")
    .lean();
  if (!platformUser) {
    throw new Error(`Platform user ${PLATFORM_USER_EMAIL} not found`);
  }
  const platformUserId = platformUser._id;
  const platformOrgOid = new Types.ObjectId(PLATFORM_ORG_ID);

  const upPaymentId = `office_pro_invoice_${invoice._id}`;
  const directPaymentId = `office_pro_direct_invoice_${invoice._id}`;
  const platformDedupeKey = `office_pro_platform_${invoice._id}`;

  // ── 1) UP distribution — one full Unilevel Plus licence through the
  //       active plan. Same shape as the Razorpay path uses at
  //       officeSubscription.ts, just with an invoice-scoped paymentId.
  let upDistributionId: string | undefined;
  try {
    const upResult = await distributeUnilevelPlusCommission({
      buyerId: founderId,
      planId: String(upPlan._id),
      saleAmount: upSaleUsd,
      currency: "USD",
      paymentId: upPaymentId,
      metadata: {
        source: "office_subscription_pro_invoice",
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        officePlanId: planId,
        orgId: invoice.organizationId
          ? String(invoice.organizationId)
          : undefined,
        baseAmountUsd: baseUsd,
      },
    });
    upDistributionId = String(upResult.distribution?._id || "");
  } catch (err) {
    console.error(
      `[OfficeProInvoiceCommission] UP distribution failed for invoice ${invoice._id}:`,
      err,
    );
  }

  // ── 2) Direct $24 flat — routes to founder.referredBy, or HQ if no
  //       referrer. Its own session so a rare failure here can't roll
  //       back the platform-share write.
  const { creditAffiliateOrPlatform } = await import("./wallet");
  const directSession = await mongoose.startSession();
  let directRouted: "recipient" | "platform_no_referrer" = "recipient";
  try {
    await directSession.withTransaction(async () => {
      if (directRecipientId) {
        await creditAffiliateOrPlatform({
          recipientUserId: directRecipientId,
          amount: directFlatUsd,
          currency: "USD",
          description: `Office Pro direct bonus (L1)`,
          note: `Office Pro invoice ${invoice.invoiceNumber} — $24 flat direct on Pro activation. Org: ${invoice.organizationId}`,
          relatedUserId: founderId,
          metadata: {
            dedupeKey: directPaymentId,
            kind: "office_pro_direct",
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            orgId: invoice.organizationId
              ? String(invoice.organizationId)
              : "",
          },
          session: directSession,
        });
      } else {
        directRouted = "platform_no_referrer";
        let hqWallet: any = await StoreWallet.findOne({
          userId: platformUserId,
          orgId: platformOrgOid,
        }).session(directSession);
        if (!hqWallet) {
          const created = await StoreWallet.create(
            [
              {
                userId: platformUserId,
                orgId: platformOrgOid,
                balance: 0,
                currency: "USD",
              },
            ],
            { session: directSession },
          );
          hqWallet = created[0];
        }
        const before = hqWallet.balance;
        const after = Math.round((before + directFlatUsd) * 100) / 100;
        hqWallet.balance = after;
        hqWallet.lastTransactionAt = new Date();
        await hqWallet.save({ session: directSession });
        await WalletTransaction.create(
          [
            {
              storeWalletId: hqWallet._id,
              walletType: "store",
              userId: platformUserId,
              orgId: platformOrgOid,
              type: "credit",
              amount: directFlatUsd,
              currency: "USD",
              balanceBefore: before,
              balanceAfter: after,
              description: `Office Pro direct bonus — no referrer`,
              note: `Office Pro invoice ${invoice.invoiceNumber}: $24 direct routed to HQ (buyer has no referredBy).`,
              relatedUserId: new Types.ObjectId(founderId),
              metadata: {
                dedupeKey: directPaymentId,
                kind: "office_pro_direct_no_referrer",
                invoiceId: String(invoice._id),
                invoiceNumber: invoice.invoiceNumber,
                orgId: invoice.organizationId,
              },
              status: "completed",
            },
          ],
          { session: directSession },
        );
      }
    });
  } catch (err: any) {
    // E11000 = dedupeKey collision — idempotent success.
    if (err?.code !== 11000) {
      console.error(
        `[OfficeProInvoiceCommission] direct $24 failed for invoice ${invoice._id}:`,
        err,
      );
    }
  } finally {
    directSession.endSession();
  }

  // ── 3) Platform share $48 → HQ StoreWallet. Own session, idempotent
  //       via dedupeKey.
  const platformSession = await mongoose.startSession();
  try {
    await platformSession.withTransaction(async () => {
      let platformWallet: any = await StoreWallet.findOne({
        userId: platformUserId,
        orgId: platformOrgOid,
      }).session(platformSession);
      if (!platformWallet) {
        const created = await StoreWallet.create(
          [
            {
              userId: platformUserId,
              orgId: platformOrgOid,
              balance: 0,
              currency: "USD",
            },
          ],
          { session: platformSession },
        );
        platformWallet = created[0];
      }
      const before = platformWallet.balance;
      const after = Math.round((before + platformShareUsd) * 100) / 100;
      platformWallet.balance = after;
      platformWallet.lastTransactionAt = new Date();
      await platformWallet.save({ session: platformSession });
      await WalletTransaction.create(
        [
          {
            storeWalletId: platformWallet._id,
            walletType: "store",
            userId: platformUserId,
            orgId: platformOrgOid,
            type: "credit",
            amount: platformShareUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: `Office Pro platform share`,
            note: `Office Pro invoice ${invoice.invoiceNumber}, base $${baseUsd} (UP $${upSaleUsd} + direct $${directFlatUsd} + platform $${platformShareUsd}). Org: ${invoice.organizationId}`,
            relatedUserId: new Types.ObjectId(founderId),
            metadata: {
              dedupeKey: platformDedupeKey,
              source: "office_subscription_pro_invoice_platform_share",
              kind: "office_pro_platform_share",
              invoiceId: String(invoice._id),
              invoiceNumber: invoice.invoiceNumber,
              orgId: invoice.organizationId,
              founderId,
              baseAmountUsd: baseUsd,
              upSaleUsd,
              directFlatUsd,
              directRecipientId: directRecipientId || null,
              directRouted,
              platformShareUsd,
            },
            status: "completed",
          },
        ],
        { session: platformSession },
      );
    });
  } catch (err: any) {
    if (err?.code !== 11000) {
      console.error(
        `[OfficeProInvoiceCommission] platform $${platformShareUsd} failed for invoice ${invoice._id}:`,
        err,
      );
    }
  } finally {
    platformSession.endSession();
  }

  // ── Stamp invoice metadata so re-runs no-op.
  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        "metadata.officeProCommissionAt": new Date(),
        "metadata.officeProCommissionBreakdown": {
          upSaleUsd,
          directFlatUsd,
          directRecipientId: directRecipientId || null,
          directRouted,
          platformShareUsd,
          upDistributionId: upDistributionId || null,
          upPaymentId,
        },
      },
    },
  );

  console.log(
    `[OfficeProInvoiceCommission] invoice=${invoice.invoiceNumber} base=$${baseUsd} UP=$${upSaleUsd} direct=$${directFlatUsd}→${directRecipientId || "HQ"} platform=$${platformShareUsd}`,
  );

  return {
    status: "distributed",
    breakdown: {
      upSaleUsd,
      directFlatUsd,
      directRecipientId,
      directRouted,
      platformShareUsd,
      upDistributionId,
    },
  };
}
