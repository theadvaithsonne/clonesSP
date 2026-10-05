import type { Metadata } from "next";
import { headers } from "next/headers";
import { LostMoneySiteLayout } from "@/app/(dashboard)/games/bat246/lostmoney/website/LostMoneySiteLayout";
import { isLostMoneyCustomDomainHost } from "@/lib/lostmoney-domains";

export const metadata: Metadata = {
  title: "YourMoneyBack — Lost Money In A Previous Company",
  description: "Claim repayment for legitimate losses from a previous business owned by Alan Kippax.",
};

export default async function LostMoneyLayout({ children }: { children: React.ReactNode }) {
  // Read server-side (not window.location.hostname in SiteHeader) so the
  // very first server-rendered HTML already has the right links — deciding
  // this client-side after mount would render internal-path links first,
  // then swap to the branded ones, causing a hydration mismatch on the
  // anchors' href attributes.
  const headersList = await headers();
  const host = (headersList.get("host") || "").split(":")[0].toLowerCase();
  const isCustomDomain = isLostMoneyCustomDomainHost(host);

  return <LostMoneySiteLayout isCustomDomain={isCustomDomain}>{children}</LostMoneySiteLayout>;
}
