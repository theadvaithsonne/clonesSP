import { Types } from "mongoose";
import { Product } from "../models/product.model";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Service } from "../models/service.model";
import { Workshop } from "../models/workshop.model";
import { StoreProduct } from "../models/storeProduct.model";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import {
  deriveSessionStatus,
  isWorkshopDeleted,
  computeSessionWindow,
  sessionDayKey,
} from "../utils/workshopStatus";
import { calculateSessions } from "../utils/recurrence";
import type { InvoiceItemType } from "../models/invoice.model";

// ── Unified "sellable" type used by the webinar pin picker + invoice generate ──

export type SellableItemType =
  | "product"
  | "store-product"
  | "channel"
  | "course"
  | "service"
  | "workshop"
  // A partner subscription sold through Garage Store (the $25 Unilevel
  // Plus combo). Not a row in any sellables collection — it resolves
  // from the ThirdPartyClient catalog, see getGarageStoreSellable.
  | "garage-store";

export interface Sellable {
  itemType: SellableItemType;
  itemId: string;
  name: string;
  description?: string;
  price: number; // Major units (dollars/rupees), not paise
  currency: string;
  image?: string;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  // Unified shippability flag — true for storefront merch and any
  // legacy product flagged !isDigital. Drives the Physical /
  // Digital tabs on the webinar pin picker.
  isPhysical?: boolean;
  // Who receives the sale (founder/creator of the item).
  sellerId?: string;
  // Organization the item belongs to.
  organizationId: string;
  // Storefront identity — only set on store-product items. The webinar
  // pin picker drops physical items without a storeSlug because the
  // buy-now overlay can't drive checkout otherwise. Without these,
  // every storeproduct returned here gets silently filtered on the
  // client.
  storeSlug?: string;
  storeName?: string;
}

// Normalize the price: `price` is the single source of truth (0 = free).
function effectivePrice(price: number | undefined): number {
  return typeof price === "number" ? price : 0;
}

// ── Individual type lookups ────────────────────────────────────────────────

async function getProductSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  const product = await Product.findOne({
    _id: new Types.ObjectId(itemId),
    organizationId: new Types.ObjectId(orgId),
    status: "active",
  }).lean();
  if (!product) return null;
  return {
    itemType: "product",
    itemId: product._id.toString(),
    name: product.name,
    description: product.description,
    price: effectivePrice(product.price),
    currency: product.currency || "USD",
    image: product.images?.[0],
    isSubscription: !!product.isSubscription,
    subscriptionPeriod: product.subscriptionPeriod,
    isPhysical: (product as any).isDigital === false,
    sellerId: product.createdBy?.toString(),
    organizationId: product.organizationId.toString(),
  };
}

async function getStoreProductSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  const sp = await StoreProduct.findOne({
    _id: new Types.ObjectId(itemId),
    orgId: new Types.ObjectId(orgId),
    status: "active",
  }).lean();
  if (!sp) return null;
  return {
    itemType: "store-product",
    itemId: sp._id.toString(),
    name: (sp as any).title,
    description: (sp as any).description,
    // Storefront stores main-unit prices directly; no discount column.
    price: typeof (sp as any).price === "number" ? (sp as any).price : 0,
    currency: (sp as any).currency || "USD",
    image:
      (sp as any).featuredImage ||
      (Array.isArray((sp as any).images) && (sp as any).images[0]?.url) ||
      undefined,
    isSubscription: false,
    isPhysical: (sp as any).isPhysicalProduct === true,
    sellerId: (sp as any).vendor || undefined,
    organizationId: (sp as any).orgId.toString(),
  };
}

