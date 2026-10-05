// Apple App Store review "demo mode".
//
// The reviewer logs in with the fixed account (backend accepts a static OTP for
// it) and must never see real user data. When that account is active, the admin
// pages render this hardcoded dummy data and DO NOT call the real API at all —
// so no real record is ever fetched, let alone shown. The backend also limits
// the account to the Users section, so no other page can be reached.

import type { AdminUserListItem } from "@/lib/admin-api/users";

export const DEMO_ADMIN_EMAIL = "applereview@yopmail.com";

/** Is the signed-in admin the App Store review account? */
export function isDemoAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("garage_admin_info");
    if (!raw) return false;
    return JSON.parse(raw)?.email === DEMO_ADMIN_EMAIL;
  } catch {
    return false;
  }
}

const OFFER_DONE: AdminUserListItem["twentyFourHourOffer"] = {
  windowStartsAt: null,
  windowExpiresAt: null,
  windowOpen: false,
  secondsRemaining: 0,
  completed: true,
  status: "completed",
  extendedByAdmin: false,
  extendedAt: null,
  extendedByAdminId: null,
};

function demoUser(
  i: number,
  name: string,
  email: string,
  city: string,
  state: string,
  verified: boolean,
  volumeUsd: number,
  purchaseCount: number,
): AdminUserListItem {
  return {
    id: `demo-user-${i}`,
    name,
    email,
    phone: `+1 555 0${100 + i} 2${i}${i}${i}`,
    profilePicture: null,
    affiliateId: `aff_demo${i}`,
    isVerified: verified,
    phoneVerified: verified,
    profileComplete: verified,
    location: { country: "United States", state, city },
    upline: null,
    offices: [{ id: `demo-org-${i}`, name: "Demo Workspace", role: "founder", logo: null }],
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    typeFlags: {},
    directsCount: purchaseCount,
    downlineCount: purchaseCount * 2,
    twentyFourHourOffer: OFFER_DONE,
    purchases: { volumeUsd, purchaseCount, productCount: purchaseCount },
    commissionsGenerated: { totalUsd: Math.round(volumeUsd * 0.1), count: purchaseCount },
  };
}

/** A fixed set of fake users for the review account's Users page. */
export function demoUsers(): AdminUserListItem[] {
  return [
    demoUser(1, "Alex Morgan", "alex.morgan@example.com", "Austin", "Texas", true, 129, 3),
    demoUser(2, "Jordan Lee", "jordan.lee@example.com", "Denver", "Colorado", true, 0, 0),
    demoUser(3, "Taylor Brooks", "taylor.brooks@example.com", "Seattle", "Washington", true, 640, 5),
    demoUser(4, "Sam Rivera", "sam.rivera@example.com", "Miami", "Florida", false, 0, 0),
    demoUser(5, "Casey Nguyen", "casey.nguyen@example.com", "Portland", "Oregon", true, 49, 1),
    demoUser(6, "Riley Patel", "riley.patel@example.com", "Chicago", "Illinois", true, 220, 4),
    demoUser(7, "Jamie Fox", "jamie.fox@example.com", "Boston", "Massachusetts", false, 0, 0),
    demoUser(8, "Morgan Diaz", "morgan.diaz@example.com", "Phoenix", "Arizona", true, 310, 2),
  ];
}
