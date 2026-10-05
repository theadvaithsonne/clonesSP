// ───────────────────────────────────────────────────────────────────────
// Downline member profile — "what this member bought / joined" per tab,
// with server-side sorting + pagination on every column.
//
//   · Offices          → User.organizations[] joined to Organization.
//   · Communities      → paid invoice lines, itemType "channel".
//   · Live Streams     → paid invoice lines, itemType "workshop".
//   · Courses          → paid invoice lines, itemType "course", joined to
//                        CourseEnrollment (progress % + status) IN the
//                        aggregation so those columns are server-sortable.
//   · Digital Products → paid invoice lines, itemType product/ecommerce_item
//                        filtered to digital via Product.
//   · Purchases (all)  → every paid invoice line (course lines carry progress).
//
// Line items are denormalized at purchase time (itemName/itemImage/price/…),
// so the invoice tabs need no catalog join beyond the two above.
// ───────────────────────────────────────────────────────────────────────

import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { Product } from "../models/product.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { ProductOrder } from "../models/productOrder.model";
import { ProductVariant } from "../models/productVariant.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { ChannelMembershipEvent } from "../models/channelMembershipEvent.model";
import { Channel } from "../models/channel.model";
import { CombPlan } from "../models/combPlan.model";
import { Post } from "../models/post.model";
import { PostComment } from "../models/postComment.model";
import { PostLike } from "../models/postLike.model";
import { PostCommentLike } from "../models/postCommentLike.model";
import { Review } from "../models/review.model";
import { buildAffiliateItemUrl } from "./affiliateItemUrl";

export type MemberTabCategory =
  | "all" // Purchases tab — the full ledger, every itemType
  | "offices"
  | "communities"
  | "live_streams"
  | "courses"
  | "digital_products"
  // Physical Products tab — sourced from ProductOrder (NOT invoice lines), the
  // only place with fulfillment status / tracking / shipping.
  | "physical_products";

export type SortOrder = "asc" | "desc";

// Which invoice line itemType(s) back each invoice-driven tab. (physical_products
// is NOT here — it comes from ProductOrder, see listMemberPhysicalOrders.)
const CATEGORY_ITEM_TYPES: Record<
  Exclude<MemberTabCategory, "all" | "offices" | "physical_products">,
  string[]
> = {
  communities: ["channel"],
  live_streams: ["workshop"],
  courses: ["course"],
  digital_products: ["product", "ecommerce_item"],
};

// FE column id → Mongo sort field (Physical Products tab, on ProductOrder).
const PHYSICAL_SORT_FIELDS: Record<string, string> = {
  name: "items.productName",
  store: "_org.name",
  qty: "items.quantity",
  price: "items.totalPrice",
  status: "status",
  ordered: "createdAt",
};

// FE column id → sort value (invoice tabs). Every meaningful column is sortable.
const PURCHASE_GETTERS: Record<string, (r: MemberPurchaseItem) => string | number | null | undefined> = {
  name: (r) => r.name?.toLowerCase(),
  type: (r) => r.itemType,
  host: (r) => r.vendor?.toLowerCase() ?? null,
  store: (r) => r.vendor?.toLowerCase() ?? null,
  category: (r) => r.category?.toLowerCase() ?? null,
  session: (r) => toTime(r.liveSessionDate),
  purchased: (r) => toTime(r.paidAt),
  enrolled: (r) => toTime(r.paidAt),
  renews: (r) => toTime(r.nextDueDate),
  qty: (r) => r.quantity,
  amount: (r) => r.totalPrice,
  earned: (r) => r.youEarned,
  rating: (r) => r.rating ?? null,
  progress: (r) => r.progressPercentage ?? null,
  status: (r) => r.enrollmentStatus ?? null,
  invoice: (r) => r.invoiceNumber,
};

// FE column id → sort value (Offices tab). Every meaningful column is sortable;
// Founder/Links aren't (a person object / a link).
const OFFICE_GETTERS: Record<string, (r: MemberOfficeItem) => string | number | null | undefined> = {
  office: (r) => r.name?.toLowerCase(),
  joined: (r) => toTime(r.joinedAt),
  consumed: (r) => r.consumedOfferings,
  free: (r) => r.freeOfferings,
  paid: (r) => r.paidOfferings,
  spent: (r) => r.totalSpent,
  earned: (r) => r.youEarned,
  rating: (r) => r.rating ?? null,
};

