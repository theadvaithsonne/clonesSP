// Fulfillment for the "hifi_investment" invoice itemType.
//
// The invoice was minted by /hifi/applications/:id/invoice against an
// existing `hifi_investment_application` doc, then paid via the
// standard currency-aware /api/invoices/:id/pay-with-wallet flow. At
// this point the investor's store wallet is already debited. This hook:
//
//   1. Updates the hifi_investment_application:
//        paymentStatus = "success"
//        paidAt = now
//        status = "completed"
//        paymentPayload = { method:"garage_wallet", currency, ... }
//        stepStatuses.<payStepId> = "success"  (if payStepId provided)
//   2. Upserts a hifi_investment_subscription row keyed on applicationId
//      so retries don't dupe. Sets status="settled", paidAt=now.
//   3. Credits the founder-org StoreWallet in the same currency with the
//      principal — the money has to land somewhere. The hifi seller app
//      owns the release-to-escrow-bank workflow separately.
//   4. Stamps invoice.metadata.hifiFulfilledAt so retries no-op.
//
// hifi_* collections live in roam-admin-prod and are OWNED by the
// garage-seller-hifi Next app; we read/write via raw collection access
// so we don't have to mirror their (huge) schemas as mongoose models.

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { Invoice } from "../models/invoice.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { getSocketInstance } from "./socket";

export interface HifiFulfillmentResult {
  status:
    | "fulfilled"
    | "already_fulfilled"
    | "missing_application"
    | "missing_founder";
  applicationId?: string;
  subscriptionId?: string;
}

/** Founders are identified via User.organizations[{organization,
 *  role:"founder"}]. Matches the sibling helpers in
 *  cryptosubAddonPurchase / whitelabelAddonPurchase. */
export async function findOrgFounderId(orgId: any): Promise<string | null> {
  const founder = await User.findOne({
    organizations: {
      $elemMatch: {
        organization: new Types.ObjectId(String(orgId)),
        role: "founder",
      },
    },
  })
    .select("_id")
    .lean<{ _id: any }>();
  return founder?._id ? String(founder._id) : null;
}

