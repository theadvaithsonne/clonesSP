"use client";

// Admin -> Analytics -> Subscriptions (Figma frame "MacBook Pro 16" - 5",
// node 265:614): the same screen as Traction with four subscription-product
// cards — NetworkChains, Founder Office Pro, Whitelabel, MyCryptoBrand.
//
// Card titles match the Figma labels; the ids match the backend metric ids in
// routes/garageAdminAnalytics.ts, which resolve to the real plan/addon rows
// (officeplans "Founders Office" (pro), officeaddons "White-Label" and
// "Cryptosub") rather than to name strings.

import {
  AnalyticsMetricsPage,
  type AnalyticsMetric,
} from "@/components/analytics/AnalyticsMetricsPage";

const SUBSCRIPTION_METRICS: AnalyticsMetric[] = [
  { id: "networkchains", title: "NetworkChains", unit: "count" },
  { id: "founder_office_pro", title: "Founder Office Pro", unit: "count" },
  { id: "whitelabel", title: "Whitelabel", unit: "count" },
  { id: "mycryptobrand", title: "MyCryptoBrand", unit: "count" },
];

export default function SubscriptionsAnalyticsPage() {
  return (
    <AnalyticsMetricsPage
      title="Subscriptions"
      subtitle="Active and historic subscriptions across every paid product."
      endpoint="/garage-admin/analytics/subscriptions"
      metrics={SUBSCRIPTION_METRICS}
    />
  );
}