export interface MemberTabResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MemberOfficeItem {
  orgId: string;
  name: string;
  icon: string;
  slug: string;
  role: string;
  guest: boolean;
  joinedAt: Date | null;
  // ── "As A Shopper" enrichment (batched per page) ──
  founder: { name: string; email: string; phone: string; avatar: string } | null;
  consumedOfferings: number; // items the member acquired in this org
  freeOfferings: number; // of which $0
  paidOfferings: number; // of which >$0
  totalSpent: number; // minor units (cents) — member's paid-invoice total in this org
  spentCurrency: string;
  youEarned: number; // minor units — the VIEWER's commission from this member in this org
  earnedCurrency: string;
  affiliateUrl: string | null; // member's affiliate link for this office (/hq/{slug}?ref=)
  rating: number | null; // the member's own 1-5 rating of the office (null if not rated)
  review: string | null; // the member's written review text (body, else title), null if none
}

export interface MemberPurchaseItem {
  invoiceId: string;
  invoiceNumber: string;
  itemType: string;
  itemId: string | null;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  paidAt: Date | null;
  status: string;
  vendor: string | null;
  isRecurring: boolean;
  recurringPeriod: string | null;
  nextDueDate: Date | null;
  liveSessionDate: string | null;
  progressPercentage?: number | null;
  enrollmentStatus?: string | null;
  // Enrichment (rating/affiliate/you-earned/category), batched per page.
  rating?: number | null; // member's own 1-5 review of the item
  affiliateUrl?: string | null;
  youEarned?: number; // cents — viewer's commission from this member on this item
  earnedCurrency?: string;
  category?: string | null; // product category (Digital/Physical Products)
}

const dir = (o: SortOrder): 1 | -1 => (o === "asc" ? 1 : -1);

/**
 * Sort an already-enriched row set by a column getter, then paginate in memory.
 * Enriched/computed columns (spent, earned, rating, offering counts, social
 * counts, …) aren't in the base aggregation, so they can't be $sort-ed in the DB
 * before pagination. Profile data is bounded per member, so we fetch the whole
 * set, enrich it, then sort + slice here. Nulls/blanks always sort last.
 */
function sortAndPaginate<T>(
  rows: T[],
  getters: Record<string, (r: T) => string | number | null | undefined>,
  opts: { sortBy?: string; sortOrder: SortOrder; page: number; limit: number; defaultKey: string },
): MemberTabResult<T> {
  const { sortBy, sortOrder, page, limit, defaultKey } = opts;
  const key = sortBy && getters[sortBy] ? sortBy : defaultKey;
  const get = getters[key] || getters[defaultKey];
  const s = sortOrder === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * s;
    }
    return ((va as number) - (vb as number)) * s;
  });
  return {
    items: sorted.slice((page - 1) * limit, page * limit),
    total: sorted.length,
    page,
    limit,
  };
}

const toTime = (d: Date | string | null | undefined): number | null =>
  d ? new Date(d).getTime() || null : null;

// ── Offices (User.organizations[] → Organization) ───────────────────────────
export async function listMemberOffices(params: {
  userId: string;
  /** The logged-in upline viewing the page — used for the "You Earned" column
   *  (their commission from this member). Optional: absent → 0. */
  viewerId?: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: SortOrder;
}): Promise<MemberTabResult<MemberOfficeItem>> {
  const { userId, viewerId, page, limit, sortBy, sortOrder } = params;
  const userIdObj = new Types.ObjectId(userId);

  const base = (await User.aggregate([
    { $match: { _id: userIdObj } },
    { $unwind: "$organizations" },
    {
      $lookup: {
        from: Organization.collection.name,
        localField: "organizations.organization",
        foreignField: "_id",
        as: "_org",
      },
    },
    { $addFields: { _org: { $arrayElemAt: ["$_org", 0] } } },
    {
      $project: {
        _id: 0,
        orgId: { $toString: "$organizations.organization" },
        name: { $ifNull: ["$_org.name", "Unknown"] },
        icon: { $ifNull: ["$_org.icon", ""] },
        slug: {
          $ifNull: ["$_org.slug", { $ifNull: ["$_org.store.slug", ""] }],
        },
        role: "$organizations.role",
        guest: { $eq: ["$organizations.guest", true] },
        joinedAt: "$organizations.joinedAt",
      },
    },
  ])) as MemberOfficeItem[];

  const enriched = await enrichOffices(base, userIdObj, viewerId);
  return sortAndPaginate(enriched, OFFICE_GETTERS, {
    sortBy,
    sortOrder,
    page,
    limit,
    defaultKey: "joined",
  });
}

