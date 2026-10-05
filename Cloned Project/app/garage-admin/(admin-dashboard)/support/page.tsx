"use client";

// The Support Agent dashboard route. Reached from the "Support Agent" tile in
// the dashboard-type pill (which navigates here) or directly. Any authenticated
// admin can open it — it only ever shows the affiliates assigned to THEM.

import SupportAgentDashboard from "@/components/garage-admin/SupportAgentDashboard";

export default function GarageAdminSupportPage() {
  return <SupportAgentDashboard />;
}
