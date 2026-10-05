"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BoardData } from "../types";
import { X, DollarSign, Loader2, CheckCircle, Send, Sparkles, Wallet } from "lucide-react";
import { LayawayUserSearch, LayawayPickedUser } from "./LayawayUserSearch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
}

// The two known bat246_entry products — same IDs the rest of the app
// already hardcodes (checkout, invite links, etc.). Server always
// re-derives the real price from these; these labels are display-only.
const PRODUCT_OPTIONS = [
  { productId: "6a159466cd9f94f7f23b2ef9", label: "$650 Board Entry" },
  { productId: "6a7236f5e76fd9817e7238d9", label: "$160 POD Entry" },
] as const;

interface Pool {
  pool: string;
  cap: number;
  alreadyGiven: number;
  remaining: number;
  detail: string;
}

interface Eligibility {
  eligible: boolean;
  isAlanK: boolean;
  totalCap: number;
  totalAlreadyGiven: number;
  totalRemaining: number;
  pools: Pool[];
}

type Mode = "amount" | "product";

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const TOAST_DURATION_MS = 4000;

/**
 * Fully custom toast content (sonner's toast.custom — same library already
 * used everywhere else in this app, just not the plain default look) so
 * the give/request success toast matches this modal's own dark/yellow
 * BAT246 styling instead of sonner's generic black bar: an icon badge, the
 * message, an X dismiss button, and a shrinking progress bar that visually
 * tracks the same duration the toast auto-dismisses on.
 *
 * Width capped against the viewport (calc(100vw-2rem)) so it doesn't
 * overflow a phone screen the way a bare fixed px width would — sonner
 * already positions/stacks toasts, this just keeps this one's own box
 * from being wider than the screen.
 */
function LayawaySuccessToast({ message, toastId }: { message: string; toastId: string | number }) {
  const [shrink, setShrink] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShrink(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="w-[min(400px,calc(100vw-2rem))] bg-[#12121e] border border-yellow-500/30 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0 text-white text-base sm:text-lg font-semibold leading-snug">{message}</div>
        <button
          onClick={() => toast.dismiss(toastId)}
          aria-label="Dismiss"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="h-[3px] bg-white/5">
        <div
          className="h-full bg-yellow-400"
          style={{ width: shrink ? "0%" : "100%", transition: shrink ? `width ${TOAST_DURATION_MS}ms linear` : "none" }}
        />
      </div>
    </div>
  );
}

function showLayawaySuccessToast(message: string) {
  toast.custom((t) => <LayawaySuccessToast message={message} toastId={t} />, {
    position: "top-right",
    duration: TOAST_DURATION_MS,
  });
}

/**
 * A chosen recipient/eligible-person row (the collapsed "X selected" state
 * for the LayawayUserSearch fields below). Its own small component because
 * it's used three times and needs the same overflow guard each time: a
 * long name + email in a narrow flex row can push the X button off-screen
 * (or force the whole modal wider) without min-w-0 + truncate — this hit
 * on mobile where the modal is only just over 300px wide.
 */
function ChosenPersonRow({ person, onClear }: { person: LayawayPickedUser; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-4 sm:px-5 py-3 sm:py-3.5 border border-white/10">
      <div className="min-w-0 flex-1">
        <div className="text-white text-lg sm:text-xl truncate">{person.name}</div>
        <div className="text-white/45 text-sm sm:text-base truncate">{person.email}</div>
      </div>
      <button onClick={onClear} className="text-white/40 hover:text-white flex-shrink-0">
        <X className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
    </div>
  );
}