/**
 * Batch-enrich a page of office rows with the "As A Shopper" columns: founder,
 * offering counts (consumed/free/paid), total spent (this member, this org),
 * you-earned (the VIEWER's commission from this member in this org), and the
 * member's affiliate link. One round of grouped queries per page, not per row.
 * Rating = the member's own 1-5 office review; Review = their written text
 * (Review.targetType "office"). Links = the member's /hq/{slug}?ref= lobby link.
 */
async function enrichOffices(
  rows: MemberOfficeItem[],
  memberId: Types.ObjectId,
  viewerId?: string,
): Promise<MemberOfficeItem[]> {
  if (!rows.length) return rows;
  const orgIds = rows.map((r) => new Types.ObjectId(r.orgId));
  const viewerObj = viewerId ? new Types.ObjectId(viewerId) : null;

  const [founders, offerings, earnings, reviews, member] = await Promise.all([
    User.find(
      { organizations: { $elemMatch: { organization: { $in: orgIds }, role: "founder" } } },
      { name: 1, email: 1, phone: 1, profilePicture: 1, organizations: 1 },
    ).lean(),
    // Offering counts + total spent per org, from the member's paid invoice lines.
    Invoice.aggregate([
      { $match: { userId: memberId, status: "paid" } },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: { $ifNull: ["$lineItems.organizationId", "$organizationId"] },
          consumed: { $sum: 1 },
          free: { $sum: { $cond: [{ $gt: ["$lineItems.totalPrice", 0] }, 0, 1] } },
          paid: { $sum: { $cond: [{ $gt: ["$lineItems.totalPrice", 0] }, 1, 0] } },
          spent: { $sum: "$lineItems.totalPrice" },
          currency: { $first: "$lineItems.originalCurrency" },
        },
      },
      { $match: { _id: { $in: orgIds } } },
    ]),
    // "You Earned" = the viewer's commission from this member, grouped by org.
    viewerObj
      ? CommissionDistribution.aggregate([
          {
            $match: {
              customerId: memberId,
              orgId: { $in: orgIds },
              status: "completed",
              "commissions.userId": viewerObj,
            },
          },
          { $unwind: "$commissions" },
          { $match: { "commissions.userId": viewerObj } },
          {
            $group: {
              _id: "$orgId",
              earned: { $sum: "$commissions.amount" },
              currency: { $first: "$currency" },
            },
          },
        ])
      : Promise.resolve([] as any[]),
    // The member's own rating/review of each office (Review target "office").
    Review.find(
      { userId: memberId, targetType: "office", targetId: { $in: orgIds } },
      { targetId: 1, rating: 1, title: 1, body: 1 },
    ).lean(),
    // The member's affiliate id → the ref on their /hq/{slug} lobby link.
    User.findById(memberId).select({ affiliateId: 1 }).lean(),
  ]);

  const founderByOrg = new Map<
    string,
    { name: string; email: string; phone: string; avatar: string }
  >();
  const orgIdSet = new Set(orgIds.map((o) => String(o)));
  for (const u of founders as any[]) {
    for (const m of u.organizations || []) {
      if (m.role !== "founder") continue;
      const oid = String(m.organization);
      if (orgIdSet.has(oid) && !founderByOrg.has(oid)) {
        founderByOrg.set(oid, {
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          avatar: u.profilePicture || "",
        });
      }
    }
  }
  const offByOrg = new Map<string, any>(offerings.map((o: any) => [String(o._id), o]));
  const earnByOrg = new Map<string, any>(earnings.map((e: any) => [String(e._id), e]));
  const reviewByOrg = new Map<string, { rating?: number; title?: string; body?: string }>(
    (reviews as any[]).map((rv) => [String(rv.targetId), rv]),
  );
  const affiliateId = (member as any)?.affiliateId || "";

  return rows.map((r) => {
    const off = offByOrg.get(r.orgId);
    const earn = earnByOrg.get(r.orgId);
    const rv = reviewByOrg.get(r.orgId);
    // Computed, never the stored AffiliateLink.affiliateUrl: those rows were
    // written as `{host}/{orgSlug}/{itemId}` before per-kind routing existed,
    // so every one of them points somewhere wrong. See affiliateItemUrl.ts.
    return {
      ...r,
      founder: founderByOrg.get(r.orgId) || null,
      consumedOfferings: off?.consumed || 0,
      freeOfferings: off?.free || 0,
      paidOfferings: off?.paid || 0,
      totalSpent: off?.spent || 0, // invoice totalPrice is already minor units (cents)
      spentCurrency: off?.currency || "USD",
      // CommissionDistribution.amount is WHOLE units ($0.03) — convert to cents so
      // both money columns share one unit for the frontend's /100 formatter.
      youEarned: Math.round((earn?.earned || 0) * 100),
      earnedCurrency: earn?.currency || "USD",
      affiliateUrl: buildAffiliateItemUrl({ itemType: "office", slug: r.slug }, affiliateId),
      rating: rv?.rating ?? null,
      review: rv?.body?.trim() || rv?.title?.trim() || null,
    };
  });
}

