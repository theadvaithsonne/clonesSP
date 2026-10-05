"use client";

// Job links copied or shared from the founder console carry the founder's own
// referral code (`?ref=<affiliateId>`), so people who apply through them are
// credited like any other referral. Reuses the app's affiliate-share helpers.

import React from "react";
import { fetchMyAffiliateId, withAffiliateRef } from "@/lib/affiliate-share";

// One lookup per page load; a failed lookup is retried by the next caller.
let pending: Promise<string> | null = null;

function loadAffiliateId(): Promise<string> {
  if (!pending) {
    pending = fetchMyAffiliateId().then((id) => {
      if (!id) pending = null;
      return id;
    });
  }
  return pending;
}

/** Returns a function that adds the signed-in user's referral code to a link. */
export function useReferralLink(): (url?: string | null) => string {
  const [affiliateId, setAffiliateId] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    loadAffiliateId().then((id) => {
      if (alive) setAffiliateId(id);
    });
    return () => {
      alive = false;
    };
  }, []);
  return React.useCallback((url?: string | null) => (url ? withAffiliateRef(url, affiliateId) : ""), [affiliateId]);
}
