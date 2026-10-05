"use client";

// NetworkChain Subs profile route — thin wrapper. All behavior lives in the
// shared MemberProfileView (components/garage-admin/member-profile-view.tsx),
// which is also rendered by the One Time Affiliates and Users profile routes.
// Only the breadcrumb label differs per list.

import { MemberProfileView } from "@/components/garage-admin/member-profile-view";

export default function NetworkChainSubProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return <MemberProfileView params={params} backLabel="NetworkChain Subs" />;
}
