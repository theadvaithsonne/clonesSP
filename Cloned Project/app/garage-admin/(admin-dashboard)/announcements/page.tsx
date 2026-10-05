"use client";

// Alerts & Promotions — Admin → Others → Alerts & Promotions.
//
// Authors the dialogs and banners users see pre-login (login/signup) and
// post-login (dashboard/workspaces). Super admin only — the sidebar entry is
// superOnly, and /garage-admin/announcements is not in the delegatable page
// catalogue, so the backend gate is super-admin by default too.
//
// Backend: garagenew-backend routes/garageAdminAnnouncements.ts.

import AnnouncementsConsole from "@/components/garage-admin/AnnouncementsConsole";

export default function AnnouncementsPage() {
  return <AnnouncementsConsole />;
}