export async function fulfillHifiInvestmentInvoice(
  invoice: any,
): Promise<HifiFulfillmentResult> {
  const applicationId: string | null =
    invoice?.metadata?.hifiApplicationId
      ? String(invoice.metadata.hifiApplicationId)
      : null;
  if (!applicationId) {
    console.warn(
      `[hifiInvoiceFulfillment] invoice ${invoice?.invoiceNumber} has no metadata.hifiApplicationId`,
    );
    return { status: "missing_application" };
  }
  if (invoice.metadata?.hifiFulfilledAt) {
    return { status: "already_fulfilled", applicationId };
  }

  const db = mongoose.connection.db!;
  const applications = db.collection("hifi_investment_applications");
  const subscriptions = db.collection("hifi_investment_subscriptions");

  // hifi apps carry a string `id` (uuid) OR an ObjectId `_id`. Metadata
  // stored the caller-supplied value; look up both ways.
  const orQuery: any = { $or: [{ id: applicationId }] };
  if (Types.ObjectId.isValid(applicationId)) {
    orQuery.$or.push({ _id: new Types.ObjectId(applicationId) });
  }
  const application: any = await applications.findOne(orQuery);
  if (!application) {
    console.error(
      `[hifiInvoiceFulfillment] application ${applicationId} not found for invoice ${invoice.invoiceNumber}`,
    );
    return { status: "missing_application" };
  }

  const orgId = String(application.orgId || application.organizationId || "");
  if (!orgId) {
    console.error(
      `[hifiInvoiceFulfillment] application ${applicationId} has no orgId`,
    );
    return { status: "missing_application", applicationId };
  }

  const founderUserId = await findOrgFounderId(orgId);
  if (!founderUserId) {
    console.error(
      `[hifiInvoiceFulfillment] no founder for org ${orgId} — cannot route escrow`,
    );
    return { status: "missing_founder", applicationId };
  }

  const currency = String(
    (invoice.metadata as any)?.walletCurrency ||
      invoice.paymentCurrency ||
      invoice.itemCurrency ||
      "USD",
  );
  // Invoice totalAmount is smallest-unit of the invoice currency. The
  // whole-unit amount is what we credit to the founder-org wallet.
  const principal =
    Math.round((invoice.totalAmount || 0) * 1e6) / 1e6 / 100;

  // ── 1) Update the hifi application ─────────────────────────────────
  const paymentPayload = {
    method: "garage_wallet",
    walletCurrency: currency,
    referenceId: invoice.invoiceNumber,
    invoiceId: String(invoice._id),
    status: "success",
    paidAt: new Date().toISOString(),
  };
  const nowIso = new Date();
  const stepUpdates: any = {};
  if (application.activeStepId) {
    stepUpdates[`stepStatuses.${application.activeStepId}`] = "success";
    stepUpdates[`stepPayloads.${application.activeStepId}`] = paymentPayload;
  }
  await applications.updateOne(
    { _id: application._id },
    {
      $set: {
        paymentStatus: "success",
        paidAt: nowIso,
        status: "completed",
        paymentPayload,
        updatedAt: nowIso,
        ...stepUpdates,
      },
    },
  );

  // ── 2) Upsert the hifi_investment_subscription (idempotent) ────────
  // Key on applicationId — one settled subscription per paid application.
  const existingSub = await subscriptions.findOne({
    applicationId: application.id || String(application._id),
  });
  let subscriptionId: string;
  if (existingSub) {
    subscriptionId = String(existingSub.id || existingSub._id);
  } else {
    subscriptionId = crypto.randomUUID();
    // The invoice can settle via TWO channels: the store-wallet path
    // (paymentPlatform=store_wallet) or the in-house crypto pipeline
    // (paymentPlatform=crypto_wallet). Reflect that in the
    // subscription row so hifi seller reports show the actual method
    // used instead of always "garage_wallet".
    const paidViaCrypto = invoice.paymentPlatform === "crypto_wallet";
    const paymentMethod = paidViaCrypto ? "garage_crypto" : "garage_wallet";
    const paymentNetwork = paidViaCrypto
      ? `${(invoice.metadata as any)?.cryptoChain || "polygon"}_${(invoice.metadata as any)?.cryptoCoin || currency}`
      : `store_wallet_${currency}`;

    await subscriptions.insertOne({
      id: subscriptionId,
      applicationId: application.id || String(application._id),
      productId: application.productId,
      orgId,
      organizationId: orgId,
      organizationName: application.organizationName,
      userId: application.userId,
      units: application.units,
      payableInr: application.payableInr,
      currency: application.currency,
      paymentMethod,
      paymentNetwork,
      status: "settled",
      txReference:
        (invoice.metadata as any)?.cryptoTxHash || invoice.invoiceNumber,
      invoiceId: String(invoice._id),
      walletCurrency: currency,
      walletAmount: principal,
      paidAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // ── 3) Escrow the principal into the founder-org StoreWallet ───────
  // Idempotent via dedupeKey on the wallet tx metadata.
  const escrowDedupeKey = `hifi_investment_escrow_${application.id || application._id}`;
  const existingEscrow = await WalletTransaction.findOne({
    "metadata.dedupeKey": escrowDedupeKey,
  })
    .select({ _id: 1 })
    .lean();

  if (!existingEscrow) {
    const orgOid = new Types.ObjectId(orgId);
    const founderOid = new Types.ObjectId(founderUserId);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        let escrowWallet: any = await StoreWallet.findOne({
          userId: founderOid,
          orgId: orgOid,
          currency,
        }).session(session);
        if (!escrowWallet) {
          const created = await StoreWallet.create(
            [
              {
                userId: founderOid,
                orgId: orgOid,
                balance: 0,
                currency,
              },
            ],
            { session },
          );
          escrowWallet = created[0];
        }
        const before = escrowWallet.balance;
        const after = Math.round((before + principal) * 1e8) / 1e8;
        escrowWallet.balance = after;
        escrowWallet.lastTransactionAt = new Date();
        await escrowWallet.save({ session });

        await WalletTransaction.create(
          [
            {
              storeWalletId: escrowWallet._id,
              walletType: "store",
              userId: founderOid,
              orgId: orgOid,
              type: "credit",
              amount: principal,
              currency,
              balanceBefore: before,
              balanceAfter: after,
              description: `HiFi investment — application ${application.id || application._id}`,
              note: `Investor: ${application.userId}. Product: ${application.productId}. Invoice: ${invoice.invoiceNumber}. Units: ${application.units}.`,
              relatedUserId: application.userId
                ? new Types.ObjectId(String(application.userId))
                : undefined,
              metadata: {
                kind: "hifi_investment_escrow_credit",
                hifiApplicationId: application.id || String(application._id),
                hifiSubscriptionId: subscriptionId,
                hifiProductId: application.productId,
                invoiceId: String(invoice._id),
                invoiceNumber: invoice.invoiceNumber,
                units: application.units,
                dedupeKey: escrowDedupeKey,
              },
              status: "completed",
            },
          ],
          { session },
        );
      });
    } catch (err: any) {
      if (err?.code !== 11000) {
        console.error(
          `[hifiInvoiceFulfillment] escrow failed for application ${applicationId}:`,
          err,
        );
        throw err;
      }
    } finally {
      session.endSession();
    }
  }

  // ── 4) Stamp the invoice so retries no-op ──────────────────────────
  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        "metadata.hifiFulfilledAt": new Date(),
        "metadata.hifiSubscriptionId": subscriptionId,
      },
    },
  );

  // ── Notify. Founder org room + investor's user room. ───────────────
  try {
    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}`).emit("hifi:application:paid", {
        applicationId: application.id || String(application._id),
        subscriptionId,
        productId: application.productId,
        userId: application.userId,
        units: application.units,
        currency,
        principal,
      });
      if (application.userId) {
        io.to(`user:${String(application.userId)}`).emit(
          "hifi:application:paid",
          {
            applicationId: application.id || String(application._id),
            subscriptionId,
          },
        );
      }
    }
  } catch (err) {
    console.warn("[hifiInvoiceFulfillment] socket emit failed:", err);
  }

  console.log(
    `[hifiInvoiceFulfillment] app ${application.id || application._id} paid via ${currency} wallet → subscription ${subscriptionId} + escrow ${principal} ${currency} to founder ${founderUserId}`,
  );

  return {
    status: "fulfilled",
    applicationId: application.id || String(application._id),
    subscriptionId,
  };
}
