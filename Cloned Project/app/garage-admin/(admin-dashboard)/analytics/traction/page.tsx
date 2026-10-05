"use client";

// Admin -> Analytics -> Traction (Figma frame "MacBook Pro 16" - 4").
// Platform-growth metrics. The screen itself — control bar, card grid, live
// fetch, per-card filter overrides — lives in AnalyticsMetricsPage, which the
// Subscriptions page renders too.

import {
  AnalyticsMetricsPage,
  type AnalyticsMetric,
} from "@/components/analytics/AnalyticsMetricsPage";

const TRACTION_METRICS: AnalyticsMetric[] = [
  { id: "users", title: "Users", unit: "count" },
  { id: "founders", title: "Founders", unit: "count" },
  { id: "companies", title: "Companies", unit: "count" },
  { id: "offices", title: "Offices", unit: "count" },
  { id: "ecommerce_stores", title: "E-commerce Stores", unit: "count" },
  { id: "irl_stores", title: "IRL Stores", unit: "count" },
  { id: "crypto_offices", title: "Crypto Offices", unit: "count" },
  { id: "affiliates", title: "Affiliates", unit: "count" },
  { id: "shoppers", title: "Shoppers", unit: "count" },
  { id: "employees", title: "Employees", unit: "count" },
];

export default function TractionAnalyticsPage() {
  return (
    <AnalyticsMetricsPage
      title="Traction"
      subtitle="Platform growth across every metric that matters to the business."
      endpoint="/garage-admin/analytics/traction"
      metrics={TRACTION_METRICS}
    />
  );
}
