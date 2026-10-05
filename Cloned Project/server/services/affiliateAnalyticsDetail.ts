// src/services/affiliateAnalyticsDetail.ts
//
// Drill-down companion to affiliateAnalytics.ts. Given a userId + a `mode`
// (matching one of the two semantics on /affiliate/direct), returns the
// actual rows behind any one of the four counts a leaderboard row exposes:
//
//   transactions  ← stats.salesCount       (paid invoices)
//   products      ← stats.uniqueProducts   (distinct {itemType, itemId})
//   customers     ← stats.uniqueCustomers  (distinct invoice.userId)
//   businesses    ← stats.businessesCount  (distinct invoice.organizationId)
//
// Reconciliation guarantee: the `total` returned for each detail equals the
// matching count in `stats` for the same user/filters. We achieve that by
// reusing `buildSellerStatsMap` / `buildParentAggregateStatsMap` from the
// canonical stats service for the response's `stats` field, and by applying
// the *same* invoice $match clause those helpers build internally.

import { Types } from "mongoose";
import {
  AnalyticsRange,
  DirectReferralStats,
  StatsFilters,
  buildParentAggregateStatsMap,
  buildSellerStatsMap,
  resolveStatsFilters,
} from "./affiliateAnalytics";
import { Invoice } from "../models/invoice.model";
import { usdMinorExpr, usdRates } from "../utils/invoiceMoney";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Product } from "../models/product.model";
import { Course } from "../models/course.model";
import { Channel } from "../models/channel.model";
import { Workshop } from "../models/workshop.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { OfficePlan } from "../models/officePlan.model";

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

export type DetailKind =
  | "transactions"
  | "products"
  | "customers"
  | "businesses";

export type DrillDownMode = "leaderboard" | "affiliate-downline";

export interface GetRowDetailsParams {
  userId: string;
  mode: DrillDownMode;
  detail: DetailKind;
  filters: StatsFilters & { country?: string };
  limit: number;
  offset: number;
}

export interface RowUserInfo {
  _id: string;
  name: string | null;
  email: string | null;
  affiliateId: string | null;
  country: string | null;
  profilePicture: string | null;
  joinedAt: Date | null;
}