// ── Communities (ChannelMembership-backed, richly enriched) ─────────────────
const COMMUNITY_GETTERS: Record<string, (r: MemberCommunityItem) => string | number | null | undefined> = {
  name: (r) => r.name?.toLowerCase(),
  office: (r) => r.office?.toLowerCase(),
  joined: (r) => toTime(r.joinedAt),
  price: (r) => (r.isFree ? 0 : r.price),
  comp: (r) => r.compLevels[0]?.percentage ?? null,
  spent: (r) => r.totalSpent,
  earned: (r) => r.youEarned,
  status: (r) => r.status,
  posts: (r) => r.posts,
  comments: (r) => r.comments,
  liked: (r) => r.likedPosts + r.likedComments,
  rating: (r) => r.rating ?? null,
};

export interface MemberCommunityItem {
  channelId: string;
  name: string;
  icon: string | null;
  office: string;
  officeIcon: string | null;
  joinedAt: Date | null;
  price: number; // channel list price — WHOLE units
  currency: string;
  isFree: boolean;
  subscriptionPeriod: string | null;
  compLevels: { level: number; percentage: number }[];
  totalSpent: number; // cents — member's invoice spend on this channel
  spentCurrency: string;
  youEarned: number; // cents — viewer's commission from this member on this channel
  earnedCurrency: string;
  status: string;
  subscriptionStatus: string | null;
  cancelledAt: Date | null;
  nextPaymentDate: Date | null;
  /**
   * WHY the membership ended, from the append-only event log. The
   * membership's own `subscriptionStatus` cannot answer this: BOTH exit
   * paths land on "expired", so a member who chose to leave is
   * indistinguishable from one whose payment failed.
   *
   *   "unsubscribed"      user clicked cancel
   *   "expired"           sweeper closed out an earlier cancel at cycle end
   *                       (always preceded by "unsubscribed" — voluntary)
   *   "payment_defaulted" INVOLUNTARY: next cycle's invoice went unpaid
   *
   * Null while the membership is active, or when it predates the log.
   */
  endReason: "unsubscribed" | "expired" | "payment_defaulted" | null;
  /** When access actually ran out. Prefers the membership's own
   *  nextPaymentDate; falls back to the event's accessUntil for rows whose
   *  cancel path never backfilled it. */
  activeUntil: Date | null;
  posts: number; // authored by the member in this channel
  comments: number; // authored by the member on this channel's posts
  likedPosts: number; // this channel's posts the member liked
  likedComments: number; // comments on this channel's posts the member liked
  affiliateUrl: string | null;
  rating: number | null; // the member's own 1-5 rating of the channel
}

