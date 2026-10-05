/**
 * End-to-end smoke test for the /franchise-global API + fulfilment flow.
 *
 * DRY-RUN by default: prints what WOULD happen at each step; does not persist.
 * `--apply` runs the writes for real (creates assignment + invoice + payment
 * fulfilment) against whatever MONGODB_URI is set.
 *
 * The test drives the same code paths the HTTP endpoints call — bypasses
 * express so we can inspect state at each step.
 *
 * Steps:
 *   1. Pick a global sub-territory with NO existing FranchiseGlobalAssignment
 *      (or user-specified via --entity=ID).
 *   2. Pick a test buyer user (must already exist as a Garage user).
 *   3. Simulate `POST /franchise-global/assignments`:
 *        - Create FranchiseGlobalAssignment (pending_payment)
 *        - Mint franchise_global invoice via createInvoice
 *   4. Simulate store_wallet payment:
 *        - Ensure buyer has ≥ $650 in their platform-org StoreWallet
 *        - Debit their wallet (mirrors what checkout does)
 *        - Mark invoice.status = paid, invoice.paymentPlatform = store_wallet
 *        - Call fulfillInvoice
 *   5. Verify:
 *        - Assignment status == "active"
 *        - subscription.expiresAt ≈ now + 1yr
 *        - Shorupan's platform wallet credited $650 with metadata.franchiseFloor
 *        - No dup credit on replay
 *
 * Usage:
 *   npx tsx src/scripts/smoke-test-franchise-global.ts --buyer=email@x.com
 *   npx tsx src/scripts/smoke-test-franchise-global.ts --buyer=email@x.com --apply
 *   npx tsx src/scripts/smoke-test-franchise-global.ts --buyer=email@x.com --entity=<subTerritoryId> --apply
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";

const APPLY = process.argv.includes("--apply");
const buyerArg = process.argv.find((a) => a.startsWith("--buyer="));
const BUYER_EMAIL = buyerArg?.split("=")[1]?.toLowerCase();
const entityArg = process.argv.find((a) => a.startsWith("--entity="));
const ENTITY_ID = entityArg?.split("=")[1];

const FLOOR_USD = 650;

function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}
function err(step: string, msg: string) {
  console.error(`[${step}] ✗ ${msg}`);
}
function ok(step: string, msg: string) {
  console.log(`[${step}] ✓ ${msg}`);
}

async function main() {
  if (!BUYER_EMAIL) {
    console.error(
      "Usage: --buyer=email@x.com  [--entity=<subTerritoryId>]  [--apply]",
    );
    process.exit(1);
  }
  console.log(`\nMode: ${APPLY ? "LIVE (--apply)" : "DRY-RUN"}\n`);

  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const { FranchiseGlobalAssignment } = await import(
    "../models/franchiseGlobalAssignment.model"
  );
  const { FranchiseSubTerritory } = await import(
    "../models/franchiseSubTerritory.model"
  );
  const { User } = await import("../models/user.model");
  const { StoreWallet } = await import("../models/storeWallet.model");
  const { WalletTransaction } = await import(
    "../models/walletTransaction.model"
  );
  const { Invoice } = await import("../models/invoice.model");
  const { createInvoice, fulfillInvoice } = await import("../services/invoice");
  const { PLATFORM_ORG_ID, PLATFORM_USER_EMAIL } = await import(
    "../services/commission"
  );

  // ── STEP 1: pick / verify entity ─────────────────────────────────────
  log("1", "Picking test sub-territory…");
  let entity: any = null;
  if (ENTITY_ID) {
    entity = await FranchiseSubTerritory.findById(ENTITY_ID).lean<any>();
    if (!entity) {
      err("1", `Sub-territory ${ENTITY_ID} not found`);
      process.exit(1);
    }
  } else {
    // Find one with no existing assignment
    const existingAssignedIds = (
      await FranchiseGlobalAssignment.find({
        geoLevel: "subTerritory",
        status: { $ne: "cancelled" },
      })
        .select("geoEntityId")
        .lean()
    ).map((a: any) => a.geoEntityId);
    entity = await FranchiseSubTerritory.findOne({
      _id: { $nin: existingAssignedIds },
    }).lean<any>();
    if (!entity) {
      err("1", "No free sub-territory found");
      process.exit(1);
    }
  }
  ok(
    "1",
    `Sub-territory: ${entity.name} (id=${entity._id}, parent=${entity.parentTerritory}, country=${entity.country})`,
  );
  const existing = await FranchiseGlobalAssignment.findOne({
    geoLevel: "subTerritory",
    geoEntityId: String(entity._id),
  }).lean<any>();
  if (existing && existing.status !== "cancelled") {
    err(
      "1",
      `Already assigned (status=${existing.status}, owner=${existing.ownerEmail}) — pick a different one via --entity`,
    );
    process.exit(1);
  }

  // ── STEP 2: verify buyer ─────────────────────────────────────────────
  log("2", `Looking up buyer ${BUYER_EMAIL}…`);
  const buyer = await User.findOne({
    email: new RegExp("^" + BUYER_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"),
  })
    .select("_id email name")
    .lean<any>();
  if (!buyer) {
    err("2", `No Garage user with email ${BUYER_EMAIL}`);
    process.exit(1);
  }
  ok("2", `Buyer: ${buyer.email} (id=${buyer._id})`);

  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id email")
    .lean<any>();
  if (!platformUser) {
    err("2", `Platform user ${PLATFORM_USER_EMAIL} not found`);
    process.exit(1);
  }
  ok("2", `Platform user: ${platformUser.email} (id=${platformUser._id})`);

  // ── STEP 3: create assignment + invoice ──────────────────────────────
  log("3", "Would create assignment + invoice:");
  console.log(`     geoLevel=subTerritory geoEntityId=${entity._id}`);
  console.log(`     ownerEmail=${BUYER_EMAIL} priceUSD=${FLOOR_USD}`);
  console.log(`     invoice: itemType=franchise_global amount=$${FLOOR_USD} isRecurring=yearly`);
  if (!APPLY) {
    console.log(`\n(dry-run — stopping here. Re-run with --apply to persist.)`);
    await mongoose.disconnect();
    return;
  }

  const assignmentDoc = {
    geoLevel: "subTerritory" as const,
    geoEntityId: String(entity._id),
    geoEntityName: entity.name,
    geoCountry: entity.country,
    geoParentTerritory: entity.parentTerritory,
    zipCodes: Array.isArray(entity.zipCodes) ? entity.zipCodes : [],
    ownerUserId: buyer._id,
    ownerEmail: BUYER_EMAIL,
    priceUSD: FLOOR_USD,
    soldByUserId: platformUser._id,
    status: "pending_payment" as const,
  };
  const assignment = await FranchiseGlobalAssignment.create(assignmentDoc);
  ok("3", `Assignment created: ${assignment._id}`);

  const invoice = await createInvoice({
    organizationId: PLATFORM_ORG_ID,
    sellerId: String(platformUser._id),
    userId: String(buyer._id),
    customerEmail: buyer.email,
    customerName: buyer.name,
    lineItems: [
      {
        itemType: "franchise_global",
        itemId: String(assignment._id),
        itemName: `Franchise (global) — ${entity.name}`,
        quantity: 1,
        unitPrice: FLOOR_USD * 100,
        originalCurrency: "USD",
      },
    ],
    itemCurrency: "USD",
    isRecurring: true,
    recurringPeriod: "yearly",
    metadata: {
      franchiseGlobalAssignmentId: String(assignment._id),
      geoLevel: "subTerritory",
      geoEntityId: String(entity._id),
    },
  });
  ok("3", `Invoice minted: ${invoice.invoiceNumber} (id=${invoice._id})`);

  (assignment as any).subscription = {
    ...((assignment as any).subscription || {}),
    invoiceId: invoice._id,
  };
  await (assignment as any).save();

  // ── STEP 4: pay via store_wallet ─────────────────────────────────────
  log("4", "Ensuring buyer has store_wallet funds…");
  let buyerWallet = await StoreWallet.findOne({
    userId: buyer._id,
    orgId: new Types.ObjectId(PLATFORM_ORG_ID),
  });
  if (!buyerWallet) {
    buyerWallet = await StoreWallet.create({
      userId: buyer._id,
      orgId: new Types.ObjectId(PLATFORM_ORG_ID),
      balance: FLOOR_USD + 10,
      currency: "USD",
    });
    ok(
      "4",
      `Created buyer wallet on platform org with $${buyerWallet.balance} float`,
    );
  } else if (buyerWallet.balance < FLOOR_USD) {
    buyerWallet.balance = FLOOR_USD + 10;
    await buyerWallet.save();
    ok("4", `Topped buyer wallet to $${buyerWallet.balance} for the test`);
  } else {
    ok("4", `Buyer wallet already has $${buyerWallet.balance}`);
  }

  const before = buyerWallet.balance;
  buyerWallet.balance = Math.round((before - FLOOR_USD) * 100) / 100;
  buyerWallet.lastTransactionAt = new Date();
  await buyerWallet.save();
  await WalletTransaction.create({
    storeWalletId: buyerWallet._id,
    walletType: "store",
    userId: buyer._id,
    orgId: new Types.ObjectId(PLATFORM_ORG_ID),
    type: "debit",
    amount: FLOOR_USD,
    currency: "USD",
    balanceBefore: before,
    balanceAfter: buyerWallet.balance,
    description: `Franchise (global) purchase — ${entity.name}`,
    note: `Invoice ${invoice.invoiceNumber}`,
    relatedUserId: platformUser._id,
    status: "completed",
    metadata: {
      invoiceId: String(invoice._id),
    },
  });
  ok("4", `Debited $${FLOOR_USD} from buyer wallet (${before} → ${buyerWallet.balance})`);

  // Mark invoice paid + call fulfillInvoice — mirrors what store_wallet
  // checkout does at pay-time.
  const paidInvoice = await Invoice.findById(invoice._id);
  if (!paidInvoice) {
    err("4", "Freshly-minted invoice not found for status flip");
    process.exit(1);
  }
  paidInvoice.status = "paid";
  paidInvoice.paidAt = new Date();
  (paidInvoice as any).paymentPlatform = "store_wallet";
  (paidInvoice as any).paymentMethod = { category: "wallet", provider: "store_wallet" };
  await paidInvoice.save();
  ok("4", `Invoice marked paid + platform=store_wallet`);

  await fulfillInvoice(paidInvoice, `sw-${Date.now()}`);
  ok("4", `fulfillInvoice ran`);

  // ── STEP 5: verify ───────────────────────────────────────────────────
  log("5", "Verifying assignment state…");
  const activated = await FranchiseGlobalAssignment.findById(assignment._id).lean<any>();
  if (!activated) {
    err("5", "Assignment vanished");
    process.exit(1);
  }
  const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const expiresAt = activated.subscription?.expiresAt
    ? new Date(activated.subscription.expiresAt).getTime()
    : 0;
  const withinRange = Math.abs(expiresAt - oneYearFromNow) < 48 * 60 * 60 * 1000;
  console.log(`     status: ${activated.status}`);
  console.log(`     subscription.startedAt: ${activated.subscription?.startedAt}`);
  console.log(`     subscription.expiresAt: ${activated.subscription?.expiresAt}`);
  console.log(`     subscription.lastPaymentInvoiceId: ${activated.subscription?.lastPaymentInvoiceId}`);
  if (activated.status !== "active") {
    err("5", `Expected status=active, got ${activated.status}`);
  } else {
    ok("5", "status is active");
  }
  if (!withinRange) {
    err(
      "5",
      `expiresAt not ≈ now+1yr (delta ${Math.round((expiresAt - oneYearFromNow) / (60 * 60 * 1000))}h)`,
    );
  } else {
    ok("5", "subscription.expiresAt ≈ now + 1yr");
  }

  log("5", "Verifying Shorupan floor credit…");
  const floorCredit = await WalletTransaction.findOne({
    "metadata.franchiseFloor.invoiceId": String(invoice._id),
    userId: platformUser._id,
    type: "credit",
  }).lean<any>();
  if (!floorCredit) {
    err("5", `No franchiseFloor credit found for invoice ${invoice._id}`);
  } else {
    console.log(`     credit amount: $${floorCredit.amount}`);
    console.log(`     credit kind: ${floorCredit.metadata?.franchiseFloor?.kind}`);
    if (floorCredit.amount === FLOOR_USD) {
      ok("5", `Shorupan credited $${FLOOR_USD}`);
    } else {
      err(
        "5",
        `Expected $${FLOOR_USD}, got $${floorCredit.amount}`,
      );
    }
    if (floorCredit.metadata?.franchiseFloor?.kind === "global_floor") {
      ok("5", "floor credit tagged kind=global_floor");
    } else {
      err(
        "5",
        `Expected kind=global_floor, got ${floorCredit.metadata?.franchiseFloor?.kind}`,
      );
    }
  }

  log("5", "Testing idempotency (replay fulfillInvoice)…");
  await fulfillInvoice(paidInvoice, `sw-${Date.now()}`);
  const floorCredits = await WalletTransaction.countDocuments({
    "metadata.franchiseFloor.invoiceId": String(invoice._id),
    userId: platformUser._id,
    type: "credit",
  });
  if (floorCredits === 1) {
    ok("5", "idempotent — still exactly 1 floor credit after replay");
  } else {
    err("5", `Duplicated floor credit on replay: ${floorCredits} rows`);
  }

  log("5", "Testing recurring child invoice mint…");
  const child = await Invoice.findOne({
    parentInvoiceId: invoice._id,
    isRecurring: true,
  }).lean<any>();
  if (!child) {
    err(
      "5",
      "No child invoice minted — expected generateNextChildInvoice to create one",
    );
  } else {
    console.log(`     child: ${child.invoiceNumber} status=${child.status} expiresAt=${child.expiresAt}`);
    ok("5", "recurring child minted");
  }

  console.log("\n=== SMOKE TEST COMPLETE ===\n");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
