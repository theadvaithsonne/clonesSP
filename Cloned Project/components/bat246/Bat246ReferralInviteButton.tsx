"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * Same destination as "Share Landing Page → Go to Bigwin landing page" in the
 * right panel's Grow Your Network (RightPanel.tsx BAT246_BIGWIN_OPTION): the
 * gotobigwin.com landing with the member's own affiliate id as `?ref=`.
 * Hard-coded origin for the same reason it is there — it's a one-office link.
 */
const BAT246_PUBLIC_ORIGIN = "https://gotobigwin.com";

/**
 * "Invite by your Referral Id" — shown under the title on the BAT 246
 * dashboards (admin and non-admin). Opens a small popup holding the member's
 * personal link with a Copy button. The id is fetched once on mount, so the
 * popup opens instantly; until it arrives the button is disabled rather than
 * handing out a link with no code on it.
 *
 * Type is sized for older members (the same audience as the rest of this
 * office's UI): 16px+ everywhere, large tap targets.
 */
export function Bat246ReferralInviteButton() {
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ affiliateId?: string }>("/affiliate/my-affiliate-id", {
      method: "GET",
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!cancelled && res?.affiliateId) setAffiliateId(res.affiliateId);
      })
      .catch((err) => console.error("Error fetching affiliate ID:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc closes, and the page behind doesn't scroll while the popup is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const url = affiliateId
    ? `${BAT246_PUBLIC_ORIGIN}/?ref=${affiliateId}`
    : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!url}
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 border-[#F0B74D]/60 bg-[#F0B74D]/15 px-5 py-3 text-base font-bold text-[#F7D27E] transition hover:bg-[#F0B74D]/25 disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
      >
        <Link2 className="h-5 w-5" />
        Invite by your Referral Id
      </button>

      {open && url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Your referral link"
        >
          <div
            className="w-full max-w-lg rounded-2xl border-2 border-white/15 bg-[#14141c] p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-black text-white sm:text-2xl">
                Invite by your Referral Id
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 -mt-2 cursor-pointer rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="mt-2 text-base text-white/65 sm:text-lg">
              Share this link. Anyone who joins through it is linked to you.
            </p>

            <div className="mt-5 break-all rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-base font-semibold text-white sm:text-lg">
              {url}
            </div>

            <button
              type="button"
              onClick={copy}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F0B74D] px-5 py-3.5 text-lg font-black text-[#17120E] transition hover:brightness-105 sm:text-xl"
            >
              {copied ? (
                <>
                  <Check className="h-6 w-6" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-6 w-6" /> Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