export async function listMemberCommunities(params: {
  userId: string;
  viewerId?: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: SortOrder;
}): Promise<MemberTabResult<MemberCommunityItem>> {
  const { userId, viewerId, page, limit, sortBy, sortOrder } = params;
  const memberId = new Types.ObjectId(userId);

  const base = (await ChannelMembership.aggregate([
    { $match: { userId: memberId } },
    {
      $lookup: {
        from: Channel.collection.name,
        localField: "channelId",
        foreignField: "_id",
        as: "_channel",
      },
    },
    { $addFields: { _channel: { $arrayElemAt: ["$_channel", 0] } } },
    {
      $lookup: {
        from: Organization.collection.name,
        localField: "orgId",
        foreignField: "_id",
        as: "_org",
      },
    },
    { $addFields: { _org: { $arrayElemAt: ["$_org", 0] } } },
    {
      $project: {
        _id: 0,
        channelId: { $toString: "$channelId" },
        name: { $ifNull: ["$_channel.title", "Community"] },
        // Channels have NO `icon` field — the model declares one, but not a
        // single document in prod carries it, so this always resolved to null
        // and every community rendered as an initials monogram. The artwork
        // lives on `coverImage` (the same image the Garage app shows).
        icon: { $ifNull: ["$_channel.coverImage", null] },
        office: { $ifNull: ["$_org.name", "—"] },
        officeIcon: { $ifNull: ["$_org.icon", null] },
        joinedAt: "$joinedAt",
        price: { $ifNull: ["$_channel.price", 0] },
        currency: { $ifNull: ["$_channel.currency", "USD"] },
        isFree: { $ifNull: ["$_channel.isFree", true] },
        subscriptionPeriod: { $ifNull: ["$_channel.subscriptionPeriod", null] },
        status: { $ifNull: ["$status", "inactive"] },
        subscriptionStatus: { $ifNull: ["$subscriptionStatus", null] },
        cancelledAt: { $ifNull: ["$cancelledAt", null] },
        nextPaymentDate: { $ifNull: ["$nextPaymentDate", null] },
      },
    },
  ])) as any[];

  if (!base.length) return { items: [], total: 0, page, limit };

  const channelIds = base.map((b) => new Types.ObjectId(b.channelId));
  const viewerObj = viewerId ? new Types.ObjectId(viewerId) : null;

  // Scope social counts to these channels: comments/likes reach the channel only
  // through their post (Post.channelIds), so those two hop via a $lookup.
  const [spend, earn, comps, postCounts, commentCounts, postLikes, commentLikes, member, reviews, exits] =
    await Promise.all([
      Invoice.aggregate([
        { $match: { userId: memberId, status: "paid" } },
        { $unwind: "$lineItems" },
        { $match: { "lineItems.itemType": "channel", "lineItems.itemId": { $in: channelIds } } },
        {
          $group: {
            _id: "$lineItems.itemId",
            spent: { $sum: "$lineItems.totalPrice" },
            currency: { $first: "$lineItems.originalCurrency" },
          },
        },
      ]),
      viewerObj
        ? CommissionDistribution.aggregate([
            {
              $match: {
                customerId: memberId,
                itemType: "channel",
                itemId: { $in: channelIds },
                status: "completed",
                "commissions.userId": viewerObj,
              },
            },
            { $unwind: "$commissions" },
            { $match: { "commissions.userId": viewerObj } },
            { $group: { _id: "$itemId", earned: { $sum: "$commissions.amount" }, currency: { $first: "$currency" } } },
          ])
        : Promise.resolve([] as any[]),
      CombPlan.find(
        { itemType: "channel", itemId: { $in: channelIds }, isActive: true },
        { itemId: 1, levels: 1 },
      ).lean(),
      Post.aggregate([
        { $match: { authorId: memberId, channelIds: { $in: channelIds } } },
        { $unwind: "$channelIds" },
        { $match: { channelIds: { $in: channelIds } } },
        { $group: { _id: "$channelIds", n: { $sum: 1 } } },
      ]),
      PostComment.aggregate([
        { $match: { userId: memberId } },
        { $lookup: { from: Post.collection.name, localField: "postId", foreignField: "_id", as: "_p" } },
        { $unwind: "$_p" },
        { $unwind: "$_p.channelIds" },
        { $match: { "_p.channelIds": { $in: channelIds } } },
        { $group: { _id: "$_p.channelIds", n: { $sum: 1 } } },
      ]),
      PostLike.aggregate([
        { $match: { userId: memberId } },
        { $lookup: { from: Post.collection.name, localField: "postId", foreignField: "_id", as: "_p" } },
        { $unwind: "$_p" },
        { $unwind: "$_p.channelIds" },
        { $match: { "_p.channelIds": { $in: channelIds } } },
        { $group: { _id: "$_p.channelIds", n: { $sum: 1 } } },
      ]),
      PostCommentLike.aggregate([
        { $match: { userId: memberId } },
        { $lookup: { from: PostComment.collection.name, localField: "commentId", foreignField: "_id", as: "_c" } },
        { $unwind: "$_c" },
        { $lookup: { from: Post.collection.name, localField: "_c.postId", foreignField: "_id", as: "_p" } },
        { $unwind: "$_p" },
        { $unwind: "$_p.channelIds" },
        { $match: { "_p.channelIds": { $in: channelIds } } },
        { $group: { _id: "$_p.channelIds", n: { $sum: 1 } } },
      ]),
      // The member's own affiliate id — their links are built from it below.
      User.findById(memberId).select({ affiliateId: 1 }).lean(),
      Review.find(
        { userId: memberId, targetType: "channel", targetId: { $in: channelIds } },
        { targetId: 1, rating: 1 },
      ).lean(),
      // Latest exit event per channel. Workshop events share this collection
      // with a NULL channelId, so pin itemKind rather than leaning on the
      // channelId filter alone. A (user, channel) pair can hold more than one
      // event — an "unsubscribed" followed by the sweeper's "expired" — so
      // take the most recent.
      ChannelMembershipEvent.aggregate([
        {
          $match: {
            userId: memberId,
            channelId: { $in: channelIds },
            itemKind: "channel",
          },
        },
        { $sort: { occurredAt: -1 } },
        {
          $group: {
            _id: "$channelId",
            eventType: { $first: "$eventType" },
            accessUntil: { $first: "$accessUntil" },
          },
        },
      ]),
    ]);

  const mapBy = (arr: any[], key = "_id") =>
    new Map<string, any>(arr.map((x) => [String(x[key]), x]));
  const spendM = mapBy(spend);
  const earnM = mapBy(earn);
  const compM = mapBy(comps as any[], "itemId");
  const postM = mapBy(postCounts);
  const commentM = mapBy(commentCounts);
  const plikeM = mapBy(postLikes);
  const clikeM = mapBy(commentLikes);
  const affiliateId = (member as any)?.affiliateId || "";
  const rateM = new Map((reviews as any[]).map((r) => [String(r.targetId), r.rating]));
  const exitM = mapBy(exits as any[]);

  const items: MemberCommunityItem[] = base.map((b) => {
    const sp = spendM.get(b.channelId);
    const er = earnM.get(b.channelId);
    const cp = compM.get(b.channelId);
    return {
      ...b,
      compLevels: (cp?.levels || []).map((l: any) => ({ level: l.level, percentage: l.percentage })),
      totalSpent: sp?.spent || 0,
      spentCurrency: sp?.currency || b.currency || "USD",
      youEarned: Math.round((er?.earned || 0) * 100), // whole $ → cents
      earnedCurrency: er?.currency || "USD",
      posts: postM.get(b.channelId)?.n || 0,
      comments: commentM.get(b.channelId)?.n || 0,
      likedPosts: plikeM.get(b.channelId)?.n || 0,
      likedComments: clikeM.get(b.channelId)?.n || 0,
      affiliateUrl: buildAffiliateItemUrl({ itemType: "channel", itemId: b.channelId }, affiliateId),
      rating: rateM.get(b.channelId) ?? null,
      // Only explain an ENDED membership. Someone who left and later rejoined
      // still carries the old exit event, and surfacing it would badge a live
      // membership as unsubscribed.
      endReason:
        b.status === "active" ? null : exitM.get(b.channelId)?.eventType ?? null,
      activeUntil:
        b.status === "active"
          ? null
          : b.nextPaymentDate ?? exitM.get(b.channelId)?.accessUntil ?? null,
    };
  });

  return sortAndPaginate(items, COMMUNITY_GETTERS, {
    sortBy,
    sortOrder,
    page,
    limit,
    defaultKey: "joined",
  });
}

