"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { landingPathForAdmin } from "@/lib/admin-api/permissions";

export default function GarageAdminRoot() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("garage_admin_token");
    const adminInfo = localStorage.getItem("garage_admin_info");

    if (token && adminInfo) {
      try {
        const admin = JSON.parse(adminInfo);
        // One source of truth for "where does this admin start" — super
        // admins get Traction, everyone else the first page they can view.
        // (This used to hardcode /organizations for delegated admins, which
        // is a page many of them can't open.)
        landingPathForAdmin(admin)
          .then((path) => router.push(path))
          .catch(() => router.push("/garage-admin/login"));
      } catch (error) {
        // If parsing fails, go to login
        router.push("/garage-admin/login");
      }
    } else {
      router.push("/garage-admin/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
