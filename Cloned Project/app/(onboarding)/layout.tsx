"use client";

// Licence guard for the whole onboarding group.
//
// There was no layout for `(onboarding)` before, which is exactly why nothing
// gated office creation: each page was reachable directly. One layout here
// covers every entry point, because all five funnel into this group —
// the new-signup redirect, the whitelabel-upgrade branch, select-organization's
// "Create Workspace", office-payment's `?newOffice=true`, and the sidebar's
// "Launch An Office". None of them can reach the office form without passing
// through this file.
//
// It RENDERS the gate over the page rather than redirecting: a redirect would
// lose the query params the flow depends on (`userId`, `plan`, `redirect`,
// `newOffice`), so the user would come back from checkout to a different
// screen than the one they left.
//
// SCOPE: only routes that actually CREATE an office. This group also holds
// plan-change screens used by founders who already have one — /upgrade,
// /downgrade, and /office-payment WITHOUT `newOffice` (reached from the
// sidebar, BackOfficeLockedOverlay, and as the post-creation fallback). Gating
// those would lock an existing founder out of paying for the office they
// already run, which is the opposite of the decision ("keep what you have,
// blocked from creating more").
//
// This is the convenience half of the gate. The enforcing half is
// `assertCanCreateOffice` on POST /org/create-first-time and /org/upsert —
// this layout only decides what the user SEES.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import { getUnilevelPlusProduct } from "@/lib/webinar/garage-store-plans";
import UnilevelLicenceGate from "@/components/onboarding/UnilevelLicenceGate";

/**
 * Lets a page inside the group raise the gate itself.
 *
 * Needed because the backend is the real authority: a tab that passed this
 * guard can still get a 403 later if the licence lapsed or was refunded in the
 * meantime. Without this the page would only be able to toast the raw error
 * code at the user.
 */
const LicenceGateContext = createContext<{ openGate: () => void }>({
  openGate: () => {},
});

export function useLicenceGate() {
  return useContext(LicenceGateContext);
}

/**
 * Is THIS route an office-creation route?
 *
 * `/organization` always is. `/office-payment` only when it carries
 * `newOffice=true` — without it the org already exists and the page is just a
 * plan picker.
 */
function isCreationRoute(pathname: string, search: string): boolean {
  if (pathname.startsWith("/organization")) return true;
  if (pathname.startsWith("/office-payment")) {
    return new URLSearchParams(search).get("newOffice") === "true";
  }
  return false;
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const [checked, setChecked] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [viewer, setViewer] = useState<{ email: string; name?: string } | null>(
    null
  );

  const check = useCallback(async () => {
    // `window.location.search` rather than useSearchParams(): this runs
    // client-side only, and useSearchParams in a layout would force every page
    // in the group behind a Suspense boundary.
    if (!isCreationRoute(pathname, window.location.search)) {
      setLicensed(true);
      setChecked(true);
      return;
    }

    // Signed out: there is nothing to check and no token to call with. Let the
    // page render — the pages already handle their own auth, and blocking here
    // would break the invite/guest routes that live in this group.
    if (!getToken()) {
      setLicensed(true);
      setChecked(true);
      return;
    }
    const claims = getUserDataFromToken();
    setViewer({ email: claims?.email || "", name: claims?.name });

    try {
      const product = await getUnilevelPlusProduct();
      setLicensed(!!product.purchased);
    } catch {
      // Fail OPEN. A transient lookup failure must not wall off onboarding —
      // the backend gate still rejects the actual creation, so the worst case
      // is the user fills in a form and gets a 403 they can act on, rather
      // than staring at a gate they cannot dismiss.
      setLicensed(true);
    } finally {
      setChecked(true);
    }
  }, [pathname]);

  useEffect(() => {
    check();
  }, [check]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a10]">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <LicenceGateContext.Provider value={{ openGate: () => setLicensed(false) }}>
      {children}
      {!licensed && (
        <UnilevelLicenceGate
          userEmail={viewer?.email || ""}
          userName={viewer?.name}
          onUnlocked={() => setLicensed(true)}
        />
      )}
    </LicenceGateContext.Provider>
  );
}