// ── Physical Products (ProductOrder-backed) ─────────────────────────────────
// One row per PHYSICAL order item the member bought. Fulfillment status,
// tracking, and ship-to are order-level; the price shown is the line total.
// Only paid orders, and only physical items (order items can be digital too).
export interface MemberPhysicalOrderItem {
  orderId: string;
  orderNumber: string;
  productId: string | null;
  name: string;
  variant: string | null;
  image: string | null;
  quantity: number;
  unitPrice: number;
  linePrice: number;
  currency: string;
  status: string; // fulfillment: pending|confirmed|processing|shipped|delivered|cancelled|refunded
  trackingNumber: string | null;
  trackingUrl: string | null;
  store: string;
  storeIcon: string;
  shipCity: string | null;
  shipCountry: string | null;
  orderedAt: Date | null;
}

export async function listMemberPhysicalOrders(params: {
  userId: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: SortOrder;
}): Promise<MemberTabResult<MemberPhysicalOrderItem>> {
  const { userId, page, limit, sortBy, sortOrder } = params;
  const userIdObj = new Types.ObjectId(userId);
  const sortField = (sortBy && PHYSICAL_SORT_FIELDS[sortBy]) || "createdAt";

  const [agg] = await ProductOrder.aggregate([
    { $match: { userId: userIdObj, paymentStatus: "paid" } },
    { $unwind: "$items" },
    // Physical items only — an order can carry digital items too.
    { $match: { "items.isDigital": { $ne: true } } },
    {
      $lookup: {
        from: Organization.collection.name,
        localField: "organizationId",
        foreignField: "_id",
        as: "_org",
      },
    },
    { $addFields: { _org: { $arrayElemAt: ["$_org", 0] } } },
    {
      $lookup: {
        from: ProductVariant.collection.name,
        localField: "items.variantId",
        foreignField: "_id",
        as: "_variant",
      },
    },
    { $addFields: { _variant: { $arrayElemAt: ["$_variant", 0] } } },
    { $sort: { [sortField]: dir(sortOrder), _id: -1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              orderId: { $toString: "$_id" },
              orderNumber: "$orderNumber",
              productId: "$items.productId",
              name: { $ifNull: ["$items.productName", "Product"] },
              variant: { $ifNull: ["$_variant.title", null] },
              image: { $ifNull: ["$items.productImage", null] },
              quantity: "$items.quantity",
              unitPrice: "$items.unitPrice",
              linePrice: "$items.totalPrice",
              currency: { $ifNull: ["$currency", "INR"] },
              status: { $ifNull: ["$status", "pending"] },
              trackingNumber: { $ifNull: ["$trackingNumber", null] },
              trackingUrl: { $ifNull: ["$trackingUrl", null] },
              store: { $ifNull: ["$_org.name", "Store"] },
              storeIcon: { $ifNull: ["$_org.icon", ""] },
              shipCity: { $ifNull: ["$shippingAddress.city", null] },
              shipCountry: { $ifNull: ["$shippingAddress.country", null] },
              orderedAt: "$createdAt",
            },
          },
        ],
      },
    },
  ]);

  const items: MemberPhysicalOrderItem[] = (agg?.items || []).map((it: any) => ({
    ...it,
    productId: it.productId ? String(it.productId) : null,
  }));

  return { items, total: agg?.total?.[0]?.count || 0, page, limit };
}