export interface RowDetailsResponse {
  user: RowUserInfo | null;
  mode: DrillDownMode;
  detail: DetailKind;
  stats: DirectReferralStats;
  items: any[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

const ZERO_STATS: DirectReferralStats = {
  totalSalesVolumeCents: 0,
  currency: "USD",
  salesCount: 0,
  businessesCount: 0,
  uniqueCustomers: 0,
  uniqueProducts: 0,
  commissionsDistributedCents: 0,
  commissionsEarnedCents: 0,
};

// ───────────────────────────────────────────────────────────────────────
// Seller scope: which sellerIds do we query Invoice with?
//
//   mode = affiliate-downline: the row's user IS the seller.
//   mode = leaderboard:        the row's user is the PARENT; sellers are
//                              their direct downline (= users with
//                              referredBy === userId).
// ───────────────────────────────────────────────────────────────────────

export async function resolveSellerIdsForRow(
  userId: Types.ObjectId,
  mode: DrillDownMode
): Promise<Types.ObjectId[]> {
  if (mode === "affiliate-downline") return [userId];
  const directs = await User.find(
    { referredBy: userId },
    { _id: 1 }
  ).lean();
  return (directs as any[]).map((u) => u._id);
}

// ───────────────────────────────────────────────────────────────────────
// itemType → model resolver (for the products detail)
// ───────────────────────────────────────────────────────────────────────

interface ItemModelSpec {
  model: any;
  nameField: string;
  imageField: string | null;
  descriptionField?: string;
}

const ITEM_MODEL_MAP: Record<string, ItemModelSpec> = {
  product: { model: Product, nameField: "name", imageField: "images", descriptionField: "description" },
  ecommerce_item: { model: Product, nameField: "name", imageField: "images", descriptionField: "description" },
  course: { model: Course, nameField: "title", imageField: "coverImage", descriptionField: "description" },
  channel: { model: Channel, nameField: "title", imageField: "coverImage", descriptionField: "description" },
  workshop: { model: Workshop, nameField: "title", imageField: "thumbnail", descriptionField: "description" },
  service: { model: Service, nameField: "title", imageField: "coverImage", descriptionField: "description" },
  call: { model: CallOffering, nameField: "title", imageField: "coverImage", descriptionField: "description" },
  office_plan: { model: OfficePlan, nameField: "name", imageField: null, descriptionField: "description" },
  // itemTypes with no dedicated collection — name/image fall back to the
  // values captured on the line item at purchase time.
  // unilevel_plus, third_party_subscription, bat246_membership
};

// ───────────────────────────────────────────────────────────────────────
// Public entrypoint — what the route calls
// ───────────────────────────────────────────────────────────────────────

export async function getRowDetails(
  params: GetRowDetailsParams
): Promise<RowDetailsResponse> {
  const { userId, mode, detail, filters, limit, offset } = params;
  const userIdObj = new Types.ObjectId(userId);

  // ── Row identity + the stats block (the response's source of truth for
  //    the per-row counts the FE will rely on). Compute via the SAME helpers
  //    that /affiliate/direct uses so reconciliation is automatic.
  const userDoc = await User.findById(userIdObj)
    .select("name email affiliateId country profilePicture createdAt")
    .lean();
  const user: RowUserInfo | null = userDoc
    ? {
        _id: String((userDoc as any)._id),
        name: (userDoc as any).name || null,
        email: (userDoc as any).email || null,
        affiliateId: (userDoc as any).affiliateId || null,
        country: (userDoc as any).country || null,
        profilePicture: (userDoc as any).profilePicture || null,
        joinedAt: (userDoc as any).createdAt || null,
      }
    : null;

  let stats: DirectReferralStats = { ...ZERO_STATS };
  if (mode === "leaderboard") {
    const { statsByParent } = await buildParentAggregateStatsMap(
      [userIdObj],
      { officeId: filters.officeId, category: filters.category, range: filters.range }
    );
    stats = statsByParent.get(String(userIdObj)) || { ...ZERO_STATS };
  } else {
    const sellerStats = await buildSellerStatsMap(
      [userIdObj],
      { officeId: filters.officeId, category: filters.category, range: filters.range }
    );
    stats = sellerStats.get(String(userIdObj)) || { ...ZERO_STATS };
  }

  // ── Build the invoice $match clause — IDENTICAL to what the stats
  //    helpers use internally. Keep this aligned with the corresponding
  //    section inside affiliateAnalytics.ts so totals reconcile.
  const sellerIds = await resolveSellerIdsForRow(userIdObj, mode);
  const { paidAfter, orgIdFilter } = await resolveStatsFilters({
    officeId: filters.officeId,
    category: filters.category,
    range: filters.range,
  });

  // Short-circuit cases that produce zero matches without hitting Invoice.
  const noRows =
    sellerIds.length === 0 ||
    (orgIdFilter !== null && orgIdFilter.length === 0);

  const invoiceMatch: any = {
    sellerId: { $in: sellerIds },
    status: "paid",
  };
  if (paidAfter) invoiceMatch.paidAt = { $gte: paidAfter };
  if (orgIdFilter) invoiceMatch.organizationId = { $in: orgIdFilter };

  let items: any[] = [];
  let total = 0;

  if (!noRows) {
    switch (detail) {
      case "transactions":
        ({ items, total } = await listTransactions(invoiceMatch, limit, offset));
        break;
      case "products":
        ({ items, total } = await listProducts(invoiceMatch, limit, offset));
        break;
      case "customers":
        ({ items, total } = await listCustomers(invoiceMatch, limit, offset));
        break;
      case "businesses":
        ({ items, total } = await listBusinesses(invoiceMatch, limit, offset));
        break;
    }
  }

  const hasMore = offset + items.length < total;
  const nextOffset = hasMore ? offset + items.length : null;

  return {
    user,
    mode,
    detail,
    stats,
    items,
    pagination: { limit, offset, total, hasMore, nextOffset },
  };
}

// ───────────────────────────────────────────────────────────────────────
// transactions — paid invoices in scope
// Total = count of matching invoices (= stats.salesCount).
// ───────────────────────────────────────────────────────────────────────

async function listTransactions(
  invoiceMatch: any,
  limit: number,
  offset: number
) {
  const [total, invoices] = await Promise.all([
    Invoice.countDocuments(invoiceMatch),
    Invoice.find(invoiceMatch)
      .sort({ paidAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .select(
        "invoiceNumber totalAmount itemCurrency status paidAt createdAt " +
          "sellerId userId organizationId customerEmail customerName " +
          "lineItems commissionDistributionId"
      )
      .lean(),
  ]);

  // Hydrate seller / customer / org in one shot per type.
  const sellerIds = new Set<string>();
  const customerIds = new Set<string>();
  const orgIds = new Set<string>();
  for (const inv of invoices as any[]) {
    if (inv.sellerId) sellerIds.add(String(inv.sellerId));
    if (inv.userId) customerIds.add(String(inv.userId));
    if (inv.organizationId) orgIds.add(String(inv.organizationId));
  }
  const [sellers, customers, orgs] = await Promise.all([
    sellerIds.size
      ? User.find({ _id: { $in: [...sellerIds].map((s) => new Types.ObjectId(s)) } })
          .select("name email affiliateId profilePicture")
          .lean()
      : Promise.resolve([]),
    customerIds.size
      ? User.find({ _id: { $in: [...customerIds].map((s) => new Types.ObjectId(s)) } })
          .select("name email profilePicture")
          .lean()
      : Promise.resolve([]),
    orgIds.size
      ? Organization.find({ _id: { $in: [...orgIds].map((s) => new Types.ObjectId(s)) } })
          .select("name slug")
          .lean()
      : Promise.resolve([]),
  ]);
  const sellerById = new Map<string, any>(
    (sellers as any[]).map((u) => [String(u._id), u])
  );
  const customerById = new Map<string, any>(
    (customers as any[]).map((u) => [String(u._id), u])
  );
  const orgById = new Map<string, any>(
    (orgs as any[]).map((o) => [String(o._id), o])
  );

  const items = (invoices as any[]).map((inv) => {
    const seller = inv.sellerId ? sellerById.get(String(inv.sellerId)) : null;
    const customer = inv.userId ? customerById.get(String(inv.userId)) : null;
    const org = inv.organizationId
      ? orgById.get(String(inv.organizationId))
      : null;
    return {
      _id: String(inv._id),
      invoiceNumber: inv.invoiceNumber || null,
      totalAmount: inv.totalAmount || 0,
      itemCurrency: inv.itemCurrency || "USD",
      status: inv.status,
      paidAt: inv.paidAt || null,
      createdAt: inv.createdAt || null,
      seller: seller
        ? {
            _id: String(seller._id),
            name: seller.name || null,
            email: seller.email || null,
            affiliateId: seller.affiliateId || null,
            profilePicture: seller.profilePicture || null,
          }
        : null,
      customer: customer
        ? {
            _id: String(customer._id),
            name: customer.name || inv.customerName || null,
            email: customer.email || inv.customerEmail || null,
            profilePicture: customer.profilePicture || null,
          }
        : inv.customerEmail || inv.customerName
        ? {
            _id: null,
            name: inv.customerName || null,
            email: inv.customerEmail || null,
            profilePicture: null,
          }
        : null,
      organization: org
        ? { _id: String(org._id), name: org.name || null, slug: org.slug || null }
        : null,
      lineItems: (inv.lineItems || []).map((li: any) => ({
        itemType: li.itemType,
        itemId: li.itemId ? String(li.itemId) : null,
        itemName: li.itemName || null,
        itemImage: li.itemImage || null,
        quantity: li.quantity || 0,
        unitPrice: li.unitPrice || 0,
        totalPrice: li.totalPrice || 0,
        vendor: li.vendor || null,
      })),
      commissionDistributionId: inv.commissionDistributionId
        ? String(inv.commissionDistributionId)
        : null,
    };
  });

  return { items, total };
}

// ───────────────────────────────────────────────────────────────────────
// products — distinct {itemType, itemId} sold within scope.
// Total = count of distinct pairs (= stats.uniqueProducts).
// ───────────────────────────────────────────────────────────────────────

async function listProducts(
  invoiceMatch: any,
  limit: number,
  offset: number
) {
  // Page of distinct items, sorted by revenue desc so the most impactful
  // products lead. The $facet returns both the slice and the total count
  // in one round-trip so pagination math doesn't drift from the totals.
  const pipeline: any[] = [
    { $match: invoiceMatch },
    { $unwind: "$lineItems" },
    {
      $group: {
        _id: {
          itemType: "$lineItems.itemType",
          itemId: "$lineItems.itemId",
        },
        itemName: { $first: "$lineItems.itemName" },
        itemImage: { $first: "$lineItems.itemImage" },
        salesCount: { $sum: 1 },
        quantitySold: { $sum: "$lineItems.quantity" },
        totalRevenueCents: { $sum: "$lineItems.totalPrice" },
        customers: { $addToSet: "$userId" },
      },
    },
    {
      $facet: {
        total: [{ $count: "n" }],
        items: [
          { $sort: { totalRevenueCents: -1 } },
          { $skip: offset },
          { $limit: limit },
        ],
      },
    },
  ];

  const result = await Invoice.aggregate(pipeline);
  const total = (result?.[0]?.total?.[0]?.n as number) || 0;
  const rows = (result?.[0]?.items || []) as any[];

  // Group itemIds by itemType so we issue at most one query per itemType.
  const idsByType = new Map<string, Types.ObjectId[]>();
  for (const r of rows) {
    const t = r._id.itemType as string;
    if (!idsByType.has(t)) idsByType.set(t, []);
    if (r._id.itemId) idsByType.get(t)!.push(r._id.itemId);
  }

  type ItemDoc = { name?: string | null; image?: string | null; description?: string | null };
  const docsByKey = new Map<string, ItemDoc>(); // key = `${itemType}:${itemId}`
  await Promise.all(
    [...idsByType.entries()].map(async ([itemType, ids]) => {
      const spec = ITEM_MODEL_MAP[itemType];
      if (!spec || ids.length === 0) return;
      const projection: any = { _id: 1, [spec.nameField]: 1 };
      if (spec.imageField) projection[spec.imageField] = 1;
      if (spec.descriptionField) projection[spec.descriptionField] = 1;
      const docs = await spec.model
        .find({ _id: { $in: ids } }, projection)
        .lean();
      for (const d of docs as any[]) {
        let image: string | null = null;
        if (spec.imageField) {
          const raw = d[spec.imageField];
          // `Product.images` is an array; the rest are single strings.
          image = Array.isArray(raw) ? raw[0] || null : raw || null;
        }
        const description = spec.descriptionField
          ? d[spec.descriptionField] || null
          : null;
        docsByKey.set(`${itemType}:${String(d._id)}`, {
          name: d[spec.nameField] || null,
          image,
          description,
        });
      }
    })
  );

  const items = rows.map((r) => {
    const itemType = r._id.itemType as string;
    const itemIdStr = r._id.itemId ? String(r._id.itemId) : null;
    const key = itemIdStr ? `${itemType}:${itemIdStr}` : null;
    const resolved = key ? docsByKey.get(key) : undefined;
    return {
      itemType,
      itemId: itemIdStr,
      // Fall back to the lineItem snapshot if the item was deleted or its
      // itemType has no detail collection (unilevel_plus etc.). This keeps
      // the count consistent with stats.uniqueProducts.
      name: resolved?.name || r.itemName || null,
      image: resolved?.image || r.itemImage || null,
      details: {
        description: resolved?.description || null,
      },
      salesCount: r.salesCount || 0,
      quantitySold: r.quantitySold || 0,
      totalRevenueCents: Math.round(r.totalRevenueCents || 0),
      distinctCustomers: (r.customers || []).length,
    };
  });

  return { items, total };
}

// ───────────────────────────────────────────────────────────────────────
// customers — distinct invoice.userId within scope.
// Total = count of distinct userIds (= stats.uniqueCustomers).
// ───────────────────────────────────────────────────────────────────────

async function listCustomers(
  invoiceMatch: any,
  limit: number,
  offset: number
) {
  // `totalAmount` is minor units of `itemCurrency`, so it is converted to USD
  // minor units INSIDE the pipeline — the sort and pagination below run on
  // this figure, and adding `itemCurrency` to the group key would split one
  // customer into a row per currency. See utils/invoiceMoney.ts.
  const [rates, currencies] = await Promise.all([
    usdRates(),
    Invoice.distinct("itemCurrency", invoiceMatch),
  ]);
  const usdMinor = usdMinorExpr(rates, currencies as string[]);

  const pipeline: any[] = [
    { $match: invoiceMatch },
    {
      $group: {
        _id: "$userId",
        invoiceCount: { $sum: 1 },
        totalSpentCents: { $sum: usdMinor },
        firstPurchaseAt: { $min: "$paidAt" },
        lastPurchaseAt: { $max: "$paidAt" },
        distinctOrgs: { $addToSet: "$organizationId" },
      },
    },
    {
      $facet: {
        total: [{ $count: "n" }],
        items: [
          { $sort: { totalSpentCents: -1 } },
          { $skip: offset },
          { $limit: limit },
        ],
      },
    },
  ];

  const result = await Invoice.aggregate(pipeline);
  const total = (result?.[0]?.total?.[0]?.n as number) || 0;
  const rows = (result?.[0]?.items || []) as any[];

  const ids = rows.map((r) => r._id).filter(Boolean);
  const users = ids.length
    ? await User.find({ _id: { $in: ids } })
        .select("name email profilePicture country createdAt")
        .lean()
    : [];
  const byId = new Map<string, any>(
    (users as any[]).map((u) => [String(u._id), u])
  );

  const items = rows.map((r) => {
    const uid = r._id ? String(r._id) : null;
    const u = uid ? byId.get(uid) : null;
    return {
      _id: uid,
      name: u?.name || null,
      email: u?.email || null,
      profilePicture: u?.profilePicture || null,
      country: u?.country || null,
      joinedAt: u?.createdAt || null,
      invoiceCount: r.invoiceCount || 0,
      totalSpentCents: Math.round(r.totalSpentCents || 0),
      firstPurchaseAt: r.firstPurchaseAt || null,
      lastPurchaseAt: r.lastPurchaseAt || null,
      distinctOrgsBought: (r.distinctOrgs || []).filter(Boolean).length,
    };
  });

  return { items, total };
}

// ───────────────────────────────────────────────────────────────────────
// businesses — distinct invoice.organizationId within scope.
// Total = count of distinct organizationIds (= stats.businessesCount).
// ───────────────────────────────────────────────────────────────────────

async function listBusinesses(
  invoiceMatch: any,
  limit: number,
  offset: number
) {
  // Same conversion as listCustomers — see utils/invoiceMoney.ts.
  const [rates, currencies] = await Promise.all([
    usdRates(),
    Invoice.distinct("itemCurrency", invoiceMatch),
  ]);
  const usdMinor = usdMinorExpr(rates, currencies as string[]);

  const pipeline: any[] = [
    { $match: invoiceMatch },
    {
      $group: {
        _id: "$organizationId",
        salesCount: { $sum: 1 },
        totalRevenueCents: { $sum: usdMinor },
        customers: { $addToSet: "$userId" },
        products: {
          $addToSet: {
            $map: {
              input: { $ifNull: ["$lineItems", []] },
              as: "li",
              in: { itemType: "$$li.itemType", itemId: "$$li.itemId" },
            },
          },
        },
      },
    },
    {
      $facet: {
        total: [{ $count: "n" }],
        items: [
          { $sort: { totalRevenueCents: -1 } },
          { $skip: offset },
          { $limit: limit },
        ],
      },
    },
  ];

  const result = await Invoice.aggregate(pipeline);
  const total = (result?.[0]?.total?.[0]?.n as number) || 0;
  const rows = (result?.[0]?.items || []) as any[];

  const ids = rows.map((r) => r._id).filter(Boolean);
  const orgs = ids.length
    ? await Organization.find({ _id: { $in: ids } })
        .select("name slug category country")
        .lean()
    : [];
  const byId = new Map<string, any>(
    (orgs as any[]).map((o) => [String(o._id), o])
  );

  const items = rows.map((r) => {
    const oid = r._id ? String(r._id) : null;
    const o = oid ? byId.get(oid) : null;
    // `products` is array-of-array (one inner array per invoice); flatten
    // and dedupe to count distinct (itemType, itemId) pairs sold by this org.
    const productKeys = new Set<string>();
    for (const arr of r.products || []) {
      for (const it of arr || []) {
        if (it?.itemType && it?.itemId) {
          productKeys.add(`${it.itemType}:${String(it.itemId)}`);
        }
      }
    }
    return {
      _id: oid,
      name: o?.name || null,
      slug: o?.slug || null,
      category: o?.category || null,
      country: o?.country || null,
      salesCount: r.salesCount || 0,
      totalRevenueCents: Math.round(r.totalRevenueCents || 0),
      distinctCustomers: (r.customers || []).filter(Boolean).length,
      distinctProducts: productKeys.size,
    };
  });

  return { items, total };
}

// Re-export the analytics-range type for the route layer.
export type { AnalyticsRange };
