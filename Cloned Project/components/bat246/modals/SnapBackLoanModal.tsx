"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Loader2, Landmark, CheckCircle2, AlertTriangle } from "lucide-react";
import { LayawayUserSearch, LayawayPickedUser } from "./LayawayUserSearch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// Same two known bat246_entry products LayawayModal hardcodes — SBL is
// deliberately product-only (never a free dollar amount), matching the
// approved design.
const PRODUCT_OPTIONS = [
  { productId: "6a159466cd9f94f7f23b2ef9", label: "$650 Board Entry" },
  { productId: "6a7236f5e76fd9817e7238d9", label: "$160 POD Entry" },
] as const;

type Step = "loading" | "blocked" | "friend" | "product" | "terms" | "pick" | "done";

/**
 * "Request SBL" — a Snap Back Loan, distinct from LayawayModal's plain
 * "Request" B2 Coins ask: this is a debt, not a gift, automatically
 * repaid from the borrower's own future real BAT246 earnings. Kept as
 * its own modal rather than a 3rd tab on LayawayModal — different shape
 * (terms step, product-only) that would otherwise tangle two
 * conceptually different flows together.
 *
 * `productId`/`priceLabel` are pre-filled when opened from boards/page.tsx
 * (which already knows which product this distributor needs); omitted
 * when opened from the B2 Coin Wallet / Snap Back Loans pages, which show
 * a product picker first instead.
 *
 * `forFriend` — opened from the Giving Power tab's "can't lend yourself?
 * ask on someone else's behalf" shortcut: the caller doesn't have giving
 * power, so instead of borrowing for themselves they refer a friend/
 * contact to an eligible lender. Adds a "friend" step before the product
 * picker, and the terms are explicitly framed as "on {friend}'s behalf" —
 * per approved design, the friend is never asked to separately confirm
 * anything (same as the plain B2 Coins Give/Request flow never asks its
 * recipient to confirm), so there's no "blocked" pre-check here either;
 * any server-side rejection (friend already has a loan, already
 * purchased, etc.) surfaces as a normal error on the final step.
 *
 * Text sizes here are bumped a step or two above this app's usual
 * defaults, same as everywhere else under Snap Back Loans — this
 * office's members skew 60+ with low eyesight.
 */
