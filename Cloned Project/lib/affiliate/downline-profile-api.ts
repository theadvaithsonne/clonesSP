// One Time Affiliate profile — data for the garage-admin
// /one-time-affiliates/[userId] page.
//
// Header + Offices come from GET /affiliate/user-info/:userId (identity,
// upline, location, organizations[]). The purchase-backed tabs (Communities /
// Live Streams / Courses / Digital Products / Purchases) come from
// GET /affiliate/downline/:userId/purchases.
//
// These live under /affiliate but are called here with garageAdminApi (the
// garage-admin token). The admin panel is a SEPARATE session with no user JWT —
// using the regular user api() 401'd for admin-only logins (e.g. incognito).
// The backend guards both endpoints with requireUserOrGarageAdmin, which accepts
// either a user JWT or a garage-admin token, so any admin can view any member's
// profile. Neither endpoint restricts by downline: the purchases route only uses
// the caller's id for the "You Earned" commission column (blank for an admin).

import { garageAdminApi } from "@/lib/api";

// ── Header + Offices (GET /affiliate/user-info/:userId) ──────────────────────

export interface MemberOffice {
  orgId: string;
  name: string;
  icon: string;
  slug: string;
  role: string;
  guest: boolean;
  joinedAt: string | null;
  // "As A Shopper" enrichment (present on the Offices tab; absent/0 on the
  // profile header's office list). Money fields are minor units (cents).
  founder?: { name: string; email: string; phone: string; avatar: string } | null;
  consumedOfferings?: number;
  freeOfferings?: number;
  paidOfferings?: number;
  totalSpent?: number;
  spentCurrency?: string;
  youEarned?: number;
  earnedCurrency?: string;
  affiliateUrl?: string | null;
  rating?: number | null; // the member's own 1-5 rating of the office
  review?: string | null; // the member's written review text, null if none
}

export interface MemberReferrer {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  /** The referrer's OWN country — not the viewed member's. */
  country?: string;
}

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  affiliateId: string | null;
  joinedAt: string | null;
  status: string;
  userType: string;
  officesJoined: number;
  offices: MemberOffice[];
  referrer: MemberReferrer | null;
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
  };
}

export async function fetchMemberProfile(userId: string): Promise<MemberProfile> {
  const res = await garageAdminApi<{ success: boolean; user: MemberProfile }>(
    `/affiliate/user-info/${userId}`
  );
  return res.user;
}

// ── Purchase tabs (GET /affiliate/downline/:userId/purchases) ────────────────

export type MemberTabCategory =
  | "all"
  | "offices"
  | "communities"
  | "live_streams"
  | "courses"
  | "digital_products"
  | "physical_products";

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
  paidAt: string | null;
  status: string;
  vendor: string | null;
  isRecurring: boolean;
  recurringPeriod: string | null;
  nextDueDate: string | null;
  liveSessionDate: string | null;
  progressPercentage?: number | null;
  enrollmentStatus?: string | null;
  // Enrichment for the invoice-backed tabs.
  rating?: number | null;
  affiliateUrl?: string | null;
  youEarned?: number; // cents
  earnedCurrency?: string;
  category?: string | null;
}

/** Communities rows come from ChannelMembership, richly enriched. Price is in
 *  WHOLE units (channel list price); totalSpent/youEarned are minor units (cents). */
export interface MemberCommunityItem {
  channelId: string;
  name: string;
  icon: string | null;
  office: string;
  officeIcon: string | null;
  joinedAt: string | null;
  price: number;
  currency: string;
  isFree: boolean;
  subscriptionPeriod: string | null;
  compLevels: { level: number; percentage: number }[];
  totalSpent: number;
  spentCurrency: string;
  youEarned: number;
  earnedCurrency: string;
  status: string;
  subscriptionStatus: string | null;
  cancelledAt: string | null;
  nextPaymentDate: string | null;
  /** Why the membership ended, from the append-only event log. Null while
   *  active. `subscriptionStatus` can't answer this — both the voluntary and
   *  the involuntary exit land on "expired". */
  endReason: "unsubscribed" | "expired" | "payment_defaulted" | null;
  /** When access actually ran out (nextPaymentDate, else the event's
   *  accessUntil). Null while active. */
  activeUntil: string | null;
  posts: number;
  comments: number;
  likedPosts: number;
  likedComments: number;
  affiliateUrl: string | null;
  rating: number | null;
}

/** Physical Products rows come from ProductOrder (fulfillment status, tracking,
 *  ship-to) rather than invoice lines — a distinct shape from MemberPurchaseItem. */
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
  status: string; // pending|confirmed|processing|shipped|delivered|cancelled|refunded
  trackingNumber: string | null;
  trackingUrl: string | null;
  store: string;
  storeIcon: string;
  shipCity: string | null;
  shipCountry: string | null;
  orderedAt: string | null;
}

export type SortOrder = "asc" | "desc";

export interface MemberTabResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** One route serves every tab. Offices returns MemberOffice rows; the invoice
 *  tabs return MemberPurchaseItem rows. `sortBy` is the DataTable column id;
 *  the backend maps it to the right field (server-side sort). */
export async function fetchMemberTab<T>(params: {
  userId: string;
  category: MemberTabCategory;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}): Promise<MemberTabResult<T>> {
  const { userId, category, page = 1, limit = 20, sortBy, sortOrder } = params;
  const qs = new URLSearchParams({
    category,
    page: String(page),
    limit: String(limit),
  });
  if (sortBy) qs.set("sortBy", sortBy);
  if (sortOrder) qs.set("sortOrder", sortOrder);
  const res = await garageAdminApi<{ success: boolean } & MemberTabResult<T>>(
    `/affiliate/downline/${userId}/purchases?${qs.toString()}`
  );
  return { items: res.items, total: res.total, page: res.page, limit: res.limit };
}
