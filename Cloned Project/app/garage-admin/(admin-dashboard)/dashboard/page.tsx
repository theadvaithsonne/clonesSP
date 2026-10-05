"use client";

// Admin management moved into the consolidated Roles & Access page
// (/garage-admin/roles), which does both defining roles and giving admins a
// role + per-action access. This route now just forwards there so old
// bookmarks, the header brand link and any stale deep links still land in the
// right place instead of on a duplicate admin table.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function GarageAdminDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/garage-admin/roles");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-24 text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