// `board` is accepted but never read inside — kept optional so this modal
// can also open from a page with no board context at all (the B2 Coin
// Wallet page's "Transact" button), not just from a board's Layaway
// toolbar button (BoardLayout.tsx, which still passes it).
export function LayawayModal({ onClose }: { board?: BoardData; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  // Coins already sitting in this user's own wallet (received from
  // someone else's earlier give) — a second, independent thing they can
  // send, on top of whatever pool-based giving power they have. This is
  // the fix for a real bug: someone with 4 received B2 Coins but no
  // qualifying board position previously saw "$0 remaining, not eligible"
  // here and had no way to pass their own coins along.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Shared give/request form state
  const [recipient, setRecipient] = useState<LayawayPickedUser | null>(null);
  const [mode, setMode] = useState<Mode>("amount");
  const [amount, setAmount] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [eligiblePerson, setEligiblePerson] = useState<LayawayPickedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send and Request are two independent actions, not an either/or gated
  // on your own balance — someone with $4 available might still want to
  // request a bigger amount from someone eligible. The only hard rule is
  // Alan never sees Request (unlimited supply, nothing to ask for) — see
  // the tab bar below, hidden entirely for him. Defaults to whichever tab
  // makes sense once the fetch resolves: Send if there's anything to send,
  // Request otherwise — set in fetchAll below since it depends on the
  // freshly-fetched numbers, not yet-stale state.
  const [view, setView] = useState<"send" | "request">("send");

  function fetchAll() {
    setLoading(true);
    const headers = { Authorization: `Bearer ${getToken()}` };
    Promise.all([
      fetch(`${API}/bat246/layaway/my-eligibility`, { headers }).then((r) => r.json()),
      fetch(`${API}/bat246/layaway/my-wallet`, { headers }).then((r) => r.json()),
    ])
      .then(([eligRes, walletRes]) => {
        const elig: Eligibility | null = eligRes.eligibility ?? null;
        const balance: number = walletRes.wallet?.balance ?? 0;
        setEligibility(elig);
        setWalletBalance(balance);
        const sendable = elig?.isAlanK ? Number.POSITIVE_INFINITY : balance + (elig?.totalRemaining ?? 0);
        setView(elig?.isAlanK || sendable > 0.004 ? "send" : "request");
      })
      .catch(() => {
        setEligibility(null);
        setWalletBalance(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  function resetForm() {
    setRecipient(null);
    setEligiblePerson(null);
    setMode("amount");
    setAmount("");
    setProductId(null);
    setNote("");
  }

  const isAlanK = !!eligibility?.isAlanK;
  // The one number this whole modal is built around: what can actually be
  // sent right now, combining coins already received (walletBalance) with
  // pool-based giving power (eligibility.totalRemaining) — the two are
  // genuinely different sources, but from the sender's point of view it's
  // all just "B2 Coins I can send". Null while still loading.
  const maxSendable =
    eligibility && walletBalance !== null
      ? isAlanK
        ? Number.POSITIVE_INFINITY
        : walletBalance + eligibility.totalRemaining
      : null;
  const hasAnythingToSend = maxSendable !== null && (isAlanK || maxSendable > 0.004);

  const enteredAmount = mode === "amount" ? Number(amount) : null;
  const amountTooHigh =
    !isAlanK &&
    maxSendable !== null &&
    enteredAmount !== null &&
    enteredAmount > 0 &&
    enteredAmount > maxSendable + 0.004;

  async function handleSend() {
    if (!recipient) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/bat246/layaway/give`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          recipientUserId: recipient.userId,
          ...(mode === "product" ? { productId } : { amount: Number(amount) }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send B2 Coins");
      // data.amount is the server-computed actual amount (GiveResult) —
      // for a product-targeted give this is the real derived price, never
      // just echoing back whatever the client's own amount input held.
      showLayawaySuccessToast(`Sent $${Number(data.amount).toLocaleString()} B2 Coins to ${recipient.name}`);
      resetForm();
      fetchAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequest() {
    if (!eligiblePerson || !recipient) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/bat246/layaway/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          eligibleUserId: eligiblePerson.userId,
          recipientUserId: recipient.userId,
          note: note.trim() || undefined,
          ...(mode === "product" ? { productId } : { amount: Number(amount) }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      // data.request.amount is the server-resolved amount, same reasoning
      // as the send flow above.
      showLayawaySuccessToast(`Requested $${Number(data.request?.amount).toLocaleString()} B2 Coins from ${eligiblePerson.name}`);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSend = !!recipient && (mode === "product" ? !!productId : Number(amount) > 0) && !amountTooHigh;
  const canRequest = !!eligiblePerson && !!recipient && (mode === "product" ? !!productId : Number(amount) > 0);

  return createPortal(
    // p-4 on the overlay is what keeps the modal off the screen edges on a
    // phone — without it, w-full below would run edge-to-edge.
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="bg-[#12121e] border border-white/15 rounded-[18px] w-full max-w-[700px] max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0" />
            <span className="text-white font-bold text-xl sm:text-3xl truncate">Send B2 Coins</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <X className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-white/40" />
            </div>
          ) : (
            <>
              {/* ── One summary: what you can send, and where it's from ─── */}
              <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] p-4 sm:p-6">
                {isAlanK ? (
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                    <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-300" />
                    <span className="text-2xl sm:text-3xl font-black text-yellow-300">Unlimited</span>
                    <span className="text-white/45 text-base sm:text-lg">— admin access</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl sm:text-3xl font-black text-yellow-300 mb-3 break-words">
                      ${fmt(maxSendable ?? 0)} <span className="text-base sm:text-lg text-white/45 font-semibold">available to send</span>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-2.5 text-base sm:text-lg">
                      <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10 text-white/65">
                        <Wallet className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> ${fmt(walletBalance ?? 0)} from your balance
                      </span>
                      <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10 text-white/65">
                        <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> ${fmt(eligibility?.totalRemaining ?? 0)} giving power
                      </span>
                    </div>
                    {eligibility && eligibility.pools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                        {eligibility.pools.map((p) => (
                          <span key={p.pool} className="text-sm sm:text-base px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50" title={p.detail}>
                            {p.detail} — ${fmt(p.remaining)} left
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Send / Request tabs — independent actions, not gated on
                  your own balance. Alan never needs Request (unlimited),
                  so the tab bar itself doesn't exist for him — just the
                  Send panel, same as before. */}
              {!isAlanK && (
                <div className="flex gap-2 sm:gap-2.5">
                  <button
                    onClick={() => setView("send")}
                    className={`flex-1 py-3 sm:py-3.5 rounded-lg text-base sm:text-xl font-semibold transition-colors border ${view === "send" ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/50"}`}
                  >
                    Send
                  </button>
                  <button
                    onClick={() => setView("request")}
                    className={`flex-1 py-3 sm:py-3.5 rounded-lg text-base sm:text-xl font-semibold transition-colors border ${view === "request" ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/50"}`}
                  >
                    Request
                  </button>
                </div>
              )}

              {error && <p className="text-red-400 text-base sm:text-lg">{error}</p>}

              {isAlanK || view === "send" ? (
                // ── Send panel — works whether the coins come from what
                // you've received, your giving power, or both ──────────
                <div className="space-y-4">
                  {!isAlanK && !hasAnythingToSend && (
                    <p className="text-white/55 text-base sm:text-lg">
                      You don&apos;t have any B2 Coins to send yet — switch to Request to ask someone who does.
                    </p>
                  )}
                  <label className="text-white/65 text-base sm:text-lg font-semibold block">Send to</label>
                  {recipient ? (
                    <ChosenPersonRow person={recipient} onClear={() => setRecipient(null)} />
                  ) : (
                    <LayawayUserSearch endpoint="/bat246/layaway/recipients/search" resultsKey="users" onSelect={setRecipient} />
                  )}

                  <AmountOrProduct mode={mode} setMode={setMode} amount={amount} setAmount={setAmount} productId={productId} setProductId={setProductId} />
                  {!isAlanK && mode === "amount" && (
                    <p className={`text-base sm:text-lg ${amountTooHigh ? "text-red-400" : "text-white/45"}`}>
                      {amountTooHigh
                        ? `Only $${fmt(maxSendable ?? 0)} available to send`
                        : `Up to $${fmt(maxSendable ?? 0)} available`}
                    </p>
                  )}

                  <button
                    onClick={handleSend}
                    disabled={!canSend || submitting}
                    className="w-full py-3.5 sm:py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-base sm:text-xl font-bold transition-colors flex items-center justify-center gap-2.5"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
                    Send B2 Coins
                  </button>
                </div>
              ) : (
                // ── Request panel — ask someone else to give, whether
                // because you have nothing of your own yet or just want
                // more than your own $X available covers ────────────────
                <div className="space-y-4">
                  <p className="text-white/60 text-base sm:text-lg">
                    {hasAnythingToSend
                      ? `Asking for more than your own $${fmt(maxSendable ?? 0)} available? Ask someone eligible to give it directly.`
                      : "You don't have any B2 Coins to send yet — ask someone who has coins to spare."}
                  </p>

                  <label className="text-white/65 text-base sm:text-lg font-semibold block">Ask</label>
                  {eligiblePerson ? (
                    <ChosenPersonRow person={eligiblePerson} onClear={() => setEligiblePerson(null)} />
                  ) : (
                    <LayawayUserSearch endpoint="/bat246/layaway/eligible-people" resultsKey="people" onSelect={setEligiblePerson} showRemaining />
                  )}

                  <label className="text-white/65 text-base sm:text-lg font-semibold block">To give it to</label>
                  {recipient ? (
                    <ChosenPersonRow person={recipient} onClear={() => setRecipient(null)} />
                  ) : (
                    <LayawayUserSearch endpoint="/bat246/layaway/recipients/search" resultsKey="users" onSelect={setRecipient} />
                  )}

                  <AmountOrProduct mode={mode} setMode={setMode} amount={amount} setAmount={setAmount} productId={productId} setProductId={setProductId} />

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    rows={2}
                    className="w-full text-base sm:text-lg rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/35 focus:outline-none focus:border-yellow-500 p-3.5 sm:p-4 resize-none"
                  />

                  <button
                    onClick={handleRequest}
                    disabled={!canRequest || submitting}
                    className="w-full py-3.5 sm:py-4 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base sm:text-xl font-semibold transition-colors flex items-center justify-center gap-2.5"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Send className="w-5 h-5 sm:w-6 sm:h-6" />}
                    Send Request
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 sm:px-8 pb-5 sm:pb-8">
          <button onClick={onClose} className="w-full py-3.5 sm:py-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-base sm:text-lg font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AmountOrProduct({
  mode, setMode, amount, setAmount, productId, setProductId,
}: {
  mode: Mode; setMode: (m: Mode) => void;
  amount: string; setAmount: (v: string) => void;
  productId: string | null; setProductId: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex gap-2 sm:gap-2.5">
        <button
          onClick={() => setMode("amount")}
          className={`flex-1 py-2.5 sm:py-3 rounded-md text-sm sm:text-lg font-semibold transition-colors border ${mode === "amount" ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/50"}`}
        >
          Coin Amount
        </button>
        <button
          onClick={() => setMode("product")}
          className={`flex-1 py-2.5 sm:py-3 rounded-md text-sm sm:text-lg font-semibold transition-colors border ${mode === "product" ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/50"}`}
        >
          For a Product
        </button>
      </div>

      {mode === "amount" ? (
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="B2 Coins to send"
          className="w-full text-xl sm:text-2xl font-semibold rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/30 placeholder:font-normal placeholder:text-base sm:placeholder:text-lg focus:outline-none focus:border-yellow-500 px-4 sm:px-5 py-3 sm:py-3.5"
        />
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          {PRODUCT_OPTIONS.map((p) => (
            <button
              key={p.productId}
              onClick={() => setProductId(p.productId)}
              className={`flex-1 py-2.5 sm:py-3 rounded-lg text-sm sm:text-lg font-semibold transition-colors border ${productId === p.productId ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/60"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
