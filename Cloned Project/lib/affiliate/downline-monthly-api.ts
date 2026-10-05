// Downline member profile — the header's monthly activity chart.
//
// GET /affiliate/downline/:userId/monthly?year=YYYY.
//
// Called with garageAdminApi, not api(): the admin panel is a separate session
// with no user JWT. The route is guarded by requireUserOrGarageAdmin, which
// accepts either — same reasoning as downline-profile-api.ts beside it.
// `earned` is the CALLER's commission, so it is blank for an admin.
//
// Two series for one member, twelve months, both in CENTS:
//   · spent  — everything that member paid for, across ALL orgs and item
//              types. The profile TABS filter by category; this chart does
//              not, so it never changes with the tab or the As-A-Shopper /
//              Digital dropdowns.
//   · earned — the viewer's commission from that member.

import { garageAdminApi } from "@/lib/api";

/** One month. `month` is 1-12; money is in cents. */
export interface MemberMonthlyPoint {
  month: number;
  spent: number;
  earned: number;
}

export interface MemberMonthly {
  year: number;
  /** Always "USD" — the backend converts INR spend at a fixed rate. */
  currency: string;
  /** Years with data, descending; always includes the requested year. */
  years: number[];
  /** Always 12 entries, zero-filled, Jan→Dec. */
  months: MemberMonthlyPoint[];
}

export async function fetchMemberMonthly(
  userId: string,
  year: number,
): Promise<MemberMonthly> {
  const res = await garageAdminApi<{ success: boolean } & MemberMonthly>(
    `/affiliate/downline/${userId}/monthly?year=${year}`,
  );
  return {
    year: res.year,
    currency: res.currency || "USD",
    years: res.years ?? [],
    months: res.months ?? [],
  };
}