export function SnapBackLoanModal({
  productId: initialProductId,
  priceLabel: initialPriceLabel,
  forFriend = false,
  onClose,
  onRequested,
}: {
  productId?: string;
  priceLabel?: string;
  forFriend?: boolean;
  onClose: () => void;
  onRequested?: () => void;
}) {
  const [step, setStep] = useState<Step>("loading");
  const [friend, setFriend] = useState<LayawayPickedUser | null>(null);
  const [productId, setProductId] = useState<string | null>(initialProductId ?? null);
  const [priceLabel, setPriceLabel] = useState<string>(initialPriceLabel ?? "");
  const [agreed, setAgreed] = useState(false);
  const [eligiblePerson, setEligiblePerson] = useState<LayawayPickedUser | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referring a friend isn't gated on the caller's own loan status — jump
  // straight to picking who it's for. Otherwise, check for an
  // already-outstanding loan before showing anything else (one active
  // loan per borrower at a time, approved design decision).
  useEffect(() => {
    if (forFriend) {
      setStep("friend");
      return;
    }
    fetch(`${API}/bat246/snapbackloans/my-loan`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.loan?.status === "active") {
          setStep("blocked");
        } else {
          setStep(initialProductId ? "terms" : "product");
        }
      })
      .catch(() => setStep(initialProductId ? "terms" : "product"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFriend(u: LayawayPickedUser) {
    setFriend(u);
    setStep("product");
  }

  function pickProduct(id: string, label: string) {
    setProductId(id);
    setPriceLabel(label);
    setStep("terms");
  }

  const borrowerLabel = forFriend ? friend?.name ?? "your friend" : "you";
  const borrowerPossessive = forFriend ? `${friend?.name ?? "your friend"}'s` : "your";

  async function submit() {
    if (!eligiblePerson || !productId) return;
    if (forFriend && !friend) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/bat246/snapbackloans/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          eligibleUserId: eligiblePerson.userId,
          productId,
          note: note.trim() || undefined,
          ...(forFriend && friend ? { borrowerUserId: friend.userId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request a Snap Back Loan");
      toast.success(
        forFriend
          ? `Snap Back Loan request sent to ${eligiblePerson.name} for ${friend?.name}`
          : `Snap Back Loan request sent to ${eligiblePerson.name}`
      );
      onRequested?.();
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="bg-[#12121e] border border-orange-500/25 rounded-[18px] w-full max-w-[700px] max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Landmark className="w-7 h-7 sm:w-9 sm:h-9 text-orange-400 flex-shrink-0" />
            <span className="text-white font-bold text-2xl sm:text-3xl truncate">Request a Snap Back Loan</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <X className="w-7 h-7" />
          </button>
        </div>

        <div className="p-5 sm:p-8 space-y-5">
          {step === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-9 h-9 animate-spin text-white/40" />
            </div>
          )}

          {step === "blocked" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:p-5">
                <AlertTriangle className="w-7 h-7 text-amber-300 flex-shrink-0 mt-0.5" />
                <p className="text-white/80 text-lg sm:text-xl">
                  You already have an outstanding Snap Back Loan. It's automatically being repaid from your future
                  earnings — check your B2 Coin Wallet's My Loan card for the current balance. You can request a new
                  loan once this one is fully repaid.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-lg sm:text-xl font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === "friend" && (
            <div className="space-y-4">
              <p className="text-white/60 text-lg sm:text-xl">Who&apos;s this Snap Back Loan for?</p>
              {friend ? (
                <div className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-4 sm:px-5 py-3.5 sm:py-4 border border-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-xl truncate">{friend.name}</div>
                    <div className="text-white/45 text-base truncate">{friend.email}</div>
                  </div>
                  <button onClick={() => setFriend(null)} className="text-white/40 hover:text-white flex-shrink-0">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <LayawayUserSearch endpoint="/bat246/layaway/recipients/search" resultsKey="users" onSelect={pickFriend} />
              )}
              {friend && (
                <button
                  onClick={() => setStep("product")}
                  className="w-full py-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-black text-lg sm:text-xl font-bold transition-colors"
                >
                  Continue
                </button>
              )}
            </div>
          )}

          {step === "product" && (
            <div className="space-y-4">
              {forFriend && friend && (
                <p className="text-white/45 text-base sm:text-lg">Requesting for <span className="text-white font-semibold">{friend.name}</span></p>
              )}
              <p className="text-white/60 text-lg sm:text-xl">
                {forFriend ? `Which entry is ${borrowerLabel} borrowing coins to purchase?` : "Which entry are you borrowing coins to purchase?"}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {PRODUCT_OPTIONS.map((p) => (
                  <button
                    key={p.productId}
                    onClick={() => pickProduct(p.productId, p.label)}
                    className="flex-1 py-5 rounded-lg text-lg sm:text-xl font-semibold transition-colors border bg-white/5 border-white/10 text-white/70 hover:border-orange-400/50 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "terms" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-4 sm:p-6">
                <p className="text-white text-lg sm:text-xl leading-relaxed">
                  You are requesting a <span className="font-bold text-orange-300">Snap Back Loan</span> of{" "}
                  <span className="font-bold text-orange-300">{priceLabel}</span> in B2 Coins
                  {forFriend ? <> for <b>{borrowerLabel}</b></> : null} to purchase a Product.
                </p>
                <p className="text-white/70 text-[16.8px] sm:text-[18.9px] mt-3 leading-relaxed">
                  This is a loan, not a gift - <b>all of {borrowerPossessive} BAT 246 earnings</b> (board income,
                  Leaderboard bonuses, etc) will automatically go towards the loan until it&apos;s paid.
                </p>
                {forFriend && (
                  <p className="text-white/70 text-base sm:text-lg mt-3 leading-relaxed">
                    By continuing, you&apos;re agreeing to these terms on <b>{borrowerLabel}</b>&apos;s behalf — if approved,
                    the coins land directly in {borrowerPossessive} own B2 Coin wallet and {borrowerPossessive} own future
                    earnings are what gets repaid, not yours.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-6 h-6 accent-orange-500 flex-shrink-0"
                />
                <span className="text-white/80 text-lg sm:text-xl">
                  {forFriend
                    ? `I understand and agree to these Snap Back Loan terms on ${borrowerLabel}'s behalf.`
                    : "I understand and agree to these Snap Back Loan terms."}
                </span>
              </label>

              <button
                onClick={() => setStep("pick")}
                disabled={!agreed}
                className="w-full py-4 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-lg sm:text-xl font-bold transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === "pick" && (
            <div className="space-y-4">
              {error && <p className="text-red-400 text-lg">{error}</p>}

              {forFriend && friend && (
                <p className="text-white/45 text-base sm:text-lg">Requesting for <span className="text-white font-semibold">{friend.name}</span></p>
              )}
              <label className="text-white/65 text-lg sm:text-xl font-semibold block">Ask</label>
              {eligiblePerson ? (
                <div className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-4 sm:px-5 py-3.5 sm:py-4 border border-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-xl truncate">{eligiblePerson.name}</div>
                    <div className="text-white/45 text-base truncate">{eligiblePerson.email}</div>
                  </div>
                  <button onClick={() => setEligiblePerson(null)} className="text-white/40 hover:text-white flex-shrink-0">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <LayawayUserSearch endpoint="/bat246/layaway/eligible-people" resultsKey="people" onSelect={setEligiblePerson} showRemaining />
              )}

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="w-full text-lg rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/35 focus:outline-none focus:border-orange-500 p-4 resize-none"
              />

              <button
                onClick={submit}
                disabled={!eligiblePerson || submitting}
                className="w-full py-4 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-lg sm:text-xl font-bold transition-colors flex items-center justify-center gap-2.5"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Landmark className="w-6 h-6" />}
                Request Snap Back Loan
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-5 text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
              <p className="text-white text-xl">
                {forFriend
                  ? `Your Snap Back Loan request for ${friend?.name} has been sent.`
                  : "Your Snap Back Loan request has been sent. You'll be notified once it's approved."}
              </p>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-lg sm:text-xl font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
