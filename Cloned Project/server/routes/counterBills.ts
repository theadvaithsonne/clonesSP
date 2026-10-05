import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { CounterBill, ICounterBill } from "../models/counterBill.model";
import { Store } from "../models/store.model";
import { EcommerceError } from "../services/ecommerceInvoice";
import {
  CounterBillError,
  SellerContext,
  attachCustomer,
  cancelBill,
  createDraft,
  customerView,
  loadOwnBill,
  priceBill,
  requestCorrection,
  sellerView,
  sendBill,
  splitBill,
  syncBills,
  updateBill,
} from "../services/counterBill";

/**
 * Counter bills — the Garage IRL seller app's Bills tab and New bill screen,
 * plus the three things a customer does with one: attach to it by scanning,
 * see it, and ask for a correction. See services/counterBill.ts.
 *
 * Seller routes act on the store the token is scoped to (req.user.orgId) and
 * require a real, non-guest membership of it — the token's org claim alone is
 * not enough. Customer routes act as the signed-in buyer.
 */
const router = Router();

// ── Guards & errors ─────────────────────────────────────────────────────────

function requireStoreMember(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as { userId: string; orgId?: string } | undefined;
  const membership = (req as any).membership as { guest?: boolean } | null;
  if (!user?.orgId || !membership || membership.guest) {
    return res.status(403).json({
      success: false,
      code: "NOT_A_MEMBER",
      error: "Select a store you work at to manage its bills",
    });
  }
  next();
}

const ctxOf = (req: Request): SellerContext => {
  const u = (req as any).user as { userId: string; orgId: string };
  return { userId: u.userId, orgId: u.orgId };
};

function handleError(error: unknown, res: Response) {
  if (error instanceof CounterBillError || error instanceof EcommerceError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      error: error.message,
      ...((error as EcommerceError).details || {}),
    });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      code: "INVALID_INPUT",
      error: error.issues[0]?.message || "Invalid request payload",
      issues: error.issues,
    });
  }
  console.error("[CounterBills] Unexpected error:", error);
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    error: "Something went wrong with this bill",
  });
}

// ── Schemas ─────────────────────────────────────────────────────────────────

const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), "Invalid id");

const lineSchema = z.object({
  productId: objectId,
  variantId: objectId.optional(),
  title: z.string().trim().min(1).max(200),
  variantTitle: z.string().trim().max(120).optional(),
  image: z.string().max(2048).optional(),
  diet: z.string().max(20).nullable().optional(),
  unitPrice: z.number().int().min(0),
  quantity: z.number().int().min(1).max(999),
  addOns: z
    .array(z.object({ label: z.string().trim().min(1).max(80), price: z.number().int().min(0) }))
    .max(10)
    .optional(),
});

const billFields = z.object({
  mode: z.enum(["itemised", "amount"]).optional(),
  table: z.string().trim().max(40).optional(),
  guests: z.number().int().min(1).max(99).nullable().optional(),
  lines: z.array(lineSchema).max(50).optional(),
  amount: z.number().int().min(0).max(100_000_000).nullable().optional(),
  amountLabel: z.string().trim().max(120).optional(),
  serviceChargePct: z.number().min(0).max(30).optional(),
  packaging: z.number().int().min(0).max(10_000_000).optional(),
  couponCode: z.string().trim().max(20).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  branchId: objectId.nullable().optional(),
  branchName: z.string().trim().max(160).optional(),
  customer: z
    .object({
      name: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(20).optional(),
      email: z.string().trim().email().optional(),
    })
    .nullable()
    .optional(),
});

/** zod output → model patch (ids as ObjectIds, nulls as "unset"). */
function toPatch(body: z.infer<typeof billFields>): Partial<ICounterBill> {
  const patch: any = { ...body };
  if (body.lines) {
    patch.lines = body.lines.map((l) => ({
      ...l,
      productId: new Types.ObjectId(l.productId),
      variantId: l.variantId ? new Types.ObjectId(l.variantId) : undefined,
      addOns: l.addOns || [],
    }));
  }
  if ("branchId" in body) {
    patch.branchId = body.branchId ? new Types.ObjectId(body.branchId) : undefined;
  }
  for (const k of ["guests", "amount", "couponCode"] as const) {
    if (k in body && body[k] === null) patch[k] = undefined;
  }
  if (patch.couponCode) patch.couponCode = String(patch.couponCode).toUpperCase();
  return patch;
}

const addressSchema = z.object({
  fullName: z.string().min(1).max(120),
  addressLine1: z.string().min(3).max(250),
  addressLine2: z.string().max(250).optional().default(""),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(80),
  phone: z.string().regex(/^\+?\d{8,15}$/).optional(),
});

// ── Customer routes (declared before /:id) ──────────────────────────────────

/** POST /api/counter-bills/attach { code } — the buyer scanned a bill's QR. */
router.post("/attach", requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().min(1).max(200) }).parse(req.body);
    // Accept the whole scanned URL as well as the bare code.
    const bare = code.includes("/a/") ? code.split("/a/")[1].split(/[?#/]/)[0] : code;
    const user = (req as any).user as { userId: string };
    const bill = await attachCustomer(bare, user.userId);
    const store = await Store.findOne({ orgId: bill.orgId }).select("name").lean<{ name?: string }>();
    res.json({ success: true, bill: customerView(bill, store?.name) });
  } catch (err) {
    handleError(err, res);
  }
});