// ── Invoice-backed tabs ──────────────────────────────────────────────────────
export async function listMemberPurchases(params: {
  userId: string;
  viewerId?: string;
  category: Exclude<MemberTabCategory, "offices" | "physical_products">;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: SortOrder;
}): Promise<MemberTabResult<MemberPurchaseItem>> {
  const { userId, viewerId, category, page, limit, sortBy, sortOrder } = params;
  const userIdObj = new Types.ObjectId(userId);
  const withCourseProgress = category === "courses" || category === "all";

  const pipeline: any[] = [
    { $match: { userId: userIdObj, status: "paid" } },
    { $unwind: "$lineItems" },
  ];

  if (category !== "all") {
    pipeline.push({
      $match: { "lineItems.itemType": { $in: CATEGORY_ITEM_TYPES[category] } },
    });
  }

  // Digital Products: keep only lines whose Product is digital (or "both").
  if (category === "digital_products") {
    pipeline.push(
      {
        $lookup: {
          from: Product.collection.name,
          localField: "lineItems.itemId",
          foreignField: "_id",
          as: "_product",
        },
      },
      {
        $match: {
          $or: [
            { "_product.deliveryMethod": { $in: ["digital", "both"] } },
            { "_product.isDigital": true },
          ],
        },
      }
    );
  }

  // Course progress/status joined IN-pipeline so those columns are sortable.
  if (withCourseProgress) {
    pipeline.push(
      {
        $lookup: {
          from: CourseEnrollment.collection.name,
          let: { cid: "$lineItems.itemId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$courseId", "$$cid"] },
                    { $eq: ["$userId", userIdObj] },
                  ],
                },
              },
            },
            { $project: { progressPercentage: 1, status: 1 } },
          ],
          as: "_enroll",
        },
      },
      {
        $addFields: {
          progressPercentage: {
            $ifNull: [{ $arrayElemAt: ["$_enroll.progressPercentage", 0] }, null],
          },
          enrollmentStatus: {
            $ifNull: [{ $arrayElemAt: ["$_enroll.status", 0] }, null],
          },
        },
      }
    );
  }

  const project: Record<string, any> = {
    _id: 0,
    invoiceId: { $toString: "$_id" },
    invoiceNumber: "$invoiceNumber",
    itemType: "$lineItems.itemType",
    itemId: "$lineItems.itemId",
    name: "$lineItems.itemName",
    image: "$lineItems.itemImage",
    quantity: "$lineItems.quantity",
    unitPrice: "$lineItems.unitPrice",
    totalPrice: "$lineItems.totalPrice",
    currency: "$lineItems.originalCurrency",
    paidAt: "$paidAt",
    status: "$status",
    vendor: "$lineItems.vendor",
    isRecurring: "$isRecurring",
    recurringPeriod: "$recurringPeriod",
    nextDueDate: "$nextDueDate",
    liveSessionDate: "$lineItems.liveSessionDate",
  };
  if (withCourseProgress) {
    project.progressPercentage = "$progressPercentage";
    project.enrollmentStatus = "$enrollmentStatus";
  }

  pipeline.push({ $project: project });

  const rows = await Invoice.aggregate(pipeline);
  const base: MemberPurchaseItem[] = rows.map((it: any) => ({
    ...it,
    itemId: it.itemId ? String(it.itemId) : null,
  }));
  const items = await enrichPurchaseItems(base, userIdObj, viewerId);

  return sortAndPaginate(items, PURCHASE_GETTERS, {
    sortBy,
    sortOrder,
    page,
    limit,
    defaultKey: "purchased",
  });
}

