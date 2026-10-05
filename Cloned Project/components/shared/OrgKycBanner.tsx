"use client";

/**
 * "KYC pending" nudge for office founders.
 *
 * Self-gating, like PhoneVerifyBanner: it asks the server whether this user is
 * the founder of an office that owes documents, and renders nothing at all
 * otherwise (non-founders, offices nobody has asked anything of, already
 * verified offices). The dialog carries the uploader itself, so the founder
 * can finish without hunting for Manage Organization — the same section also
 * lives there for anyone who closed this.
 *
 * Nothing about the close is remembered. A founder who owes KYC sees this
 * every time they open the office — on every login, every reload, and again
 * when they switch into another office of theirs that owes documents. Closing
 * it only drops it to the corner card for the rest of that view; it comes
 * back on the next load and stops for good only once the packet is submitted
 * or verified.
 */
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrgKycSection from "@/components/shared/OrgKycSection";
import {
  fetchOrgKycNudge,
  orgKycNeedsFounderAction,
  type OrgKycNudge,
} from "@/lib/org-kyc";

export default function OrgKycBanner() {
  const [nudge, setNudge] = useState<OrgKycNudge | null>(null);
  const [open, setOpen] = useState(false);
  /** Closed for this view only — never persisted. */
  const [closed, setClosed] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetchOrgKycNudge();
      setNudge(res);
      // Pop it open whenever the ball is in the founder's court.
      if (res.applicable && orgKycNeedsFounderAction(res.status)) {
        setClosed(false);
        setOpen(true);
      } else {
        setOpen(false);
      }
    } catch {
      // A failed check must never block the app or nag on a guess.
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Switching office re-mints the JWT and fires this — re-check so the nudge
  // reflects the office the founder is actually looking at.
  useEffect(() => {
    const handler = () => check();
    window.addEventListener("garage:token-change", handler);
    return () => window.removeEventListener("garage:token-change", handler);
  }, [check]);

  const closeForNow = () => {
    setClosed(true);
    setOpen(false);
  };

  if (!nudge?.applicable || !nudge.orgId) return null;
  if (!orgKycNeedsFounderAction(nudge.status)) return null;

  const rejected = nudge.status === "rejected";

  return (
    <>
      {closed && !open && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl border border-amber-500/30 bg-[#12121a] p-4 shadow-2xl">
          <button
            onClick={closeForNow}
            aria-label="Hide"
            className="absolute right-2 top-2 text-[#6a6a7a] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">
                {rejected ? "KYC needs attention" : "KYC pending"}
              </p>
              <p className="text-xs text-[#9a9aad]">
                {rejected
                  ? nudge.reviewNote ||
                  "Your reviewer sent your documents back. Update them to get verified."
                  : "Your office needs verification documents before it can be verified."}
              </p>
              <Button
                onClick={() => setOpen(true)}
                className="h-8 bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] hover:from-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_93%,black)] text-brand-foreground text-xs font-semibold"
              >
                {rejected ? "Re-upload documents" : "Upload documents"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : closeForNow())}
      >
        <DialogContent className="max-w-2xl bg-[#0f0f16] border-[#2a2a35] text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              {rejected ? "KYC needs attention" : "KYC pending"}
            </DialogTitle>
            <DialogDescription className="text-[#9a9aad]">
              Upload the documents below to get your office verified. KYC documents are encrypted and securely stored.

            </DialogDescription>
          </DialogHeader>

          <OrgKycSection
            orgId={nudge.orgId}
            onStatusChange={(record) => {
              // Once it's out of the founder's hands the nudge is done for
              // good — the status itself now fails orgKycNeedsFounderAction,
              // so it won't come back on the next load either.
              if (record.status === "submitted" || record.status === "verified") {
                setNudge((prev) =>
                  prev ? { ...prev, status: record.status } : prev,
                );
                setOpen(false);
              }
            }}
          />

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={closeForNow}
              className="h-8 border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              I'll do this later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