/** GET /api/counter-bills/mine — bills the signed-in buyer is on (last 30 days). */
router.get("/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bills = await CounterBill.find({
      "customer.userId": new Types.ObjectId(user.userId),
      createdAt: { $gte: since },
      status: { $ne: "draft" },
    })
      .sort({ createdAt: -1 })
      .limit(50);
    await syncBills(bills);
    const stores = await Store.find({ orgId: { $in: [...new Set(bills.map((b) => String(b.orgId)))] } })
      .select("orgId name")
      .lean<Array<{ orgId: Types.ObjectId; name?: string }>>();
    const nameOf = new Map(stores.map((s) => [String(s.orgId), s.name]));
    res.json({
      success: true,
      items: bills.map((b) => customerView(b, nameOf.get(String(b.orgId)))),
    });
  } catch (err) {
    handleError(err, res);
  }
});

/** GET /api/counter-bills/:id/for-me — one bill, as its customer sees it. */
router.get("/:id/for-me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const bill = Types.ObjectId.isValid(req.params.id)
      ? await CounterBill.findOne({
          _id: req.params.id,
          "customer.userId": new Types.ObjectId(user.userId),
        })
      : null;
    if (!bill) throw new CounterBillError("NOT_FOUND", "Bill not found", 404);
    await syncBills([bill]);
    const store = await Store.findOne({ orgId: bill.orgId }).select("name").lean<{ name?: string }>();
    res.json({ success: true, bill: customerView(bill, store?.name) });
  } catch (err) {
    handleError(err, res);
  }
});

/** POST /api/counter-bills/:id/correction { note } — "something's wrong with my bill". */
router.post("/:id/correction", requireAuth, async (req: Request, res: Response) => {
  try {
    const { note } = z.object({ note: z.string().trim().min(1).max(500) }).parse(req.body);
    const user = (req as any).user as { userId: string };
    const bill = Types.ObjectId.isValid(req.params.id) ? await CounterBill.findById(req.params.id) : null;
    if (!bill) throw new CounterBillError("NOT_FOUND", "Bill not found", 404);
    await requestCorrection(bill, user.userId, note);
    const store = await Store.findOne({ orgId: bill.orgId }).select("name").lean<{ name?: string }>();
    res.json({ success: true, bill: customerView(bill, store?.name) });
  } catch (err) {
    handleError(err, res);
  }
});

// ── Seller routes ───────────────────────────────────────────────────────────

const TABS = ["all", "needs_you", "open", "paid", "refunded"] as const;

function tabQuery(tab: (typeof TABS)[number]) {
  switch (tab) {
    case "needs_you":
      return { "correction.status": "requested", status: "sent" };
    case "open":
      return { status: { $in: ["draft", "sent"] } };
    case "paid":
      return { status: "paid" };
    case "refunded":
      return { status: "refunded" };
    default:
      return {};
  }
}

/**
 * GET /api/counter-bills?tab=&from=&to=&branchId=&q=&before=&limit=
 *
 * `from`/`to` are ISO instants — the app sends its own local "today" so the
 * day boundary is the store's, not the server's. Counts and the summary cover
 * the whole range regardless of tab, so every tab shows its number.
 */
