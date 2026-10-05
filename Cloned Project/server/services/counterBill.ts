import crypto from "crypto";
import { Types } from "mongoose";
import {
  CounterBill,
  ICounterBill,
  ICounterBillShare,
  ICounterBillTotals,
  nextCounterBillNumber,
} from "../models/counterBill.model";
import { Invoice, IShippingAddress } from "../models/invoice.model";
import { Store } from "../models/store.model";
import { User } from "../models/user.model";
import {
  CartItemInput,
  CustomLineInput,
  EcommerceError,
  createEcommerceInvoice,
} from "./ecommerceInvoice";

/**
 * Counter bills — see models/counterBill.model.ts for what a bill is.
 *
 * The rule this file keeps: every rupee figure a seller or customer sees comes
 * from `createEcommerceInvoice` — as a dry run while the bill is being built,
 * and for real when it is sent. Nothing here does its own tax or discount
 * arithmetic, so the New bill screen, the pay page and the receipt can't
 * disagree.
 */

export class CounterBillError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "CounterBillError";
  }
}

// ── Attach codes ────────────────────────────────────────────────────────────

/** No 0/O/1/I/L — a code is sometimes read aloud or typed from a receipt. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 7;

export function makeAttachCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function normaliseAttachCode(raw: string): string | null {
  const code = (raw || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/**
 * The URL a bill's QR carries. `/a/` is claimed by the Garage Pay app's
 * scanner; the path segment is the only thing it needs.
 */
export function attachUrl(code: string): string {
  const base = (process.env.PAY_APP_URL || "https://my.garage.app").replace(
    /\/$/,
    ""
  );
  return `${base}/a/${code}`;
}

// ── Pricing ─────────────────────────────────────────────────────────────────

const SERVICE_CHARGE_PREFIX = "Service charge";

type PricingInput = Pick<
  ICounterBill,
  | "_id"
  | "orgId"
  | "mode"
  | "lines"
  | "amount"
  | "amountLabel"
  | "serviceChargePct"
  | "packaging"
>;

/** A bill as invoice inputs: catalogue lines plus the non-catalogue ones. */
export function toInvoiceInputs(bill: PricingInput): {
  items: CartItemInput[];
  customLines: CustomLineInput[];
} {
  const orgId = String(bill.orgId);
  const refId = String(bill._id);
  const items: CartItemInput[] =
    bill.mode === "amount"
      ? []
      : (bill.lines || []).map((l) => ({
          productId: String(l.productId),
          quantity: l.quantity,
          ...(l.variantId ? { variantId: String(l.variantId) } : {}),
          ...(l.addOns?.length ? { addOns: l.addOns.map((a) => a.label) } : {}),
        }));

  const customLines: CustomLineInput[] = [];
  if (bill.mode === "amount" && (bill.amount ?? 0) > 0) {
    customLines.push({
      kind: "custom",
      title: bill.amountLabel?.trim() || "Bill amount",
      orgId,
      refId,
      amount: Math.round(bill.amount!),
    });
  }
  // Service charge is a share of the items, so it only means something on an
  // itemised bill; an amount-only figure is already what the seller wants.
  if (bill.mode === "itemised" && (bill.serviceChargePct ?? 0) > 0) {
    customLines.push({
      kind: "charge",
      title: `${SERVICE_CHARGE_PREFIX} (${formatPct(bill.serviceChargePct)}%)`,
      orgId,
      refId,
      percentOfItems: bill.serviceChargePct,
    });
  }
  if ((bill.packaging ?? 0) > 0) {
    customLines.push({
      kind: "charge",
      title: "Packaging",
      orgId,
      refId,
      amount: Math.round(bill.packaging),
    });
  }
  return { items, customLines };
}

const formatPct = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");