async function getChannelSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  const channel = await Channel.findOne({
    _id: new Types.ObjectId(itemId),
    storeId: new Types.ObjectId(orgId),
    isActive: true,
  }).lean();
  if (!channel) return null;
  return {
    itemType: "channel",
    itemId: channel._id.toString(),
    name: (channel as any).title,
    description: (channel as any).description,
    price: effectivePrice((channel as any).price),
    currency: (channel as any).currency || "USD",
    image: (channel as any).coverImage,
    isSubscription: !!(channel as any).isSubscription,
    subscriptionPeriod: (channel as any).subscriptionPeriod,
    sellerId: (channel as any).createdBy?.toString(),
    organizationId: (channel as any).storeId.toString(),
  };
}

async function getCourseSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  const course = await Course.findOne({
    _id: new Types.ObjectId(itemId),
    organizationId: new Types.ObjectId(orgId),
    status: "published",
  }).lean();
  if (!course) return null;
  return {
    itemType: "course",
    itemId: course._id.toString(),
    name: (course as any).title,
    description: (course as any).description,
    price: effectivePrice((course as any).price),
    currency: (course as any).currency || "USD",
    image: (course as any).coverImage,
    isSubscription: !!(course as any).isSubscription,
    subscriptionPeriod: (course as any).subscriptionPeriod,
    sellerId: (course as any).createdBy?.toString(),
    organizationId: (course as any).organizationId.toString(),
  };
}

async function getServiceSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  const service = await Service.findOne({
    _id: new Types.ObjectId(itemId),
    organizationId: new Types.ObjectId(orgId),
    status: "active",
  }).lean();
  if (!service) return null;
  return {
    itemType: "service",
    itemId: service._id.toString(),
    name: (service as any).title,
    description: (service as any).description,
    price: (service as any).totalPrice || 0,
    currency: (service as any).currency || "USD",
    image: (service as any).coverImage || (service as any).icon,
    isSubscription: false,
    sellerId: (service as any).createdBy?.toString(),
    organizationId: (service as any).organizationId.toString(),
  };
}

