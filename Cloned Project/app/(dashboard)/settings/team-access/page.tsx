"use client";

// Standalone /settings/team-access page — thin wrapper around TeamAccessPage.
// The same component renders inline as the "Team & Access" tab of Office
// Settings (see ManagementPage), so both surfaces stay behavior-identical.
//
// Access is enforced server-side: every founder /rbac route sits behind
// requireOrgAdmin, so a non-founder landing here gets the locked empty state
// rather than a table.

import TeamAccessPage from "@/components/dashboard/teamAccess/TeamAccessPage";

export default function TeamAccessRoute() {
  return (
    <div className="min-h-screen bg-[#121216]">
      <TeamAccessPage />
    </div>
  );
}
