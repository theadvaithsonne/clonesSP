"use client";

// Boots posthog-js and keeps its distinct_id in sync with the JWT identity.
// Rendered in the root layout so it survives navigation (initPostHog is
// idempotent). On login/logout — garage's auth helpers fire `garage:token-change`
// / `garage:logout` (and `storage` fires in other tabs) — we identify() the
// browser as the user or reset() back to a fresh anonymous id. Identifying with
// the JWT userId (the same id NC + the RN apps use) merges a person's activity
// across every garage surface into one profile.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getUserDataFromToken } from "@/lib/auth";
import {
  initPostHog,
  identifyUser,
  setOrgGroup,
  resetPostHog,
  registerSurface,
} from "@/lib/posthog";

export default function PostHogInit() {
  const pathname = usePathname();

  // Re-stamp the surface on every navigation. The `app` super property is
  // persisted per origin, so crossing between the member app and /garage-admin
  // in one session would otherwise leave every later event wearing the wrong
  // product tag.
  useEffect(() => {
    registerSurface();
  }, [pathname]);

  useEffect(() => {
    initPostHog();
    let currentUserId: string | null = null;
    const apply = () => {
      const u = getUserDataFromToken();
      if (u?.userId) {
        if (u.userId !== currentUserId) {
          identifyUser({
            id: u.userId,
            email: u.email || undefined,
            displayName: u.name || undefined,
          });
          if (u.orgId) setOrgGroup({ id: u.orgId });
          currentUserId = u.userId;
        }
      } else if (currentUserId) {
        resetPostHog();
        currentUserId = null;
      }
    };
    apply();
    window.addEventListener("storage", apply);
    window.addEventListener("garage:token-change", apply);
    window.addEventListener("garage:logout", apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener("garage:token-change", apply);
      window.removeEventListener("garage:logout", apply);
    };
  }, []);
  return null;
}
