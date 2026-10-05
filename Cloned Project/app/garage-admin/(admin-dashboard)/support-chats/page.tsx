"use client";

// Support Chats — Admin → Others → Support Chats.
//
// Every member has one support chat; every active admin is a participant and
// replies as their own app user. No page permission is required (the sidebar
// entry is marked everyAdmin), so the only gates are the shared admin session
// and step-up verification, both handled by the layout and the API.
//
// Backend: garagenew-backend routes/garageAdminSupportChats.ts.

import SupportChatsConsole from "@/components/garage-admin/SupportChatsConsole";

export default function SupportChatsPage() {
  return <SupportChatsConsole />;
}
