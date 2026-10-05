"use client";

/**
 * Escape hatch for the "Add account" flow.
 *
 * `beginAddAccount()` sets a per-tab flag, and the login screen honours it by
 * NOT bouncing an already-authenticated visitor into the workspace — which is
 * what makes adding a second account possible at all. The side effect is that
 * the flow becomes one-way: someone who opened "Add account" and changed their
 * mind has no route back, because the sign-in form is the whole screen and
 * every path off it requires completing a sign-in they no longer want.
 *
 * This renders ONLY in that situation, so the ordinary login screen is
 * untouched: a first-time visitor, a lapsed session and a fresh tab all see
 * exactly what they saw before.
 *
 * Cancelling clears the flag and returns to the app. Nothing was torn down on
 * the way in — "Add account" only sets the flag and navigates — so the
 * original account is still live and simply resumes.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getUserDataFromToken, isAuthenticated } from "@/lib/auth";
import { endAddAccount, isAddingAccount } from "@/lib/accounts";

export default function CancelAddAccount({ landing = "/workspace" }: { landing?: string }) {
  const router = useRouter();
  // sessionStorage is unreadable during SSR and the first client render, so
  // this resolves on mount. `null` renders nothing, which means the default —
  // and the server-rendered markup — is the plain login screen.
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // Both conditions matter. The flag alone isn't enough: if the original
    // session lapsed while the user sat here there is no account to go back
    // to, and offering the button would bounce them straight back to /login.
    if (!isAddingAccount() || !isAuthenticated()) return;
    const jwt = getUserDataFromToken();
    setLabel(jwt.email || jwt.name || "your account");
  }, []);

  if (!label) return null;

  return (
    <button
      type="button"
      onClick={() => {
        endAddAccount();
        router.replace(landing);
      }}
      className="mb-4 flex items-center gap-1.5 text-xs text-[#9fa0b8] transition-colors hover:text-white sm:text-sm"
    >
      <ChevronLeft className="h-4 w-4" />
      <span>
        Back to <span className="text-white">{label}</span>
      </span>
    </button>
  );
}