/**
 * Batch-enrich invoice-backed rows (Live Streams / Courses / Digital Products /
 * Purchases) with the member's own Rating (Review), their Affiliate link, the
 * VIEWER's commission from this member (You Earned), and product Category — all
 * keyed by the line item's itemId (a unique ObjectId, so targetType-agnostic).
 */
async function enrichPurchaseItems(
  rows: MemberPurchaseItem[],
  memberId: Types.ObjectId,
  viewerId?: string,
): Promise<MemberPurchaseItem[]> {
  const itemIds = rows
    .map((r) => r.itemId)
    .filter((id): id is string => !!id)
    .map((id) => new Types.ObjectId(id));
  if (!itemIds.length) return rows;
  const viewerObj = viewerId ? new Types.ObjectId(viewerId) : null;

  const [reviews, member, earnings, products] = await Promise.all([
    Review.find(
      { userId: memberId, targetId: { $in: itemIds } },
      { targetId: 1, rating: 1 },
    ).lean(),
    // The member's own affiliate id — their links are built from it below.
    User.findById(memberId).select({ affiliateId: 1 }).lean(),
    viewerObj
      ? CommissionDistribution.aggregate([
          {
            $match: {
              customerId: memberId,
              itemId: { $in: itemIds },
              status: "completed",
              "commissions.userId": viewerObj,
            },
          },
          { $unwind: "$commissions" },
          { $match: { "commissions.userId": viewerObj } },
          { $group: { _id: "$itemId", earned: { $sum: "$commissions.amount" }, currency: { $first: "$currency" } } },
        ])
      : Promise.resolve([] as any[]),
    Product.find(
      { _id: { $in: itemIds } },
      // deliveryMethod decides /product/<id> vs /digital/product/<id>.
      { categoryName: 1, deliveryMethod: 1 },
    ).lean(),
  ]);

  const rateM = new Map((reviews as any[]).map((r) => [String(r.targetId), r.rating]));
  const affiliateId = (member as any)?.affiliateId || "";
  const earnM = new Map<string, any>((earnings as any[]).map((e) => [String(e._id), e]));
  const catM = new Map((products as any[]).map((p) => [String(p._id), p.categoryName]));
  const deliveryM = new Map(
    (products as any[]).map((p) => [String(p._id), p.deliveryMethod]),
  );

  return rows.map((r) => {
    const er = r.itemId ? earnM.get(r.itemId) : null;
    return {
      ...r,
      rating: r.itemId ? rateM.get(r.itemId) ?? null : null,
      affiliateUrl: buildAffiliateItemUrl(
        {
          itemType: r.itemType,
          itemId: r.itemId,
          // "both" is treated as digital — the digital PDP is the one that
          // works for either fulfilment.
          physical: r.itemId ? deliveryM.get(r.itemId) === "physical" : false,
        },
        affiliateId,
      ),
      youEarned: Math.round((er?.earned || 0) * 100), // whole $ → cents
      earnedCurrency: er?.currency || "USD",
      category: r.itemId ? catM.get(r.itemId) ?? null : null,
    };
  });
}
