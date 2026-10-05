// HiFi investment — invoice + wallet-payment bridge.
//
// The garage-seller-hifi Next app owns products, application flow,
// KYC, subscriptions, payouts (see hifi_* collections in
// roam-admin-prod). This router exists ONLY so the hifi seller FE can
// route the "Pay" step through our invoice + multi-currency store
// wallet system:
//
//   POST /hifi/applications/:applicationId/invoice
//       Called by the seller FE at the pay step. Mints an invoice in
//       our system for the application's amount + currency, and
//       returns { invoiceId, invoiceNumber, redirectUrl, amount, currency }.
//       Investor then hits /invoice/:invoiceId, picks the matching
//       sibling wallet, pays. Our fulfillInvoice hook writes back to
//       hifi_investment_applications and creates the subscription.
//
//   GET  /hifi/applications/:applicationId/invoice
//       Fetch the existing invoice for an application, if any. Useful
//       for the seller FE to resume a partially-completed payment
//       (idempotency for the mint step).
//
// Everything else about hifi apps — creation, KYC steps, founder
// approval — stays in the hifi seller backend. We do NOT expose CRUD
// for hifi_products, hifi_investment_applications, etc.

import { Router, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { createInvoice } from "../services/invoice";
import { debitStoreWallet } from "../services/wallet";
import {
  normalizeHifiCurrency,
  HIFI_PAYABLE_CURRENCIES,
} from "../config/hifiInvoice";
import { getChainConfig } from "../config/cryptoWallets";

const router = Router();

/** Look up an application by hifi's UUID `id` or Mongo `_id`. */
async function findHifiApplication(idOrUuid: string): Promise<any | null> {
  const db = mongoose.connection.db!;
  const applications = db.collection("hifi_investment_applications");
  const or: any[] = [{ id: idOrUuid }];
  if (Types.ObjectId.isValid(idOrUuid)) {
    or.push({ _id: new Types.ObjectId(idOrUuid) });
  }
  return applications.findOne({ $or: or });
}

async function findHifiProduct(productId: string): Promise<any | null> {
  const db = mongoose.connection.db!;
  const products = db.collection("hifi_products");
  const or: any[] = [{ id: productId }];
  if (Types.ObjectId.isValid(productId)) {
    or.push({ _id: new Types.ObjectId(productId) });
  }
  return products.findOne({ $or: or });
}

/** Whole-currency-unit amount to bill the investor. hifi apps store
 *  `payableInr` (rupees) for INR flows + a `units × amountPerUnit` for
 *  other currencies; product's builderData.amountPerUnit is the source. */
async function resolveInvoiceAmount(
  application: any,
  currency: string,
): Promise<number> {
  if (currency === "INR") {
    // payableInr is stored in whole rupees (see hifi_investment_applications
    // sample: payableInr:505000, amountConfirmed:"₹5,05,000").
    return Number(application.payableInr) || 0;
  }
  // Non-INR: derive from units × product.amountPerUnit (in the product's
  // baseCurrency terms) — the hifi seller app quotes it into the chosen
  // currency, but we don't have a stored quote for wallet-payment yet.
  // Fallback: reuse payableInr converted via the product's currency
  // multiplier isn't in scope, so require the seller to have stamped
  // `walletAmount` / `walletCurrency` on the application ahead of the
  // pay step (recommended). If missing, use units × amountPerUnit.
  if (application.walletCurrency === currency && application.walletAmount) {
    return Number(application.walletAmount);
  }
  const product = await findHifiProduct(String(application.productId));
  const amountPerUnit =
    Number(product?.amountPerUnit) ||
    Number(product?.builderData?.amountPerUnit) ||
    0;
  return Number(application.units || 0) * amountPerUnit;
}

// ─── POST /hifi/applications/:applicationId/invoice ─────────────────

router.post(
  "/applications/:applicationId/invoice",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const body = z
        .object({
          /** Optional override — otherwise we normalize application.currency. */
          currency: z.string().trim().optional(),
        })
        .parse(req.body ?? {});

      const application = await findHifiApplication(req.params.applicationId);
      if (!application) {
        return res
          .status(404)
          .json({ success: false, error: "HiFi application not found" });
      }

      // Only the investor on the application can spawn its invoice.
      if (String(application.userId) !== me.userId) {
        return res.status(403).json({
          success: false,
          error: "You are not the investor on this application",
        });
      }

      // If already paid / has a live invoice, return the existing one.
      if (
        application.paymentStatus === "success" &&
        application.paymentPayload?.invoiceId
      ) {
        const existing = await Invoice.findById(
          application.paymentPayload.invoiceId,
        );
        if (existing) {
          return res.json({
            success: true,
            reused: true,
            invoice: serializeInvoice(existing, application),
          });
        }
      }

      // Look up any pending/draft invoice we already minted for this app.
      const preexistingInvoice = await Invoice.findOne({
        "metadata.hifiApplicationId": application.id || String(application._id),
        status: { $in: ["draft", "pending"] },
      });
      if (preexistingInvoice) {
        return res.json({
          success: true,
          reused: true,
          invoice: serializeInvoice(preexistingInvoice, application),
        });
      }

      // Resolve billing currency. Body override wins if the seller wants
      // to force a specific one; otherwise map from application.currency.
      // Normalized result is tagged: `kind: "wallet"` for USD/INR/ETH/BTC
      // (paid via store wallet — sets metadata.allowedWalletCurrencies),
      // `kind: "crypto"` for USDC/USDT (paid via the on-chain crypto
      // pipeline — sets metadata.paymentChannel="crypto").
      const rawCurrency = body.currency || application.currency;
      const normalized = normalizeHifiCurrency(rawCurrency);
      if (!normalized) {
        return res.status(400).json({
          success: false,
          error: `Currency "${rawCurrency}" is not payable. Supported: ${HIFI_PAYABLE_CURRENCIES.join(", ")}.`,
        });
      }
      const currency = normalized.currency;

      // For crypto-invoice currencies, gate on at least one matching
      // chain being configured in SUPPORTED_CHAINS with a populated
      // platform address. Prevents minting a 100% unpayable invoice
      // when the ops team hasn't set PLATFORM_USDC_POLYGON_ADDRESS yet.
      if (normalized.kind === "crypto") {
        const anyChainConfigured =
          !!getChainConfig("polygon", currency) ||
          !!getChainConfig("tron", currency) ||
          !!getChainConfig("bsc", currency);
        if (!anyChainConfigured) {
          return res.status(400).json({
            success: false,
            error: `${currency} has no configured on-chain platform address. Set PLATFORM_${currency}_* addresses to enable this currency.`,
          });
        }
      }

      const amount = await resolveInvoiceAmount(application, currency);
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Could not resolve invoice amount from application",
        });
      }

      // Validate the org still exists (defensive — some old apps might
      // reference a deleted org).
      const orgId = String(application.orgId || application.organizationId || "");
      if (!Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Application has invalid orgId" });
      }
      const org = await Organization.findById(orgId).select("_id").lean();
      if (!org) {
        return res
          .status(404)
          .json({ success: false, error: "Application's org not found" });
      }

      const investor: any = await User.findById(me.userId)
        .select("email name")
        .lean();

      const product = await findHifiProduct(String(application.productId));
      const productName =
        product?.name?.trim() ||
        product?.builderData?.name?.trim() ||
        "HiFi Investment";

      const invoice = await createInvoice({
        organizationId: orgId,
        // sellerId same as buyer — commissions are skipped for this
        // itemType, this field is just for record-keeping.
        sellerId: me.userId,
        userId: me.userId,
        customerEmail: investor?.email || "",
        customerName: investor?.name || undefined,
        lineItems: [
          {
            itemType: "hifi_investment",
            itemId: String(application._id),
            itemName: `${productName} — ${application.units} units`,
            itemDescription: application.amountConfirmed
              ? `${application.amountConfirmed} · ${application.units} units`
              : undefined,
            quantity: 1,
            unitPrice: Math.round(amount * 100),
            originalCurrency: currency,
          },
        ],
        itemCurrency: currency,
        tax: 0,
        metadata: {
          type: "hifi_investment",
          hifiApplicationId:
            application.id || String(application._id),
          hifiProductId: application.productId,
          hifiUnits: application.units,
          // Wallet path gates the invoice pay page's chooser to just
          // the matching sibling wallet. Crypto path skips the wallet
          // tab entirely — the FE reads paymentChannel to force the
          // crypto tab. Never set both.
          ...(normalized.kind === "wallet"
            ? { allowedWalletCurrencies: [currency] }
            : { paymentChannel: "crypto" }),
        },
      });

      // Materialize INR/ETH/BTC sibling wallets for BOTH sides of the
      // trade in the HiFi seller's org — buyer needs their INR wallet
      // to appear in the invoice-pay chooser, seller founder needs
      // their INR wallet for the fulfillment credit to land at parity.
      // HiFi seller orgs don't carry `officeCreatedFromCryptobrand`, so
      // the multi-currency helper's line-item trigger is the path that
      // actually fires here.
      try {
        const [
          { ensureMultiCurrencyWalletsForInvoice },
          { findOrgFounderId },
        ] = await Promise.all([
          import("../services/cryptobrandWallets"),
          import("../services/hifiInvoiceFulfillment"),
        ]);
        await ensureMultiCurrencyWalletsForInvoice(me.userId, String(invoice._id));
        const founderUserId = await findOrgFounderId(orgId);
        if (founderUserId && founderUserId !== me.userId) {
          await ensureMultiCurrencyWalletsForInvoice(
            founderUserId,
            String(invoice._id),
          );
        }
      } catch (err) {
        // Best-effort — the invoice is already created; wallet-side
        // provisioning failures shouldn't block the response. Logged
        // for ops so we can catch systemic breakage.
        console.warn(
          "[hifi/applications/:id/invoice] ensureMultiCurrencyWallets failed:",
          (err as Error).message,
        );
      }

      return res.json({
        success: true,
        reused: false,
        invoice: serializeInvoice(invoice, application),
      });
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: "Invalid payload",
          issues: err.issues,
        });
      }
      console.error("[hifi/applications/:id/invoice POST]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── GET /hifi/applications/:applicationId/invoice ──────────────────

router.get(
  "/applications/:applicationId/invoice",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const application = await findHifiApplication(req.params.applicationId);
      if (!application) {
        return res
          .status(404)
          .json({ success: false, error: "HiFi application not found" });
      }
      if (String(application.userId) !== me.userId) {
        return res.status(403).json({
          success: false,
          error: "You are not the investor on this application",
        });
      }
      const invoice = await Invoice.findOne({
        "metadata.hifiApplicationId":
          application.id || String(application._id),
      })
        .sort({ createdAt: -1 })
        .lean();
      if (!invoice) {
        return res.json({ success: true, invoice: null });
      }
      return res.json({
        success: true,
        invoice: serializeInvoice(invoice as any, application),
      });
    } catch (err: any) {
      console.error("[hifi/applications/:id/invoice GET]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── POST /hifi/payouts/distribute ─────────────────────────────────
//
// Bulk payout — HiFi seller creates a `hifi_payout_runs` row when it's
// time to distribute yields to investors, then calls this endpoint to
// actually move money. Per line item: debit the founder-org's escrow
// StoreWallet (same currency the invoice originally paid in) and
// credit the buyer's StoreWallet.
//
// Idempotent two-layer: cheap findOne on dedupeKey +
// WalletTransaction.metadata.dedupeKey partial-unique index as a race
// backstop. Same pattern as services/whitelabelMonthlyBonus/payout.ts.

const PayoutBody = z.object({
  payoutRunId: z.string().min(1).max(200),
  organizationId: z.string(),
  productId: z.string().min(1).max(200),
  currency: z.string().trim().min(1).max(20),
  lineItems: z
    .array(
      z.object({
        userId: z.string(),
        subscriptionId: z.string().min(1).max(200),
        netAmount: z.number().positive(),
      }),
    )
    .min(1)
    .max(500),
});

router.post(
  "/payouts/distribute",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const body = PayoutBody.parse(req.body);
      const orgId = body.organizationId;
      if (!Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid organizationId" });
      }
      // Founder-of-org gate — mirror cryptobrandCheckout.ts.
      const isFounder = await User.exists({
        _id: new Types.ObjectId(me.userId),
        organizations: {
          $elemMatch: {
            organization: new Types.ObjectId(orgId),
            role: "founder",
          },
        },
      });
      if (!isFounder) {
        return res
          .status(403)
          .json({ success: false, error: "Founder access required" });
      }
      // Reject invalid recipient user ids up-front; per-line loop below
      // still catches missing wallets.
      for (const line of body.lineItems) {
        if (!Types.ObjectId.isValid(line.userId)) {
          return res.status(400).json({
            success: false,
            error: `Invalid userId in line: "${line.userId}"`,
          });
        }
      }

      const results: Array<{
        userId: string;
        subscriptionId: string;
        walletTransactionId: string | null;
        alreadyPaid: boolean;
        error?: string;
      }> = [];
      let paid = 0;
      let alreadyPaid = 0;
      let failed = 0;
      let totalPaidAmount = 0;

      const orgOid = new Types.ObjectId(orgId);
      const currency = body.currency;

      for (const line of body.lineItems) {
        const dedupeKey = `hifi_payout_${body.payoutRunId}_${line.userId}`;

        // Layer-1 idempotency: cheap findOne before we take any locks.
        const existingCredit = await WalletTransaction.findOne({
          "metadata.dedupeKey": dedupeKey,
        })
          .select({ _id: 1 })
          .lean();
        if (existingCredit) {
          results.push({
            userId: line.userId,
            subscriptionId: line.subscriptionId,
            walletTransactionId: String(existingCredit._id),
            alreadyPaid: true,
          });
          alreadyPaid += 1;
          continue;
        }

        // Debit the founder's own StoreWallet in this (org, currency) —
        // where hifiInvoiceFulfillment.ts deposited the investor
        // principal in the first place. Own transaction inside
        // debitStoreWallet.
        let debitTxId: any = null;
        try {
          const { transaction: debitTx } = await debitStoreWallet(
            me.userId,
            orgId,
            line.netAmount,
            `HiFi payout — run ${body.payoutRunId}`,
            line.userId,
            `Payout to ${line.userId} for subscription ${line.subscriptionId}.`,
            currency,
            {
              kind: "hifi_payout_debit",
              payoutRunId: body.payoutRunId,
              productId: body.productId,
              subscriptionId: line.subscriptionId,
              recipientUserId: line.userId,
              dedupeKey: `${dedupeKey}_debit`,
            },
          );
          debitTxId = debitTx._id;
        } catch (debitErr: any) {
          results.push({
            userId: line.userId,
            subscriptionId: line.subscriptionId,
            walletTransactionId: null,
            alreadyPaid: false,
            error: debitErr?.message || "Debit failed",
          });
          failed += 1;
          continue;
        }

        // Credit the buyer's StoreWallet(orgId, currency). Create if missing.
        const buyerOid = new Types.ObjectId(line.userId);
        const session = await mongoose.startSession();
        let creditTxId: any = null;
        try {
          await session.withTransaction(async () => {
            let buyerWallet: any = await StoreWallet.findOne({
              userId: buyerOid,
              orgId: orgOid,
              currency,
            }).session(session);
            if (!buyerWallet) {
              const created = await StoreWallet.create(
                [
                  {
                    userId: buyerOid,
                    orgId: orgOid,
                    balance: 0,
                    currency,
                  },
                ],
                { session },
              );
              buyerWallet = created[0];
            }
            const before = buyerWallet.balance;
            const after = Math.round((before + line.netAmount) * 1e8) / 1e8;
            buyerWallet.balance = after;
            buyerWallet.lastTransactionAt = new Date();
            await buyerWallet.save({ session });

            const createdTxs = await WalletTransaction.create(
              [
                {
                  storeWalletId: buyerWallet._id,
                  walletType: "store",
                  userId: buyerOid,
                  orgId: orgOid,
                  type: "credit",
                  amount: line.netAmount,
                  currency,
                  balanceBefore: before,
                  balanceAfter: after,
                  description: `HiFi payout — run ${body.payoutRunId}`,
                  note: `Payout from run ${body.payoutRunId} for subscription ${line.subscriptionId}.`,
                  relatedUserId: new Types.ObjectId(me.userId),
                  metadata: {
                    kind: "hifi_payout_credit",
                    payoutRunId: body.payoutRunId,
                    productId: body.productId,
                    subscriptionId: line.subscriptionId,
                    dedupeKey,
                    debitWalletTransactionId: debitTxId
                      ? String(debitTxId)
                      : undefined,
                  },
                  status: "completed",
                },
              ],
              { session },
            );
            creditTxId = createdTxs[0]._id;
          });
        } catch (txErr: any) {
          if (txErr?.code === 11000) {
            // Layer-2 idempotency: partial-unique-index caught a race.
            // Treat as success.
            const existing = await WalletTransaction.findOne({
              "metadata.dedupeKey": dedupeKey,
            })
              .select({ _id: 1 })
              .lean();
            creditTxId = existing?._id || null;
            results.push({
              userId: line.userId,
              subscriptionId: line.subscriptionId,
              walletTransactionId: creditTxId ? String(creditTxId) : null,
              alreadyPaid: true,
            });
            alreadyPaid += 1;
            session.endSession();
            continue;
          }
          // Credit failed — reverse the debit so the founder's balance
          // doesn't leak. Straight opposite-direction credit; failures
          // here surface loudly but don't cascade (the founder can
          // reconcile manually if it happens).
          try {
            const founderWallet: any = await StoreWallet.findOne({
              userId: new Types.ObjectId(me.userId),
              orgId: orgOid,
              currency,
            });
            if (founderWallet) {
              founderWallet.balance =
                Math.round(
                  (founderWallet.balance + line.netAmount) * 1e8,
                ) / 1e8;
              await founderWallet.save();
              await WalletTransaction.create({
                storeWalletId: founderWallet._id,
                walletType: "store",
                userId: new Types.ObjectId(me.userId),
                orgId: orgOid,
                type: "credit",
                amount: line.netAmount,
                currency,
                balanceBefore:
                  founderWallet.balance - line.netAmount,
                balanceAfter: founderWallet.balance,
                description: `HiFi payout — reversal (credit failed)`,
                note: `Auto-reversed the payout debit for ${line.userId} because buyer credit failed: ${txErr?.message}`,
                relatedUserId: buyerOid,
                metadata: {
                  kind: "hifi_payout_debit_reversal",
                  payoutRunId: body.payoutRunId,
                  subscriptionId: line.subscriptionId,
                  originalDebitTxId: debitTxId ? String(debitTxId) : null,
                  dedupeKey: `${dedupeKey}_debit_reversal`,
                },
                status: "completed",
              });
            }
          } catch (revErr) {
            console.error(
              `[hifi/payouts] reversal failed for ${line.userId}:`,
              revErr,
            );
          }
          results.push({
            userId: line.userId,
            subscriptionId: line.subscriptionId,
            walletTransactionId: null,
            alreadyPaid: false,
            error: txErr?.message || "Credit failed",
          });
          failed += 1;
          session.endSession();
          continue;
        }
        session.endSession();

        results.push({
          userId: line.userId,
          subscriptionId: line.subscriptionId,
          walletTransactionId: creditTxId ? String(creditTxId) : null,
          alreadyPaid: false,
        });
        paid += 1;
        totalPaidAmount += line.netAmount;
      }

      return res.json({
        success: true,
        results,
        summary: {
          attempted: body.lineItems.length,
          paid,
          alreadyPaid,
          failed,
          totalPaidAmount: Math.round(totalPaidAmount * 1e8) / 1e8,
          currency,
        },
      });
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: "Invalid payload",
          issues: err.issues,
        });
      }
      console.error("[hifi/payouts/distribute]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── GET /hifi/organizations/:orgId/transactions ───────────────────
//
// Founder-scoped ledger for an org — buyer-payment debits, founder-side
// escrow credits, and payout credits back to buyers. Filters on the
// canonical `metadata.kind` values written by pay-with-wallet
// (hifi_investment_payment), hifiInvoiceFulfillment
// (hifi_investment_escrow_credit), and this router's payout endpoint
// (hifi_payout_credit).

const HIFI_LEDGER_KINDS = [
  "hifi_investment_payment",
  "hifi_investment_escrow_credit",
  "hifi_payout_debit",
  "hifi_payout_credit",
  "hifi_payout_debit_reversal",
] as const;

router.get(
  "/organizations/:orgId/transactions",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { orgId } = req.params;
      if (!Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid orgId" });
      }
      const isFounder = await User.exists({
        _id: new Types.ObjectId(me.userId),
        organizations: {
          $elemMatch: {
            organization: new Types.ObjectId(orgId),
            role: "founder",
          },
        },
      });
      if (!isFounder) {
        return res
          .status(403)
          .json({ success: false, error: "Founder access required" });
      }

      const q = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(200).default(20),
          type: z.enum(["credit", "debit", "transfer"]).optional(),
          productId: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .parse(req.query);

      const filter: any = {
        orgId: new Types.ObjectId(orgId),
        "metadata.kind": { $in: HIFI_LEDGER_KINDS },
      };
      if (q.type) filter.type = q.type;
      if (q.productId) filter["metadata.hifiProductId"] = q.productId;
      if (q.from || q.to) {
        filter.createdAt = {};
        if (q.from) filter.createdAt.$gte = new Date(q.from);
        if (q.to) filter.createdAt.$lte = new Date(q.to);
      }

      const skip = (q.page - 1) * q.limit;
      const [items, total] = await Promise.all([
        WalletTransaction.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(q.limit)
          .populate("relatedUserId", "name email profilePicture")
          .lean(),
        WalletTransaction.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: {
          items,
          pagination: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.max(1, Math.ceil(total / q.limit)),
          },
        },
      });
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: "Invalid query",
          issues: err.issues,
        });
      }
      console.error("[hifi/organizations/:orgId/transactions]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── Serializer ─────────────────────────────────────────────────────

function serializeInvoice(invoice: any, application: any) {
  const md = invoice.metadata as any;
  const paymentChannel: "wallet" | "crypto" =
    md?.paymentChannel === "crypto" ? "crypto" : "wallet";
  return {
    id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    totalAmount: invoice.totalAmount,
    itemCurrency: invoice.itemCurrency,
    paymentChannel,
    // Only set for wallet-path invoices. Undefined for crypto-path so
    // FE code that gates on `allowedWalletCurrencies` (wallet chooser)
    // doesn't accidentally render.
    allowedWalletCurrencies:
      paymentChannel === "wallet"
        ? md?.allowedWalletCurrencies || [invoice.itemCurrency]
        : undefined,
    redirectUrl: `/invoice/${invoice._id}`,
    application: {
      id: application.id || String(application._id),
      productId: application.productId,
      units: application.units,
      payableInr: application.payableInr,
      currency: application.currency,
    },
  };
}

export default router;
