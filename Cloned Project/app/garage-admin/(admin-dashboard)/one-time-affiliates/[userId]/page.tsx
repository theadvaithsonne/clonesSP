"use client";

// One Time Affiliates profile route — thin wrapper. All behavior lives in the
// shared MemberProfileView (components/garage-admin/member-profile-view.tsx),
// which is also rendered by the Users and NetworkChain Subs profile routes.
// Only the breadcrumb label differs per list.

import { MemberProfileView } from "@/components/garage-admin/member-profile-view";

export default function OneTimeAffiliateProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return <MemberProfileView params={params} backLabel="One Time Affiliates" />;
}