router.get("/", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const q = z
      .object({
        tab: z.enum(TABS).optional().default("all"),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        branchId: objectId.optional(),
        q: z.string().trim().max(80).optional(),
        before: z.string().datetime().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional().default(40),
      })
      .parse(req.query);
    const { orgId } = ctxOf(req);

    const range: any = {
      orgId: new Types.ObjectId(orgId),
      // A draft nobody put anything on (the QR was shown, then abandoned) is
      // not a bill yet — keep it out of the list and the counts.
      $nor: [
        {
          status: "draft",
          "lines.0": { $exists: false },
          amount: { $in: [null, 0] },
        },
      ],
    };
    if (q.branchId) range.branchId = new Types.ObjectId(q.branchId);
    if (q.from || q.to) {
      range.createdAt = {};
      if (q.from) range.createdAt.$gte = new Date(q.from);
      if (q.to) range.createdAt.$lt = new Date(q.to);
    }
    if (q.q) {
      const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const n = Number(q.q.replace(/^#/, ""));
      range.$or = [
        { table: rx },
        { "customer.name": rx },
        { "customer.phone": rx },
        { "lines.title": rx },
        ...(Number.isInteger(n) && n > 0 ? [{ billNumber: n }] : []),
      ];
    }

    // Settle anything paid/expired since it was last looked at, so counts and
    // tabs are right. Bounded: a counter rarely has more than a few hundred
    // bills out at once.
    const open = await CounterBill.find({ ...range, status: "sent" }).limit(300);
    await syncBills(open);

    const page: any = { ...range, ...tabQuery(q.tab) };
    if (q.before) {
      page.createdAt = { ...(page.createdAt || {}), $lt: new Date(q.before) };
    }
    const items = await CounterBill.find(page).sort({ createdAt: -1 }).limit(q.limit + 1);
    const hasMore = items.length > q.limit;
    if (hasMore) items.pop();

    const [agg] = await CounterBill.aggregate([
      { $match: range },
      {
        $group: {
          _id: null,
          all: { $sum: 1 },
          needs_you: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$status", "sent"] }, { $eq: ["$correction.status", "requested"] }] },
                1,
                0,
              ],
            },
          },
          open: { $sum: { $cond: [{ $in: ["$status", ["draft", "sent"]] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          refunded: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] } },
          collected: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$totals.total", 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      items: items.map(sellerView),
      nextBefore: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
      counts: {
        all: agg?.all || 0,
        needs_you: agg?.needs_you || 0,
        open: agg?.open || 0,
        paid: agg?.paid || 0,
        refunded: agg?.refunded || 0,
      },
      summary: { collected: agg?.collected || 0, bills: agg?.all || 0, needYou: agg?.needs_you || 0 },
    });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * POST /api/counter-bills/preview — live totals for a bill being built.
 * Accepts the same fields as create; nothing is saved.
 */
router.post("/preview", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const body = billFields.extend({ billId: objectId.optional() }).parse(req.body);
    const ctx = ctxOf(req);
    // An attached customer changes who's paying (coupons, GST region), so a
    // saved bill's customer is priced in.
    const saved = body.billId ? await loadOwnBill(ctx, body.billId) : null;
    const patch = toPatch(body);
    const result = await priceBill(
      {
        _id: saved?._id || new Types.ObjectId(),
        orgId: new Types.ObjectId(ctx.orgId),
        mode: patch.mode || "itemised",
        lines: patch.lines || [],
        amount: patch.amount,
        amountLabel: patch.amountLabel,
        serviceChargePct: patch.serviceChargePct || 0,
        packaging: patch.packaging || 0,
        couponCode: patch.couponCode,
        customer: saved?.customer,
      } as any,
      ctx.userId
    );
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(err, res);
  }
});

/** POST /api/counter-bills — start a bill (a draft). */
router.post("/", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const body = billFields.parse(req.body);
    const bill = await createDraft(ctxOf(req), toPatch(body));
    res.status(201).json({ success: true, bill: sellerView(bill) });
  } catch (err) {
    handleError(err, res);
  }
});

/** GET /api/counter-bills/:id */
router.get("/:id", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const bill = await loadOwnBill(ctxOf(req), req.params.id);
    await syncBills([bill]);
    res.json({ success: true, bill: sellerView(bill) });
  } catch (err) {
    handleError(err, res);
  }
});

/** PATCH /api/counter-bills/:id — edit a draft (or a sent bill before re-sending). */
router.patch("/:id", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const body = billFields.parse(req.body);
    const bill = await loadOwnBill(ctxOf(req), req.params.id);
    await syncBills([bill]);
    await updateBill(bill, toPatch(body));
    res.json({ success: true, bill: sellerView(bill) });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * POST /api/counter-bills/:id/send { shippingAddress? }
 * The address is the outlet's (place of supply for GST); nothing ships.
 */
router.post("/:id/send", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const body = z.object({ shippingAddress: addressSchema.optional() }).parse(req.body || {});
    const ctx = ctxOf(req);
    const bill = await loadOwnBill(ctx, req.params.id);
    await syncBills([bill]);
    await sendBill(ctx, bill, { shippingAddress: body.shippingAddress as any });
    res.json({ success: true, bill: sellerView(bill) });
  } catch (err) {
    handleError(err, res);
  }
});

/** POST /api/counter-bills/:id/cancel */
router.post("/:id/cancel", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const bill = await loadOwnBill(ctxOf(req), req.params.id);
    await cancelBill(bill);
    res.json({ success: true, bill: sellerView(bill) });
  } catch (err) {
    handleError(err, res);
  }
});

/** POST /api/counter-bills/:id/split { ways } */
router.post("/:id/split", requireAuth, requireStoreMember, async (req: Request, res: Response) => {
  try {
    const { ways } = z.object({ ways: z.number().int().min(2).max(20) }).parse(req.body);
    const ctx = ctxOf(req);
    const bill = await loadOwnBill(ctx, req.params.id);
    await splitBill(ctx, bill, ways);
    res.json({ success: true, bill: sellerView(bill) });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * POST /api/counter-bills/:id/correction/dismiss — the seller checked and
 * nothing needs changing. (Editing and re-sending resolves it too.)
 */
router.post(
  "/:id/correction/dismiss",
  requireAuth,
  requireStoreMember,
  async (req: Request, res: Response) => {
    try {
      const bill = await loadOwnBill(ctxOf(req), req.params.id);
      if (bill.correction?.status === "requested") {
        bill.correction.status = "resolved";
        bill.correction.resolvedAt = new Date();
        await bill.save();
      }
      res.json({ success: true, bill: sellerView(bill) });
    } catch (err) {
      handleError(err, res);
    }
  }
);

export default router;