/** The bill's summary card, read back off an (unsaved or saved) invoice. */
export function totalsFromInvoice(inv: {
  lineItems?: Array<{ totalPrice: number; lineKind?: string; itemName?: string }>;
  tax?: number;
  discount?: number;
  totalAmount?: number;
}): ICounterBillTotals {
  let itemTotal = 0;
  let serviceCharge = 0;
  let packaging = 0;
  for (const li of inv.lineItems || []) {
    if (li.lineKind === "charge") {
      if ((li.itemName || "").startsWith(SERVICE_CHARGE_PREFIX)) {
        serviceCharge += li.totalPrice;
      } else {
        packaging += li.totalPrice;
      }
    } else {
      itemTotal += li.totalPrice;
    }
  }
  return {
    itemTotal,
    serviceCharge,
    packaging,
    tax: inv.tax || 0,
    discount: inv.discount || 0,
    total: inv.totalAmount || 0,
  };
}

const hasSomethingToBill = (bill: PricingInput) =>
  bill.mode === "amount"
    ? (bill.amount ?? 0) > 0
    : (bill.lines || []).length > 0;

interface Payer {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Who the invoice is for. An attached customer pays as themselves — coupons,
 * cashback, GST region and commissions follow their account. Without one the
 * seller is the placeholder payer, exactly as counter invoices work today, and
 * whoever opens the pay link claims it (POST /api/invoices/:id/customer).
 */
async function payerFor(
  bill: Pick<ICounterBill, "customer">,
  sellerUserId: string
): Promise<Payer> {
  const buyerId = bill.customer?.userId ? String(bill.customer.userId) : null;
  const id = buyerId || sellerUserId;
  const user = await User.findById(id).select("name email").lean<{
    name?: string;
    email?: string;
  }>();
  const email =
    (buyerId && bill.customer?.email) || user?.email || "counter@garage.app";
  const name = buyerId ? bill.customer?.name || user?.name : "Counter customer";
  return { userId: id, email, name };
}

/**
 * Live totals for the New bill screen. A dry run of the real invoice, so it
 * applies the same GST, coupon and stock rules the customer will be billed by.
 */
export async function priceBill(
  bill: PricingInput & Pick<ICounterBill, "customer" | "couponCode">,
  sellerUserId: string
): Promise<{
  totals: ICounterBillTotals;
  inventoryIssues: Array<{ productId: string; requested: number; available: number }>;
  couponCode?: string;
  couponError?: string;
}> {
  if (!hasSomethingToBill(bill)) {
    return {
      totals: { itemTotal: 0, serviceCharge: 0, packaging: 0, tax: 0, discount: 0, total: 0 },
      inventoryIssues: [],
    };
  }
  const payer = await payerFor(bill, sellerUserId);
  const { items, customLines } = toInvoiceInputs(bill);

  const run = (couponCode?: string) =>
    createEcommerceInvoice({
      userId: payer.userId,
      customerEmail: payer.email,
      customerName: payer.name,
      items,
      customLines,
      displayCurrency: "INR",
      couponCode,
      requireShippingAddress: false,
      dryRun: true,
    });

  let couponError: string | undefined;
  let result;
  try {
    result = await run(bill.couponCode || undefined);
  } catch (err) {
    // A coupon that stopped applying (expired, minimum not met after an item
    // was removed) shouldn't blank the bill — price it without, and say why.
    if (bill.couponCode && err instanceof EcommerceError && err.code === "INVALID_COUPON") {
      couponError = err.message;
      result = await run(undefined);
    } else {
      throw err;
    }
  }
  const inv = result.invoice as any;
  return {
    totals: totalsFromInvoice(inv),
    inventoryIssues: result.inventoryIssues || [],
    couponCode: inv.couponCode,
    couponError,
  };
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

export interface SellerContext {
  userId: string;
  orgId: string;
}

export async function createDraft(
  ctx: SellerContext,
  input: Partial<ICounterBill>
): Promise<ICounterBill> {
  const orgId = new Types.ObjectId(ctx.orgId);
  const store = await Store.findOne({ orgId }).select("_id").lean<{ _id: Types.ObjectId }>();
  const billNumber = await nextCounterBillNumber(orgId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await CounterBill.create({
        ...input,
        orgId,
        storeId: store?._id,
        createdBy: new Types.ObjectId(ctx.userId),
        billNumber,
        status: "draft",
        attachCode: makeAttachCode(),
      });
    } catch (err: any) {
      // Only an attach-code collision is worth another try.
      if (err?.code === 11000 && String(err?.message || "").includes("attachCode")) continue;
      throw err;
    }
  }
  throw new CounterBillError("CODE_COLLISION", "Couldn't start the bill. Try again.", 503);
}

/** Loads a bill owned by the seller's current store, or throws 404. */
export async function loadOwnBill(ctx: SellerContext, id: string): Promise<ICounterBill> {
  if (!Types.ObjectId.isValid(id)) throw new CounterBillError("NOT_FOUND", "Bill not found", 404);
  const bill = await CounterBill.findOne({ _id: id, orgId: ctx.orgId });
  if (!bill) throw new CounterBillError("NOT_FOUND", "Bill not found", 404);
  return bill;
}

const EDITABLE = new Set(["draft", "sent"]);

/**
 * Edit a bill. A sent bill can still be edited (that is how a correction is
 * answered); the next send replaces its invoice.
 */
export async function updateBill(
  bill: ICounterBill,
  patch: Partial<ICounterBill>
): Promise<ICounterBill> {
  if (!EDITABLE.has(bill.status)) {
    throw new CounterBillError("NOT_EDITABLE", `A ${bill.status} bill can't be edited`, 409);
  }
  if (bill.split?.shares?.length) {
    throw new CounterBillError("SPLIT", "A split bill can't be edited", 409);
  }
  const fields: (keyof ICounterBill)[] = [
    "mode",
    "table",
    "guests",
    "lines",
    "amount",
    "amountLabel",
    "serviceChargePct",
    "packaging",
    "couponCode",
    "note",
    "branchId",
    "branchName",
  ];
  for (const f of fields) {
    if (f in patch) (bill as any)[f] = (patch as any)[f];
  }
  if ("customer" in patch) {
    // The seller can clear an attached customer or type one in; a QR-attached
    // customer only ever arrives through attachCustomer().
    const c = (patch as any).customer;
    bill.customer = c
      ? { name: c.name, phone: c.phone, email: c.email, via: "manual", attachedAt: new Date() }
      : undefined;
  }
  await bill.save();
  return bill;
}

function customerNoteFor(bill: ICounterBill, storeName?: string): string {
  const where = [bill.table, bill.guests ? `${bill.guests} guests` : ""]
    .filter(Boolean)
    .join(" · ");
  const parts = [
    bill.note?.trim(),
    where || undefined,
    `Bill #${bill.billNumber}${storeName ? ` at ${storeName}` : ""}`,
    bill.customer?.phone ? `Phone ${bill.customer.phone}` : undefined,
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 1000);
}

async function cancelInvoiceQuietly(invoiceId?: Types.ObjectId | string) {
  if (!invoiceId) return;
  try {
    const { cancelInvoice } = await import("./invoice");
    await cancelInvoice(String(invoiceId));
  } catch (err: any) {
    // Already paid/cancelled/expired — the status sync will report it.
    console.warn(`[CounterBill] cancel invoice ${invoiceId}: ${err?.message}`);
  }
}

/**
 * Send (or re-send) a bill: create its invoice and tell the customer.
 *
 * Re-sending after an edit replaces the invoice — the old one is cancelled
 * first so the customer can never pay a superseded total.
 */
export async function sendBill(
  ctx: SellerContext,
  bill: ICounterBill,
  opts: { shippingAddress?: IShippingAddress } = {}
): Promise<ICounterBill> {
  if (!EDITABLE.has(bill.status)) {
    throw new CounterBillError("NOT_SENDABLE", `A ${bill.status} bill can't be sent`, 409);
  }
  if (bill.split?.shares?.length) {
    throw new CounterBillError("SPLIT", "This bill is already split", 409);
  }
  if (!hasSomethingToBill(bill)) {
    throw new CounterBillError("EMPTY", "Add at least one item", 400);
  }
  if (bill.status === "sent" && bill.invoiceId) {
    const current = await Invoice.findById(bill.invoiceId).select("status").lean<{ status: string }>();
    if (current?.status === "paid") {
      await syncBills([bill]);
      throw new CounterBillError("ALREADY_PAID", "This bill has already been paid", 409);
    }
  }

  const payer = await payerFor(bill, ctx.userId);
  const store = await Store.findOne({ orgId: bill.orgId }).select("name").lean<{ name?: string }>();
  const { items, customLines } = toInvoiceInputs(bill);

  const { invoice, payUrl } = await createEcommerceInvoice({
    userId: payer.userId,
    customerEmail: payer.email,
    customerName: payer.name,
    items,
    customLines,
    displayCurrency: "INR",
    couponCode: bill.couponCode || undefined,
    shippingAddress: opts.shippingAddress,
    requireShippingAddress: false,
    customerNote: customerNoteFor(bill, store?.name),
    extraMetadata: {
      counterBillId: String(bill._id),
      counterBillNumber: bill.billNumber,
      ...(bill.branchId ? { branchId: String(bill.branchId) } : {}),
      ...(bill.table ? { table: bill.table } : {}),
      ...(bill.guests ? { guests: bill.guests } : {}),
    },
  });

  const previousInvoiceId = bill.invoiceId;
  bill.invoiceId = invoice._id;
  bill.invoiceNumber = invoice.invoiceNumber;
  bill.payUrl = payUrl;
  bill.expiresAt = invoice.expiresAt;
  bill.totals = totalsFromInvoice(invoice as any);
  bill.status = "sent";
  bill.sentAt = new Date();
  if (bill.correction?.status === "requested") {
    bill.correction.status = "resolved";
    bill.correction.resolvedAt = new Date();
  }
  await bill.save();

  if (previousInvoiceId && String(previousInvoiceId) !== String(invoice._id)) {
    await cancelInvoiceQuietly(previousInvoiceId);
  }

  notifyCustomer(bill, "counter-bill:sent");
  return bill;
}

export async function cancelBill(bill: ICounterBill): Promise<ICounterBill> {
  await syncBills([bill]);
  if (!EDITABLE.has(bill.status)) {
    throw new CounterBillError("NOT_CANCELLABLE", `A ${bill.status} bill can't be cancelled`, 409);
  }
  if (bill.split?.shares?.some((s) => s.status === "paid")) {
    throw new CounterBillError(
      "PART_PAID",
      "Part of this bill has been paid. Refund those shares instead.",
      409
    );
  }
  await cancelInvoiceQuietly(bill.invoiceId);
  for (const s of bill.split?.shares || []) {
    if (s.status === "pending") {
      await cancelInvoiceQuietly(s.invoiceId);
      s.status = "cancelled";
    }
  }
  bill.status = "cancelled";
  bill.cancelledAt = new Date();
  bill.attachCode = undefined;
  await bill.save();
  notifyCustomer(bill, "counter-bill:cancelled");
  return bill;
}

/**
 * Split a sent bill into equal shares, each its own payable invoice.
 *
 * The bill's own invoice is cancelled and replaced by the shares, which carry
 * the amount (already inclusive of tax, charges and discount) as a single
 * custom line each. Paise that don't divide go on the first share.
 */
export async function splitBill(
  ctx: SellerContext,
  bill: ICounterBill,
  ways: number
): Promise<ICounterBill> {
  await syncBills([bill]);
  if (bill.status !== "sent" || !bill.invoiceId) {
    throw new CounterBillError("NOT_SPLITTABLE", "Only a sent, unpaid bill can be split", 409);
  }
  if (bill.split?.shares?.length) {
    throw new CounterBillError("SPLIT", "This bill is already split", 409);
  }
  if (!Number.isInteger(ways) || ways < 2 || ways > 20) {
    throw new CounterBillError("INVALID_INPUT", "Split between 2 and 20 ways", 400);
  }
  const total = bill.totals?.total || 0;
  if (total < ways * 100) {
    throw new CounterBillError("TOO_SMALL", "Each share must be at least ₹1", 400);
  }

  // Cancel first: a customer mustn't be able to pay the whole bill and a share.
  const { cancelInvoice } = await import("./invoice");
  try {
    await cancelInvoice(String(bill.invoiceId));
  } catch (err: any) {
    await syncBills([bill]);
    throw new CounterBillError("NOT_SPLITTABLE", err?.message || "Couldn't split this bill", 409);
  }

  const base = Math.floor(total / ways);
  const remainder = total - base * ways;
  const seller = await User.findById(ctx.userId).select("email").lean<{ email?: string }>();
  const shares: ICounterBillShare[] = [];
  for (let i = 0; i < ways; i++) {
    const amount = base + (i === 0 ? remainder : 0);
    const { invoice, payUrl } = await createEcommerceInvoice({
      userId: ctx.userId,
      customerEmail: seller?.email || "counter@garage.app",
      customerName: "Counter customer",
      items: [],
      customLines: [
        {
          kind: "custom",
          title: `Bill #${bill.billNumber} · share ${i + 1} of ${ways}`,
          orgId: String(bill.orgId),
          refId: String(bill._id),
          amount,
        },
      ],
      displayCurrency: "INR",
      requireShippingAddress: false,
      extraMetadata: {
        counterBillId: String(bill._id),
        counterBillNumber: bill.billNumber,
        counterBillShare: i,
        ...(bill.branchId ? { branchId: String(bill.branchId) } : {}),
        ...(bill.table ? { table: bill.table } : {}),
      },
    });
    shares.push({ index: i, amount, invoiceId: invoice._id, payUrl, status: "pending" as const });
  }
  bill.split = { ways, shares };
  bill.invoiceId = undefined;
  bill.payUrl = undefined;
  await bill.save();
  notifyCustomer(bill, "counter-bill:split");
  return bill;
}

// ── Customer side ───────────────────────────────────────────────────────────

/** A buyer scanned the bill's QR: put them on it. */
export async function attachCustomer(
  rawCode: string,
  buyerUserId: string
): Promise<ICounterBill> {
  const code = normaliseAttachCode(rawCode);
  if (!code) throw new CounterBillError("INVALID_CODE", "That code isn't a Garage bill", 400);
  const bill = await CounterBill.findOne({ attachCode: code });
  if (!bill) throw new CounterBillError("NOT_FOUND", "This bill has expired or was closed", 404);
  await syncBills([bill]);
  if (!EDITABLE.has(bill.status)) {
    throw new CounterBillError("CLOSED", `This bill is already ${bill.status}`, 409);
  }
  if (bill.customer?.userId && String(bill.customer.userId) !== buyerUserId) {
    throw new CounterBillError("TAKEN", "Someone else is already on this bill", 409);
  }

  const buyer = await User.findById(buyerUserId).select("name email phone").lean<{
    name?: string;
    email?: string;
    phone?: string;
  }>();
  if (!buyer) throw new CounterBillError("NOT_FOUND", "Account not found", 404);

  bill.customer = {
    userId: new Types.ObjectId(buyerUserId),
    name: buyer.name || bill.customer?.name,
    email: buyer.email,
    phone: buyer.phone || bill.customer?.phone,
    attachedAt: new Date(),
    via: "qr",
  };
  await bill.save();

  // Already sent: point the live invoice at them too, the same fields
  // POST /api/invoices/:id/customer sets, so coupons, GST and commissions run
  // off the buyer rather than the seller.
  if (bill.status === "sent" && bill.invoiceId) {
    await Invoice.updateOne(
      { _id: bill.invoiceId, status: { $in: ["draft", "pending", "failed"] } },
      {
        $set: {
          userId: bill.customer.userId,
          ...(buyer.email ? { customerEmail: buyer.email.toLowerCase() } : {}),
          ...(buyer.name ? { customerName: buyer.name } : {}),
        },
      }
    );
  }
  notifySeller(bill, "counter-bill:attached");
  return bill;
}

export async function requestCorrection(
  bill: ICounterBill,
  buyerUserId: string,
  note: string
): Promise<ICounterBill> {
  if (!bill.customer?.userId || String(bill.customer.userId) !== buyerUserId) {
    throw new CounterBillError("NOT_FOUND", "Bill not found", 404);
  }
  await syncBills([bill]);
  if (bill.status !== "sent" || bill.split?.shares?.length) {
    throw new CounterBillError("CLOSED", "This bill can't be changed now", 409);
  }
  bill.correction = {
    status: "requested",
    note: note.trim().slice(0, 500),
    requestedAt: new Date(),
    requestedBy: new Types.ObjectId(buyerUserId),
  };
  await bill.save();
  notifySeller(bill, "counter-bill:correction");
  return bill;
}

// ── Status sync ─────────────────────────────────────────────────────────────

const PAID_INVOICE = new Set(["paid", "completed", "fulfilled"]);

/**
 * Bring bills in line with their invoices. Every payment path marks the
 * invoice paid before anything else runs, so reading it is authoritative; the
 * fulfilInvoice hook (onInvoicePaid) just makes it immediate. Expiry is read
 * off `expiresAt` because the expiry cron only runs periodically.
 */
export async function syncBills(bills: ICounterBill[]): Promise<void> {
  const live = bills.filter((b) => b.status === "sent");
  if (!live.length) return;
  const ids = new Set<string>();
  for (const b of live) {
    if (b.invoiceId) ids.add(String(b.invoiceId));
    for (const s of b.split?.shares || []) if (s.invoiceId) ids.add(String(s.invoiceId));
  }
  if (!ids.size) return;
  const invoices = await Invoice.find({ _id: { $in: [...ids].map((i) => new Types.ObjectId(i)) } })
    .select("status paidAt expiresAt userId")
    .lean<Array<{ _id: Types.ObjectId; status: string; paidAt?: Date; expiresAt?: Date; userId?: Types.ObjectId }>>();
  const byId = new Map(invoices.map((i) => [String(i._id), i]));

  for (const bill of live) {
    let changed = false;
    if (bill.split?.shares?.length) {
      for (const s of bill.split.shares) {
        const inv = s.invoiceId ? byId.get(String(s.invoiceId)) : undefined;
        if (inv && s.status === "pending" && PAID_INVOICE.has(inv.status)) {
          s.status = "paid";
          s.paidAt = inv.paidAt || new Date();
          s.userId = inv.userId;
          changed = true;
        }
      }
      if (bill.split.shares.every((s) => s.status === "paid")) {
        bill.status = "paid";
        bill.paidAt = new Date(Math.max(...bill.split.shares.map((s) => +(s.paidAt || new Date()))));
        changed = true;
      }
    } else if (bill.invoiceId) {
      const inv = byId.get(String(bill.invoiceId));
      if (inv) {
        const expired =
          inv.status === "expired" ||
          (!PAID_INVOICE.has(inv.status) && inv.expiresAt && +inv.expiresAt < Date.now());
        if (PAID_INVOICE.has(inv.status)) {
          bill.status = "paid";
          bill.paidAt = inv.paidAt || new Date();
          changed = true;
        } else if (inv.status === "refunded") {
          bill.status = "refunded";
          changed = true;
        } else if (expired) {
          bill.status = "expired";
          changed = true;
        } else if (inv.status === "cancelled") {
          bill.status = "cancelled";
          bill.cancelledAt = bill.cancelledAt || new Date();
          changed = true;
        }
      }
    }
    if (changed) {
      if (bill.status !== "sent") bill.attachCode = undefined;
      await bill.save();
    }
  }
}

/**
 * Hook for fulfillInvoice — runs on every payment path. Idempotent: it only
 * re-reads the invoice and syncs, so the webhook/browser double call is safe.
 */
export async function onInvoicePaid(invoice: { _id: any; metadata?: any }): Promise<void> {
  const billId = invoice?.metadata?.counterBillId;
  if (!billId || !Types.ObjectId.isValid(billId)) return;
  const bill = await CounterBill.findById(billId);
  if (!bill) return;
  await syncBills([bill]);
  if (bill.status === "paid") {
    notifySeller(bill, "counter-bill:paid");
    notifyCustomer(bill, "counter-bill:paid");
  }
}

// ── Realtime ────────────────────────────────────────────────────────────────

async function emit(room: string, event: string, payload: unknown) {
  try {
    const { getSocketInstance } = await import("./socket");
    getSocketInstance()?.to(room).emit(event, payload);
  } catch (err) {
    console.warn(`[CounterBill] emit ${event} failed:`, err);
  }
}

function notifyCustomer(bill: ICounterBill, event: string) {
  if (!bill.customer?.userId) return;
  void emit(`user:${String(bill.customer.userId)}`, event, {
    billId: String(bill._id),
    status: bill.status,
  });
}

function notifySeller(bill: ICounterBill, event: string) {
  void emit(`org:${String(bill.orgId)}`, event, {
    billId: String(bill._id),
    status: bill.status,
  });
}

// ── Views ───────────────────────────────────────────────────────────────────

/** What the seller app gets. */
export function sellerView(bill: ICounterBill) {
  const o = bill.toObject ? bill.toObject() : (bill as any);
  return {
    ...o,
    _id: String(o._id),
    attachUrl: o.attachCode ? attachUrl(o.attachCode) : undefined,
    needsYou: o.correction?.status === "requested",
    itemCount:
      o.mode === "amount"
        ? 1
        : (o.lines || []).reduce((n: number, l: any) => n + (l.quantity || 0), 0),
  };
}

/** What the customer gets — no attach code, no seller-internal fields. */
export function customerView(bill: ICounterBill, storeName?: string) {
  const o = bill.toObject ? bill.toObject() : (bill as any);
  return {
    _id: String(o._id),
    billNumber: o.billNumber,
    storeName,
    branchName: o.branchName,
    table: o.table,
    guests: o.guests,
    mode: o.mode,
    lines: (o.lines || []).map((l: any) => ({
      title: l.title,
      variantTitle: l.variantTitle,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      addOns: l.addOns,
      diet: l.diet,
    })),
    amountLabel: o.amountLabel,
    note: o.note,
    status: o.status,
    totals: o.totals,
    payUrl: o.split?.shares?.length ? undefined : o.payUrl,
    invoiceId: o.invoiceId ? String(o.invoiceId) : undefined,
    split: o.split?.shares?.length
      ? {
          ways: o.split.ways,
          shares: o.split.shares.map((s: any) => ({
            index: s.index,
            amount: s.amount,
            status: s.status,
            payUrl: s.status === "pending" ? s.payUrl : undefined,
            invoiceId: s.invoiceId ? String(s.invoiceId) : undefined,
          })),
        }
      : undefined,
    correction: o.correction?.status
      ? { status: o.correction.status, note: o.correction.note, requestedAt: o.correction.requestedAt }
      : undefined,
    sentAt: o.sentAt,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
  };
}