async function getWorkshopSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(itemId),
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  }).lean();
  if (!workshop) return null;
  return {
    itemType: "workshop",
    itemId: workshop._id.toString(),
    name: (workshop as any).title,
    description: (workshop as any).description,
    price: effectivePrice((workshop as any).price),
    currency: (workshop as any).currency || "USD",
    image: (workshop as any).thumbnail,
    isSubscription: !!(workshop as any).isSubscription,
    subscriptionPeriod: (workshop as any).subscriptionPeriod,
    sellerId: (workshop as any).createdBy?.toString(),
    organizationId: (workshop as any).orgId.toString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Garage Store plan — a partner subscription (NetworkChains today) that a
 * host can pin during a webinar. There's no per-org row for it: the plan
 * belongs to the platform, and `itemId` is the ThirdPartyClient's id.
 *
 * The price returned here is the plan's LIST price, used only for the
 * picker card and the pin record. What a given viewer actually pays is
 * resolved per-viewer at buy time (`GET /unilevel-plus/product`), because
 * it depends on their own 24h combo window, whether they already own
 * Unilevel Plus, and whether they've used the combo before.
 */
async function getGarageStoreSellable(
  orgId: string,
  itemId: string
): Promise<Sellable | null> {
  // Ids are "<catalogId>" or "<catalogId>:<termMonths>". Each term of a
  // partner subscription is pinned as its own plan, so the term has to
  // ride along on the id — a pin carries nothing else.
  const [catalogId, termRaw] = String(itemId).split(":");
  if (!Types.ObjectId.isValid(catalogId)) return null;
  const termMonths = Number(termRaw) > 0 ? Number(termRaw) : null;

  // Two kinds of plan share this itemType, told apart by which catalog
  // the id resolves in. Partner subscriptions are checked first because
  // they're the common case; an office plan falls through to the second
  // lookup.
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const client = await ThirdPartyClient.findOne({
    _id: catalogId,
    isActive: true,
  }).lean<any>();
  if (client?.productConfig) {
    const { listActiveTermPlans } = await import("./thirdPartyTerms");
    const term = termMonths
      ? listActiveTermPlans(client.productConfig).find(
          (t: any) => t.termMonths === termMonths,
        )
      : null;
    const label = term
      ? term.label || `${term.termMonths} month${term.termMonths > 1 ? "s" : ""}`
      : null;
    return {
      itemType: "garage-store",
      itemId,
      name: label ? `${client.name} — ${label}` : client.name,
      description: `${client.name} subscription — billed ${client.productConfig.recurringPeriod}.`,
      // List price only. Every viewer is re-quoted at buy time from their
      // own combo window (see the FE's resolveGarageStoreItem).
      price: term ? term.totalAmount : client.productConfig.totalAmount,
      currency: "USD",
      isSubscription: true,
      subscriptionPeriod: client.productConfig.recurringPeriod,
      isPhysical: false,
      organizationId: orgId,
    };
  }

  // Garage office plan (Starter / Pro) — what "Launch an Office" sells.
  // `amount` is stored in CENTS and excludes GST; Sellable.price is in
  // major units, and GST is region-dependent (India only), so the buyer
  // sees the base price here and the real total at checkout.
  const { OfficePlan } = await import("../models/officePlan.model");
  const plan = await OfficePlan.findOne({
    _id: catalogId,
    isActive: true,
  }).lean<any>();
  if (plan) {
    return {
      itemType: "garage-store",
      itemId: String(plan._id),
      name: `Garage ${plan.name}`,
      description:
        plan.description || `Garage office — billed ${plan.period}.`,
      price: plan.amount / 100,
      currency: plan.currency || "USD",
      isSubscription: true,
      subscriptionPeriod: plan.period,
      isPhysical: false,
      organizationId: orgId,
    };
  }

  return null;
}

export async function getSellable(
  orgId: string,
  itemType: SellableItemType,
  itemId: string
): Promise<Sellable | null> {
  // Garage Store ids are composite ("<clientId>:<termMonths>"), so they
  // can't pass the plain ObjectId guard below — resolve them first.
  if (itemType === "garage-store") {
    if (!Types.ObjectId.isValid(orgId)) return null;
    return getGarageStoreSellable(orgId, itemId);
  }
  if (!Types.ObjectId.isValid(orgId) || !Types.ObjectId.isValid(itemId)) {
    return null;
  }
  switch (itemType) {
    case "product":
      return getProductSellable(orgId, itemId);
    case "store-product":
      return getStoreProductSellable(orgId, itemId);
    case "channel":
      return getChannelSellable(orgId, itemId);
    case "course":
      return getCourseSellable(orgId, itemId);
    case "service":
      return getServiceSellable(orgId, itemId);
    case "workshop":
      return getWorkshopSellable(orgId, itemId);
    default:
      return null;
  }
}

/**
 * Keep only the workshops that are still on sale — i.e. whose derived
 * status is "active": at least one session that hasn't completed and
 * hasn't been trashed. Completed and soft-deleted webinars are dropped.
 *
 * Status is derived exactly as the Workshops page does it
 * (`deriveSessionStatus`), so a founder who ends a session early sees it
 * leave the Shop immediately rather than at its scheduled end time.
 */
async function filterSellableWorkshops(
  workshops: any[],
  now: Date
): Promise<any[]> {
  if (workshops.length === 0) return [];

  const overrides = await WorkshopSessionOverride.find({
    workshopId: { $in: workshops.map((w) => w._id) },
  })
    .select("workshopId sessionDate manualStartedAt manualEndedAt deletedAt restoredAt")
    .lean();

  // workshopId → (UTC day key → override)
  const byWorkshop = new Map<string, Map<string, any>>();
  for (const o of overrides as any[]) {
    const wsId = String(o.workshopId);
    let inner = byWorkshop.get(wsId);
    if (!inner) {
      inner = new Map<string, any>();
      byWorkshop.set(wsId, inner);
    }
    inner.set(sessionDayKey(new Date(o.sessionDate)).toISOString(), o);
  }

  return workshops.filter((w) => {
    if (isWorkshopDeleted(w)) return false;

    // (day key, window) pairs to test. Recurring workshops look ahead from
    // today in their own timezone, which keeps a session already running
    // right now in the list; non-recurring have exactly one window.
    let candidates: Array<{ key: string; startDateTime: Date; endDateTime: Date }> = [];

    if (w.isRecurring && w.recurrencePattern && (w.recurrenceStartDate || w.date)) {
      candidates = calculateSessions(
        w.recurrencePattern,
        new Date(w.recurrenceStartDate || w.date),
        w.startTime,
        w.endTime,
        now,
        10,
        false,
        w.timezone,
        w.recurrenceEndDate ? new Date(w.recurrenceEndDate) : undefined
      ).map((s) => ({
        key: sessionDayKey(s.date).toISOString(),
        startDateTime: s.startDateTime,
        endDateTime: s.endDateTime,
      }));
    } else if (w.date) {
      const win = computeSessionWindow(w, new Date(w.date));
      if (win) {
        candidates = [{ key: sessionDayKey(new Date(w.date)).toISOString(), ...win }];
      }
    }

    // No computable session at all (malformed recurrence, missing date) —
    // nothing to sell a seat to.
    if (candidates.length === 0) return false;

    const inner = byWorkshop.get(String(w._id));
    return candidates.some((c) => {
      const status = deriveSessionStatus(
        { startDateTime: c.startDateTime, endDateTime: c.endDateTime },
        inner?.get(c.key) || null,
        now
      );
      return status !== "completed" && status !== "deleted";
    });
  });
}

export async function listOrgSellables(orgId: string): Promise<Sellable[]> {
  if (!Types.ObjectId.isValid(orgId)) return [];
  const orgObjectId = new Types.ObjectId(orgId);

  const now = new Date();
  // Non-recurring workshops are pre-filtered on `date` (a UTC-midnight day
  // anchor) rather than on the real session window, so the floor is pushed
  // back two days: a session that starts later today, or one whose end time
  // crosses midnight, must survive the query and be judged by the derived
  // status below.
  const workshopDateFloor = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const todayFloor = sessionDayKey(now);

  const [products, storeProducts, channels, courses, services, workshops] = await Promise.all([
    Product.find({
      organizationId: orgObjectId,
      status: "active",
      // Sold / out-of-stock items are not for sale. `trackQuantity` is
      // opt-in — products that don't track it are always in stock.
      isSold: { $ne: true },
      $or: [
        { trackQuantity: { $ne: true } },
        { trackQuantity: true, quantity: { $gt: 0 } },
      ],
    })
      .select(
        "_id name description price currency images isSubscription subscriptionPeriod isDigital createdBy organizationId"
      )
      .lean(),
    // Storefront merch — different collection, different schema (title
    // vs name, featuredImage vs images, isPhysicalProduct vs isDigital).
    // Surfaced as a distinct itemType so the pin lookup knows where to
    // re-fetch a snapshot from.
    StoreProduct.find({
      orgId: orgObjectId,
      status: "active",
      // Auction lots aren't buyable at a fixed price — they're won by
      // bidding in the auction UI, so they have no place in the Shop.
      // `$nin` also matches documents with no saleType at all.
      saleType: { $nin: ["auction", "hybrid_auction"] },
      // ...and once a lot is won and settled, it's gone for good. These
      // three flags are set by different writers (auction settlement, the
      // auction close job, the storefront backend), so all three are checked.
      "auction.settlementStatus": { $ne: "settled" },
      "auction.status": { $nin: ["sold", "settled"] },
      isSold: { $ne: true },
      $or: [
        { trackInventory: { $ne: true } },
        { trackInventory: true, quantity: { $gt: 0 } },
      ],
    })
      .select(
        "_id title description price currency images featuredImage isPhysicalProduct vendor orgId"
      )
      .lean(),
    Channel.find({ storeId: orgObjectId, isActive: true })
      .select(
        "_id title description price currency coverImage isSubscription subscriptionPeriod createdBy storeId"
      )
      .lean(),
    Course.find({ organizationId: orgObjectId, status: "published" })
      .select(
        "_id title description price currency coverImage isSubscription subscriptionPeriod createdBy organizationId"
      )
      .lean(),
    Service.find({ organizationId: orgObjectId, status: "active" })
      .select(
        "_id title description totalPrice currency coverImage icon createdBy organizationId"
      )
      .lean(),
    // Coarse pre-filter only — trashed rows and recurrences whose end date
    // has passed are cheap to drop in Mongo, but "has this webinar already
    // happened?" needs the per-session status derivation below.
    Workshop.find({
      orgId: orgObjectId,
      isActive: true,
      $and: [
        {
          // Not in Trash: no deletedAt, or a later restoredAt undid it.
          $or: [
            { deletedAt: null },
            { deletedAt: { $exists: false } },
            { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
          ],
        },
        {
          $or: [
            { isRecurring: { $ne: true }, date: { $gte: workshopDateFloor } },
            {
              isRecurring: true,
              isRecurrenceActive: true,
              $or: [
                { recurrenceEndDate: null },
                { recurrenceEndDate: { $exists: false } },
                { recurrenceEndDate: { $gte: todayFloor } },
              ],
            },
          ],
        },
      ],
    })
      .select(
        "_id title description price currency thumbnail isSubscription subscriptionPeriod createdBy orgId " +
          "date startTime endTime timezone isRecurring recurrencePattern recurrenceStartDate recurrenceEndDate deletedAt restoredAt"
      )
      .sort({ date: 1 })
      .lean(),
  ]);

  // Drop webinars that are over. A workshop earns its place in the Shop
  // only while it has a session that is yet-to-happen or live — the same
  // derivation the Workshops page badges use, so the two never disagree.
  // Overrides for every candidate are loaded in one query; a session that
  // the founder manually ended (or trashed) counts as done regardless of
  // what the clock says.
  const sellableWorkshops = await filterSellableWorkshops(
    workshops as any[],
    now
  );

  // Resolve the storefront identity (slug + display name) for each
  // store-product. The webinar pin picker drops physical items
  // without a storeSlug because the buy-now overlay can't drive
  // checkout otherwise — so storeproducts without a matching `stores`
  // doc would be silently filtered on the client. Joining via the
  // Mongo driver (no `Store` model imported here to keep this file
  // dependency-light) and looking the slug up by orgId since every
  // storefront has at most one store doc per org.
  let slugByOrg = new Map<string, { slug: string; name?: string }>();
  if ((storeProducts as any[]).length > 0) {
    const orgIdsInStoreProducts = Array.from(
      new Set((storeProducts as any[]).map((sp) => String(sp.orgId))),
    )
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    if (orgIdsInStoreProducts.length > 0) {
      // `mongoose.connection` is the live default connection; named
      // destructured imports of `connection` come back undefined under
      // the CJS/ESM interop wrapper TypeScript emits here.
      const mongoose = (await import("mongoose")).default;
      const storeDocs = await mongoose.connection
        .collection("stores")
        .find({ orgId: { $in: orgIdsInStoreProducts } })
        .project({ _id: 0, orgId: 1, slug: 1, name: 1 })
        .toArray();
      slugByOrg = new Map(
        (storeDocs as any[])
          .filter((s) => s.slug)
          .map((s) => [String(s.orgId), { slug: s.slug, name: s.name }]),
      );
    }
  }

  const all: Sellable[] = [];

  for (const p of products as any[]) {
    all.push({
      itemType: "product",
      itemId: p._id.toString(),
      name: p.name,
      description: p.description,
      price: effectivePrice(p.price),
      currency: p.currency || "USD",
      image: p.images?.[0],
      isSubscription: !!p.isSubscription,
      subscriptionPeriod: p.subscriptionPeriod,
      // Legacy products use isDigital; flip it for the unified flag.
      isPhysical: p.isDigital === false,
      sellerId: p.createdBy?.toString(),
      organizationId: p.organizationId.toString(),
    });
  }

  for (const sp of storeProducts as any[]) {
    const meta = slugByOrg.get(String(sp.orgId));
    all.push({
      itemType: "store-product",
      itemId: sp._id.toString(),
      name: sp.title,
      description: sp.description,
      // Storefront stores main-unit prices directly (no discount column).
      price: typeof sp.price === "number" ? sp.price : 0,
      currency: sp.currency || "USD",
      image:
        sp.featuredImage ||
        (Array.isArray(sp.images) && sp.images[0]?.url) ||
        undefined,
      storeSlug: meta?.slug,
      storeName: meta?.name,
      isSubscription: false,
      isPhysical: sp.isPhysicalProduct === true,
      sellerId: sp.vendor || undefined,
      organizationId: sp.orgId.toString(),
    });
  }

  for (const c of channels as any[]) {
    all.push({
      itemType: "channel",
      itemId: c._id.toString(),
      name: c.title,
      description: c.description,
      price: effectivePrice(c.price),
      currency: c.currency || "USD",
      image: c.coverImage,
      isSubscription: !!c.isSubscription,
      subscriptionPeriod: c.subscriptionPeriod,
      isPhysical: false,
      sellerId: c.createdBy?.toString(),
      organizationId: c.storeId.toString(),
    });
  }

  for (const c of courses as any[]) {
    all.push({
      itemType: "course",
      itemId: c._id.toString(),
      name: c.title,
      description: c.description,
      price: effectivePrice(c.price),
      currency: c.currency || "USD",
      image: c.coverImage,
      isSubscription: !!c.isSubscription,
      subscriptionPeriod: c.subscriptionPeriod,
      isPhysical: false,
      sellerId: c.createdBy?.toString(),
      organizationId: c.organizationId.toString(),
    });
  }

  for (const s of services as any[]) {
    all.push({
      itemType: "service",
      itemId: s._id.toString(),
      name: s.title,
      description: s.description,
      price: s.totalPrice || 0,
      currency: s.currency || "USD",
      image: s.coverImage || s.icon,
      isSubscription: false,
      isPhysical: false,
      sellerId: s.createdBy?.toString(),
      organizationId: s.organizationId.toString(),
    });
  }

  for (const w of sellableWorkshops) {
    all.push({
      itemType: "workshop",
      itemId: w._id.toString(),
      name: w.title,
      description: w.description,
      price: effectivePrice(w.price),
      currency: w.currency || "USD",
      image: w.thumbnail,
      isSubscription: !!w.isSubscription,
      subscriptionPeriod: w.subscriptionPeriod,
      isPhysical: false,
      sellerId: w.createdBy?.toString(),
      organizationId: w.orgId.toString(),
    });
  }

  return all;
}

// Helper so /api/invoices/generate can map a SellableItemType →
// InvoiceItemType. Most types pass through unchanged; storefront
// items are mapped to the existing ecommerce_item invoice line type
// so the rest of the invoice pipeline doesn't need to learn a new
// item kind.
export function toInvoiceItemType(t: SellableItemType): InvoiceItemType {
  if (t === "store-product") return "ecommerce_item";
  // Garage Store plans never go through /api/invoices/generate — they're
  // bought via the Unilevel Plus combo endpoints, which mint their own
  // invoices. Map to unilevel_plus so a stray caller degrades sensibly
  // instead of widening InvoiceItemType for a type it never sees.
  if (t === "garage-store") return "unilevel_plus" as InvoiceItemType;
  return t;
}
