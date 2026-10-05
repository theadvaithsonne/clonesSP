"use client";

import { useEffect } from "react";

const CLEANUP_KEY = "garage_initial_cleanup_done";
const CLEANUP_VERSION = "v1"; // Increment this if you want to force cleanup again for all users

export default function FirstVisitCleanup() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const cleanupDone = localStorage.getItem(CLEANUP_KEY);

    // If cleanup already done with current version, skip
    if (cleanupDone === CLEANUP_VERSION) {
      console.log("[CLEANUP] Initial cleanup already completed");
      return;
    }

    console.log("[CLEANUP] First visit detected, performing cleanup...");

    try {
      // 1. Clear all localStorage EXCEPT the cleanup marker
      const itemsToPreserve: Record<string, string> = {};

      // Optionally preserve specific keys (uncomment if needed)
      // const authToken = localStorage.getItem("auth_token");
      // if (authToken) itemsToPreserve["auth_token"] = authToken;

      localStorage.clear();

      // Restore preserved items
      Object.entries(itemsToPreserve).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      console.log("[CLEANUP] ✓ LocalStorage cleared");

      // 2. Clear all cookies
      document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        // Clear for current domain
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        // Clear for parent domain
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
        // Clear for root domain
        const rootDomain = window.location.hostname.split('.').slice(-2).join('.');
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${rootDomain}`;
      });

      console.log("[CLEANUP] ✓ Cookies cleared");

      // 3. Clear sessionStorage
      sessionStorage.clear();
      console.log("[CLEANUP] ✓ SessionStorage cleared");

      // 4. Clear IndexedDB databases (optional but thorough)
      if (window.indexedDB) {
        indexedDB.databases?.().then((databases) => {
          databases.forEach((db) => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
              console.log(`[CLEANUP] ✓ IndexedDB '${db.name}' cleared`);
            }
          });
        }).catch((err) => {
          console.warn("[CLEANUP] Could not clear IndexedDB:", err);
        });
      }

      // 5. Clear Cache Storage (Service Workers)
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
            console.log(`[CLEANUP] ✓ Cache '${name}' cleared`);
          });
        }).catch((err) => {
          console.warn("[CLEANUP] Could not clear caches:", err);
        });
      }

      // 6. Mark cleanup as complete
      localStorage.setItem(CLEANUP_KEY, CLEANUP_VERSION);
      console.log("[CLEANUP] ✅ Initial cleanup completed successfully");

    } catch (error) {
      console.error("[CLEANUP] Error during cleanup:", error);
      // Still mark as done to avoid repeated errors
      try {
        localStorage.setItem(CLEANUP_KEY, CLEANUP_VERSION);
      } catch (e) {
        console.error("[CLEANUP] Could not save cleanup marker:", e);
      }
    }
  }, []);

  // This component doesn't render anything
  return null;
}
