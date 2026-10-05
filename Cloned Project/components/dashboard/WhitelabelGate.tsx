"use client";

// Access gate for the three surfaces the whitelabel add-on pays for:
// Domain Management, Branding and Email Setup.
//
// Without the add-on the founder sees the full WhitelabelPage pitch
// (price, features, Upgrade button) instead of the configuration
// controls — not a disabled form, not a banner above one. With it, the
// wrapped page renders untouched.
//
// Fails closed: if GET /whitelabel-addon/status errors we show the
// pitch rather than the controls. The BE gates the underlying writes
// anyway, so an optimistic render would just hand the founder a form
// that 403s on save.

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchWhitelabelStatus } from "@/lib/whitelabel-addon-api";
import WhitelabelPage from "./WhitelabelPage";

export default function WhitelabelGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const s = await fetchWhitelabelStatus();
      setHasAccess(!!s.hasAccess);
    } catch (err: any) {
      setHasAccess(false);
      if (!opts?.silent) {
        toast.error(err?.message || "Failed to check whitelabel access");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0d] py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!hasAccess) {
    // No close button here (no setActivePopover): the pitch IS the page
    // in this context, so there's nothing to close back to.
    // `onActivated` re-checks quietly so the real page appears as soon
    // as the invoice is paid, without a manual reload.
    return <WhitelabelPage onActivated={() => load({ silent: true })} />;
  }

  return <>{children}</>;
}
