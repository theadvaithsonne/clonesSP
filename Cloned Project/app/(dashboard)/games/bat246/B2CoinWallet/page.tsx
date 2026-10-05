"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, DollarSign, Loader2, Sparkles, ArrowRightLeft, Check, X as XIcon, Clock, Landmark } from "lucide-react";
import { useMyBat246Grants, type Bat246CardKey } from "@/lib/hooks/useBat246CardAccess";
import { LayawayModal } from "@/components/bat246/modals/LayawayModal";
import { SnapBackLoanModal } from "@/components/bat246/modals/SnapBackLoanModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TX_PAGE_SIZE = 10;

// Mirrors DEFAULT_MEMBER_CARD_KEYS in games/bat246/page.tsx and
// DEFAULT_ORG_CARD_KEYS on the backend — every office member has these two
// automatically, so their presence in grantedKeys doesn't mean "real" admin
// access. Used only for the back-link label here (Admin Board vs Dashboard).
const DEFAULT_MEMBER_CARD_KEYS: Bat246CardKey[] = ["documentation", "b2coinwallet"];

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
  return { Authorization: `Bearer ${token}` };
}

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

interface WalletTransaction {
  id: string;
  amount: number;
  // "received" = someone gave TO this user; "sent" = this user gave to
  // someone else. Merged into one list server-side (getMyB2CoinWallet) —
  // without "sent" rows, a heavy giver like Alan (or anyone who used
  // Transact) never showed up in their own history at all.
  direction: "received" | "sent";
  counterpartyName: string;
  counterpartyEmail: string;
  productLabel: string | null;
  viaRequest: boolean;
  createdAt: string;
}

interface Wallet_ {
  balance: number;
  transactions: WalletTransaction[];
}

type RequestStatus = "pending" | "approved" | "denied" | "insufficient_at_approval" | "cancelled";

interface LayawayRequestView {
  id: string;
  amount: number;
  productLabel: string | null;
  note: string;
  status: RequestStatus;
  createdAt: string;
  respondedAt: string | null;
  recipientName: string;
  recipientEmail: string;
  // Present on "sent by you" rows — who you asked.
  eligibleName?: string;
  eligibleEmail?: string;
  // Present on "waiting on you" rows — who's asking.
  requesterName?: string;
  requesterEmail?: string;
}

interface SnapBackLoanRequestView {
  id: string;
  amount: number;
  productLabel: "board" | "pod";
  note: string;
  status: RequestStatus;
  createdAt: string;
  respondedAt: string | null;
  loanId: string | null;
  // Present on requests THIS user sent — who they asked.
  eligibleName?: string;
  eligibleEmail?: string;
  // Present on requests waiting on THIS user — who's borrowing.
  borrowerName?: string;
  borrowerEmail?: string;
}

interface SnapBackLoanRepayment {
  amount: number;
  earningDescription: string;
  balanceAfter: number;
  createdAt: string;
}

interface SnapBackLoan {
  id: string;
  productLabel: "board" | "pod";
  principal: number;
  outstandingBalance: number;
  repaid: number;
  status: "active" | "repaid";
  createdAt: string;
  repaidAt: string | null;
  giverName: string;
  giverEmail: string;
  repayments: SnapBackLoanRepayment[];
}

const SBL_PRODUCT_LABELS: Record<"board" | "pod", string> = {
  board: "$650 Board Entry",
  pod: "$160 POD Entry",
};

function fmtCoins(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATUS_STYLES: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
  denied: { label: "Denied", className: "bg-red-500/10 border-red-500/30 text-red-300" },
  insufficient_at_approval: { label: "Couldn't be covered", className: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  cancelled: { label: "Cancelled", className: "bg-white/5 border-white/15 text-white/45" },
};

function StatusBadge({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  );
}

export default function B2CoinWalletPage() {
  const { isAlanK, grantedKeys, loading: grantsLoading } = useMyBat246Grants();
  const hasRealAdminGrant = grantedKeys.some(k => !DEFAULT_MEMBER_CARD_KEYS.includes(k));
  const isAdmin = isAlanK || hasRealAdminGrant;

  const [wallet, setWallet] = useState<Wallet_ | null>(null);
  const [walletError, setWalletError] = useState(false);
  const [txPage, setTxPage] = useState(1);

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityError, setEligibilityError] = useState(false);

  // "Transact" opens the same give/request modal the board Layaway button
  // uses (LayawayModal) — same eligibility check, same recipient search
  // (scoped server-side to Garage + BAT246-office members), same "not
  // eligible → request instead" fallback, same "Alan sees no request
  // panel" behavior (his eligibility always resolves `eligible: true`).
  // Reusing it here instead of a second implementation is deliberate: the
  // edge cases this button needs (no giving power → forced into Request,
  // admin never sees Request, can't send to yourself, recipient must be a
  // real office member, amount is always server-derived for a product
  // gift) are already handled there and already exercised in production.
  const [showTransact, setShowTransact] = useState(false);

  // "Recent Transaction" card now has two tabs: the actual coin history
  // (unchanged) and Requests — tracking requests this user sent (with a
  // Cancel while still pending) and requests waiting on them as the
  // eligible person being asked (with Approve/Deny). Previously the only
  // way to act on a request was the notification bell, with no persistent
  // place to check status afterward.
  const [txView, setTxView] = useState<"transactions" | "requests" | "loanRequests">("transactions");
  const [sentRequests, setSentRequests] = useState<LayawayRequestView[] | null>(null);
  const [sentRequestsError, setSentRequestsError] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<LayawayRequestView[] | null>(null);
  const [incomingRequestsError, setIncomingRequestsError] = useState(false);
  // Which single row has an action in flight — disables just that row's
  // buttons instead of freezing the whole list while one call is out.
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  // Clicking "Approve" no longer sends immediately — it opens this
  // confirmation popup first, which also lets the approver adjust the
  // amount (e.g. give less/more than what was actually asked) before
  // anything is sent. Deny stays a direct one-click action; nothing moves
  // when denying, so there's nothing to confirm or edit.
  const [confirmingRequest, setConfirmingRequest] = useState<LayawayRequestView | null>(null);

  // ── Snap Back Loans — a separate borrow-against-future-earnings system
  // from the plain give/request above. "My Loan" shows this user's own
  // most recent loan (if any); "Loan Requests" is its own sub-tab, kept
  // visually distinct (orange, not yellow) so it's never confused with a
  // plain B2 Coins ask.
  const [showSbl, setShowSbl] = useState(false);
  const [myLoan, setMyLoan] = useState<SnapBackLoan | null>(null);
  const [myLoanError, setMyLoanError] = useState(false);
  const [sblSentRequests, setSblSentRequests] = useState<SnapBackLoanRequestView[] | null>(null);
  const [sblSentRequestsError, setSblSentRequestsError] = useState(false);
  const [sblIncomingRequests, setSblIncomingRequests] = useState<SnapBackLoanRequestView[] | null>(null);
  const [sblIncomingRequestsError, setSblIncomingRequestsError] = useState(false);
  const [sblActingOnId, setSblActingOnId] = useState<string | null>(null);
  const [confirmingSblRequest, setConfirmingSblRequest] = useState<SnapBackLoanRequestView | null>(null);

  function loadWallet() {
    setWallet(null);
    setWalletError(false);
    setTxPage(1);
    fetch(`${API}/bat246/layaway/my-wallet`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setWallet(d.wallet ?? { balance: 0, transactions: [] }))
      .catch(() => setWalletError(true));
  }

  function loadEligibility() {
    setEligibility(null);
    setEligibilityError(false);
    fetch(`${API}/bat246/layaway/my-eligibility`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setEligibility(d.eligibility ?? null))
      .catch(() => setEligibilityError(true));
  }

  function loadSentRequests() {
    setSentRequests(null);
    setSentRequestsError(false);
    fetch(`${API}/bat246/layaway/my-requests`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setSentRequests(d.requests ?? []))
      .catch(() => setSentRequestsError(true));
  }

  function loadIncomingRequests() {
    setIncomingRequests(null);
    setIncomingRequestsError(false);
    fetch(`${API}/bat246/layaway/requests-for-me`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setIncomingRequests(d.requests ?? []))
      .catch(() => setIncomingRequestsError(true));
  }

  function loadMyLoan() {
    setMyLoan(null);
    setMyLoanError(false);
    fetch(`${API}/bat246/snapbackloans/my-loan`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setMyLoan(d.loan ?? null))
      .catch(() => setMyLoanError(true));
  }

  function loadSblSentRequests() {
    setSblSentRequests(null);
    setSblSentRequestsError(false);
    fetch(`${API}/bat246/snapbackloans/my-requests`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setSblSentRequests(d.requests ?? []))
      .catch(() => setSblSentRequestsError(true));
  }

  function loadSblIncomingRequests() {
    setSblIncomingRequests(null);
    setSblIncomingRequestsError(false);
    fetch(`${API}/bat246/snapbackloans/requests-for-me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setSblIncomingRequests(d.requests ?? []))
      .catch(() => setSblIncomingRequestsError(true));
  }

  useEffect(() => {
    loadWallet();
    loadEligibility();
    loadSentRequests();
    loadIncomingRequests();
    loadMyLoan();
    loadSblSentRequests();
    loadSblIncomingRequests();
  }, []);

  async function respondToIncoming(id: string, approve: boolean, amount?: number): Promise<boolean> {
    setActingOnId(id);
    try {
      const res = await fetch(`${API}/bat246/layaway/requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ approve, ...(amount !== undefined ? { amount } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond to request");
      toast.success(approve ? `Approved — $${fmtCoins(Number(data.amount ?? amount ?? 0))} B2 Coins sent.` : "Request denied.");
      loadIncomingRequests();
      // An approval just spent from this user's own balance/giving power —
      // both cards above need to reflect it, same as after a Transact send.
      loadWallet();
      loadEligibility();
      return true;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      return false;
    } finally {
      setActingOnId(null);
    }
  }

  // The Approve confirmation modal (below) calls this on "Confirm & Send".
  // Only closes the modal on success — a failure (e.g. allowance no longer
  // covers it) leaves it open with the toast explaining why, instead of
  // silently dropping the user back with no feedback.
  async function confirmApprove(amount?: number) {
    if (!confirmingRequest) return;
    const ok = await respondToIncoming(confirmingRequest.id, true, amount);
    if (ok) setConfirmingRequest(null);
  }

  async function cancelSentRequest(id: string) {
    setActingOnId(id);
    try {
      const res = await fetch(`${API}/bat246/layaway/requests/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request");
      toast.success("Request cancelled.");
      loadSentRequests();
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setActingOnId(null);
    }
  }

  async function respondToSblIncoming(id: string, approve: boolean): Promise<boolean> {
    setSblActingOnId(id);
    try {
      const res = await fetch(`${API}/bat246/snapbackloans/requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond to request");
      toast.success(approve ? "Loan approved — coins sent." : "Loan request denied.");
      loadSblIncomingRequests();
      // Approving just spent from this user's own balance/giving power —
      // same follow-up as a plain Layaway approval.
      loadWallet();
      loadEligibility();
      return true;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      return false;
    } finally {
      setSblActingOnId(null);
    }
  }

  async function confirmApproveSbl() {
    if (!confirmingSblRequest) return;
    const ok = await respondToSblIncoming(confirmingSblRequest.id, true);
    if (ok) setConfirmingSblRequest(null);
  }

  async function cancelSblSentRequest(id: string) {
    setSblActingOnId(id);
    try {
      const res = await fetch(`${API}/bat246/snapbackloans/requests/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request");
      toast.success("Request cancelled.");
      loadSblSentRequests();
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSblActingOnId(null);
    }
  }

  return (
    <div className="w-full min-h-full bg-[#09090f] text-white">
      <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-[1100px] mx-auto">

        {/* Back */}
        <div className="mb-5">
          <Link
            href="/games/bat246"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            {grantsLoading ? "Dashboard" : isAdmin ? "Admin Board" : "Dashboard"}
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-black text-white mb-1.5">B2 Coin Wallet</h1>
            <p className="text-white/50 text-base sm:text-xl">Coins you've received, and how many you can currently give out.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSbl(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-transparent hover:bg-orange-400/10 text-orange-300 border border-orange-400/40 text-sm font-bold transition-colors"
            >
              <Landmark className="w-4 h-4" />
              Request SBL
            </button>
            <button
              onClick={() => setShowTransact(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transact
            </button>
          </div>
        </div>

        {/* ── Balance ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border-2 border-yellow-500/25 bg-gradient-to-br from-yellow-500/[0.08] to-transparent p-4 sm:p-7 mb-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* B2 coin artwork, not a ring+glyph badge — real logo, no
                  border/background needed around it. Same w-14 h-14
                  footprint the badge used to occupy. */}
              <img src="/images/bat246-b2coin-logo.png" alt="" className="w-11 h-11 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-white/50 text-sm font-semibold uppercase tracking-wide mb-1">Your Balance</div>
                {eligibility?.isAlanK ? (
                  // Alan bypasses every pool restriction and can already give
                  // out unlimited B2 Coins regardless of what's in his wallet —
                  // showing his real (near-always-zero) received balance here
                  // reads as a bug next to "Unlimited" giving power below, so
                  // admin gets the same Unlimited treatment on this card too.
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-300" />
                    <span className="text-2xl sm:text-5xl font-black text-yellow-300 leading-none break-words">Unlimited</span>
                  </div>
                ) : wallet ? (
                  <div className="text-2xl sm:text-5xl font-black text-yellow-300 leading-none break-words">
                    {fmtCoins(wallet.balance)} <span className="text-sm sm:text-xl text-yellow-300/60 font-bold">B2 Coins</span>
                  </div>
                ) : walletError ? (
                  <div className="text-red-400 text-sm">Failed to load. <button onClick={loadWallet} className="underline font-semibold">Try again</button></div>
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-white/30" />
                )}
              </div>
            </div>
          </div>
          {eligibility?.isAlanK ? (
            <p className="text-white/35 text-sm sm:text-lg mt-4">
              As BAT 246 admin, your B2 Coins are unlimited — you never need to receive any to give them out.
            </p>
          ) : wallet && wallet.balance === 0 && (
            <p className="text-white/35 text-sm sm:text-lg mt-4">
              No B2 Coins received yet — use the Transact button above to request some from an eligible office member or admin.
            </p>
          )}
        </div>

        {/* ── Giving power ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 sm:p-7 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl border border-emerald-400/30 bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="text-white font-bold text-lg">Your Giving Power</div>
          </div>

          {eligibility ? (
            eligibility.isAlanK ? (
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span className="text-2xl font-black text-yellow-300">Unlimited</span>
                <span className="text-white/40 text-sm ml-1">— admin access</span>
              </div>
            ) : eligibility.eligible ? (
              <>
                <div className="text-2xl font-black text-emerald-300 mb-3">
                  ${fmtCoins(eligibility.totalRemaining)} <span className="text-sm text-white/40 font-semibold">remaining you can give right now</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {eligibility.pools.map(p => (
                    <span
                      key={p.pool}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/55"
                      title={p.detail}
                    >
                      {p.detail} — ${fmtCoins(p.remaining)} left
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-white/45 text-base sm:text-lg">
                You're not currently eligible to give B2 Coins — you'd need to be seated at Home Plate, hold a
                Leaderboard trophy, qualify for the Matching Bonus, or be #1 in the Lostmoney lineup. Use the
                Transact button above to request B2 Coins from someone who's eligible or from admin.
              </p>
            )
          ) : eligibilityError ? (
            <div className="text-red-400 text-sm">Failed to load. <button onClick={loadEligibility} className="underline font-semibold">Try again</button></div>
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          )}
        </div>

        {/* ── My Loan — only rendered once we know whether one exists,
              so the page never flashes an empty loan card for someone
              who's never borrowed. ────────────────────────────────────── */}
        {myLoan && (
          <div className="rounded-2xl border-2 border-orange-500/25 bg-gradient-to-br from-orange-500/[0.08] to-transparent p-4 sm:p-7 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl border border-orange-400/30 bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Landmark className="w-5 h-5 text-orange-300" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold text-lg">My Snap Back Loan</div>
                <div className="text-white/40 text-sm">{SBL_PRODUCT_LABELS[myLoan.productLabel]} · funded by {myLoan.giverName}</div>
              </div>
              {myLoan.status === "repaid" && (
                <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex-shrink-0">
                  Fully Repaid
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className="text-white/40 text-xs font-semibold uppercase">Principal</div>
                <div className="text-white text-xl font-black mt-0.5">${fmtCoins(myLoan.principal)}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs font-semibold uppercase">Repaid</div>
                <div className="text-emerald-300 text-xl font-black mt-0.5">${fmtCoins(myLoan.repaid)}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs font-semibold uppercase">Outstanding</div>
                <div className="text-orange-300 text-xl font-black mt-0.5">${fmtCoins(myLoan.outstandingBalance)}</div>
              </div>
            </div>

            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-1">
              <div
                className="h-full bg-orange-400 rounded-full transition-all"
                style={{ width: `${myLoan.principal > 0 ? Math.min(100, (myLoan.repaid / myLoan.principal) * 100) : 0}%` }}
              />
            </div>
            <p className="text-white/35 text-sm">
              {myLoan.status === "active"
                ? "100% of your future BAT 246 earnings automatically go toward this until it's fully repaid."
                : "This loan is fully repaid — your future earnings now land in your wallet normally."}
            </p>

            {myLoan.repayments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">Repayment History</div>
                {myLoan.repayments.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/50 truncate">{r.earningDescription || "Earning"}</span>
                    <span className="text-orange-300 font-semibold flex-shrink-0">−${fmtCoins(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {myLoanError && (
          <div className="text-red-400 text-sm mb-5">
            Failed to load your loan. <button onClick={loadMyLoan} className="underline font-semibold">Try again</button>
          </div>
        )}

        {/* ── Recent Transaction / Requests ───────────────────────────── */}
        <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 sm:p-7">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setTxView("transactions")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${txView === "transactions" ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"}`}
              >
                Recent Transaction
              </button>
              <button
                onClick={() => setTxView("requests")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${txView === "requests" ? "bg-yellow-500 border-yellow-400 text-black" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"}`}
              >
                Requests
                {!!incomingRequests?.some(r => r.status === "pending") && (
                  <span className="ml-2 inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-400 align-middle" aria-label="Requests waiting on you" />
                )}
              </button>
              <button
                onClick={() => setTxView("loanRequests")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${txView === "loanRequests" ? "bg-orange-500 border-orange-400 text-black" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"}`}
              >
                Loan Requests
                {!!sblIncomingRequests?.some(r => r.status === "pending") && (
                  <span className="ml-2 inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-400 align-middle" aria-label="Loan requests waiting on you" />
                )}
              </button>
            </div>
            {txView === "transactions" && wallet && wallet.transactions.length > 0 && (
              <span className="text-white/30 text-xs">{wallet.transactions.length} total</span>
            )}
          </div>

          {txView === "requests" ? (
            <div className="space-y-7">
              {/* ── Waiting on you — Approve/Deny ─────────────────────── */}
              <div>
                <div className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3">Waiting on you</div>
                {!incomingRequests && !incomingRequestsError && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                  </div>
                )}
                {incomingRequestsError && (
                  <div className="text-red-400 text-sm py-3 text-center">Failed to load. <button onClick={loadIncomingRequests} className="underline font-semibold">Try again</button></div>
                )}
                {incomingRequests && incomingRequests.length === 0 && (
                  <div className="text-white/35 text-base py-3">Nothing waiting on you right now.</div>
                )}
                {incomingRequests && incomingRequests.length > 0 && (
                  <div className="space-y-2.5">
                    {incomingRequests.map(r => (
                      <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-white text-base font-semibold">
                              {r.requesterName} is asking for ${fmtCoins(r.amount)}{r.productLabel ? ` (${r.productLabel})` : ""} — for {r.recipientName}
                            </div>
                            <div className="text-white/40 text-sm mt-0.5">{r.requesterEmail} · {fmtWhen(r.createdAt)}</div>
                            {r.note && <div className="text-white/40 text-sm italic mt-1">&ldquo;{r.note}&rdquo;</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {r.status === "pending" ? (
                              <>
                                <button
                                  onClick={() => setConfirmingRequest(r)}
                                  disabled={actingOnId === r.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-sm font-bold transition-colors"
                                >
                                  {actingOnId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                                </button>
                                <button
                                  onClick={() => respondToIncoming(r.id, false)}
                                  disabled={actingOnId === r.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                                >
                                  <XIcon className="w-4 h-4" /> Deny
                                </button>
                              </>
                            ) : (
                              <StatusBadge status={r.status} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Sent by you — track + Cancel while pending ─────────── */}
              <div>
                <div className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3">Sent by you</div>
                {!sentRequests && !sentRequestsError && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                  </div>
                )}
                {sentRequestsError && (
                  <div className="text-red-400 text-sm py-3 text-center">Failed to load. <button onClick={loadSentRequests} className="underline font-semibold">Try again</button></div>
                )}
                {sentRequests && sentRequests.length === 0 && (
                  <div className="text-white/35 text-base py-3">You haven&apos;t requested any B2 Coins yet.</div>
                )}
                {sentRequests && sentRequests.length > 0 && (
                  <div className="space-y-2.5">
                    {sentRequests.map(r => (
                      <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-white text-base font-semibold">
                              ${fmtCoins(r.amount)}{r.productLabel ? ` (${r.productLabel})` : ""} to {r.recipientName}
                            </div>
                            <div className="text-white/40 text-sm mt-0.5">Asked {r.eligibleName} · {fmtWhen(r.createdAt)}</div>
                            {r.note && <div className="text-white/40 text-sm italic mt-1">&ldquo;{r.note}&rdquo;</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={r.status} />
                            {r.status === "pending" && (
                              <button
                                onClick={() => cancelSentRequest(r.id)}
                                disabled={actingOnId === r.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white/70 text-sm font-semibold transition-colors"
                              >
                                {actingOnId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : txView === "loanRequests" ? (
            <div className="space-y-7">
              {/* ── Waiting on you — Approve/Deny ─────────────────────── */}
              <div>
                <div className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3">Waiting on you</div>
                {!sblIncomingRequests && !sblIncomingRequestsError && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                  </div>
                )}
                {sblIncomingRequestsError && (
                  <div className="text-red-400 text-sm py-3 text-center">Failed to load. <button onClick={loadSblIncomingRequests} className="underline font-semibold">Try again</button></div>
                )}
                {sblIncomingRequests && sblIncomingRequests.length === 0 && (
                  <div className="text-white/35 text-base py-3">No Snap Back Loan requests waiting on you right now.</div>
                )}
                {sblIncomingRequests && sblIncomingRequests.length > 0 && (
                  <div className="space-y-2.5">
                    {sblIncomingRequests.map(r => (
                      <div key={r.id} className="bg-orange-500/[0.04] border border-orange-500/15 rounded-xl px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-white text-base font-semibold">
                              {r.borrowerName} is requesting a ${fmtCoins(r.amount)} Snap Back Loan ({SBL_PRODUCT_LABELS[r.productLabel]})
                            </div>
                            <div className="text-white/40 text-sm mt-0.5">{r.borrowerEmail} · {fmtWhen(r.createdAt)}</div>
                            {r.note && <div className="text-white/40 text-sm italic mt-1">&ldquo;{r.note}&rdquo;</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {r.status === "pending" ? (
                              <>
                                <button
                                  onClick={() => setConfirmingSblRequest(r)}
                                  disabled={sblActingOnId === r.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black text-sm font-bold transition-colors"
                                >
                                  {sblActingOnId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                                </button>
                                <button
                                  onClick={() => respondToSblIncoming(r.id, false)}
                                  disabled={sblActingOnId === r.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                                >
                                  <XIcon className="w-4 h-4" /> Deny
                                </button>
                              </>
                            ) : (
                              <StatusBadge status={r.status} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Sent by you — track + Cancel while pending ─────────── */}
              <div>
                <div className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3">Sent by you</div>
                {!sblSentRequests && !sblSentRequestsError && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                  </div>
                )}
                {sblSentRequestsError && (
                  <div className="text-red-400 text-sm py-3 text-center">Failed to load. <button onClick={loadSblSentRequests} className="underline font-semibold">Try again</button></div>
                )}
                {sblSentRequests && sblSentRequests.length === 0 && (
                  <div className="text-white/35 text-base py-3">You haven&apos;t requested a Snap Back Loan yet.</div>
                )}
                {sblSentRequests && sblSentRequests.length > 0 && (
                  <div className="space-y-2.5">
                    {sblSentRequests.map(r => (
                      <div key={r.id} className="bg-orange-500/[0.04] border border-orange-500/15 rounded-xl px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-white text-base font-semibold">
                              ${fmtCoins(r.amount)} Snap Back Loan ({SBL_PRODUCT_LABELS[r.productLabel]})
                            </div>
                            <div className="text-white/40 text-sm mt-0.5">Asked {r.eligibleName} · {fmtWhen(r.createdAt)}</div>
                            {r.note && <div className="text-white/40 text-sm italic mt-1">&ldquo;{r.note}&rdquo;</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={r.status} />
                            {r.status === "pending" && (
                              <button
                                onClick={() => cancelSblSentRequest(r.id)}
                                disabled={sblActingOnId === r.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white/70 text-sm font-semibold transition-colors"
                              >
                                {sblActingOnId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
          <>
          {!wallet && !walletError && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          )}

          {walletError && (
            <div className="text-red-400 text-sm py-4 text-center">Failed to load. <button onClick={loadWallet} className="underline font-semibold">Try again</button></div>
          )}

          {wallet && wallet.transactions.length === 0 && (
            <div className="text-white/35 text-base sm:text-lg py-4 text-center">
              No B2 Coins sent or received yet.
            </div>
          )}

          {wallet && wallet.transactions.length > 0 && (() => {
            const totalPages = Math.max(1, Math.ceil(wallet.transactions.length / TX_PAGE_SIZE));
            const page = Math.min(txPage, totalPages);
            const slice = wallet.transactions.slice((page - 1) * TX_PAGE_SIZE, page * TX_PAGE_SIZE);
            return (
              <>
                <div className="space-y-2.5">
                  {slice.map(t => {
                    const received = t.direction === "received";
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border ${received ? "bg-yellow-500/10 border-yellow-500/25" : "bg-white/5 border-white/15"}`}>
                            {received ? (
                              <img src="/images/bat246-b2coin-logo.png" alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <ArrowRightLeft className="w-4 h-4 text-white/50" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white text-sm font-semibold truncate">
                              {received ? t.counterpartyName : `Sent to ${t.counterpartyName}`}
                              {t.viaRequest && (
                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-2 py-0.5">
                                  {received ? "via your request" : "via a request"}
                                </span>
                              )}
                            </div>
                            <div className="text-white/40 text-xs truncate">{t.counterpartyEmail} · {fmtWhen(t.createdAt)}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`font-bold text-base ${received ? "text-yellow-300" : "text-white/60"}`}>
                            {received ? "+" : "−"}{fmtCoins(t.amount)}
                          </div>
                          {t.productLabel && <div className="text-white/35 text-[11px]">{t.productLabel}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* See-all-transactions pagination — the fetch already
                    brings back up to 500 rows (getMyB2CoinWallet), this
                    just pages through them client-side, matching the
                    Previous/Next pattern used across the rest of
                    games/bat246 (boards/page.tsx, members/page.tsx). */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <span className="text-xs text-white/30">
                      Page <span className="text-white/50 font-medium">{page}</span> of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTxPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                      </button>
                      <button
                        onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          </>
          )}
        </div>
      </div>

      {showTransact && (
        <LayawayModal
          onClose={() => {
            setShowTransact(false);
            // A give just spent from this user's own giving-power pools
            // (eligibility.totalRemaining), and the modal's own Request tab
            // can create a new "sent by you" row — refresh everything this
            // page shows instead of going stale until a manual reload.
            loadWallet();
            loadEligibility();
            loadSentRequests();
            loadIncomingRequests();
          }}
        />
      )}

      {confirmingRequest && (
        <ApproveRequestModal
          request={confirmingRequest}
          submitting={actingOnId === confirmingRequest.id}
          onCancel={() => setConfirmingRequest(null)}
          onConfirm={confirmApprove}
        />
      )}

      {showSbl && (
        <SnapBackLoanModal
          onClose={() => setShowSbl(false)}
          onRequested={() => {
            loadSblSentRequests();
            loadMyLoan();
          }}
        />
      )}

      {confirmingSblRequest && (
        <ApproveSblRequestModal
          request={confirmingSblRequest}
          submitting={sblActingOnId === confirmingSblRequest.id}
          onCancel={() => setConfirmingSblRequest(null)}
          onConfirm={confirmApproveSbl}
        />
      )}
    </div>
  );
}

/**
 * Approving a Snap Back Loan request — same confirm-first pattern as
 * ApproveRequestModal, but the amount is never editable (SBL is always
 * product-only, per the approved design) and the copy is explicit that
 * this creates a real debt for the borrower, not a no-strings gift.
 */
function ApproveSblRequestModal({
  request,
  submitting,
  onCancel,
  onConfirm,
}: {
  request: SnapBackLoanRequestView;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="bg-[#12121e] border border-orange-500/25 rounded-[18px] w-full max-w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-7 py-5 sm:py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Landmark className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400 flex-shrink-0" />
            <span className="text-white font-bold text-xl sm:text-2xl truncate">Approve Loan Request</span>
          </div>
          <button onClick={onCancel} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-7 space-y-5">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-4 sm:p-5">
            <div className="text-white text-base sm:text-lg font-semibold break-words">
              {request.borrowerName} is requesting a ${fmtCoins(request.amount)} Snap Back Loan
            </div>
            <div className="text-white/40 text-sm mt-1 break-words">
              {request.borrowerEmail} · {SBL_PRODUCT_LABELS[request.productLabel]}
            </div>
            {request.note && (
              <div className="text-white/45 text-sm sm:text-base italic mt-2 break-words">&ldquo;{request.note}&rdquo;</div>
            )}
          </div>

          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            Approving will send ${fmtCoins(request.amount)} in B2 Coins from your own giving power to {request.borrowerName} —
            same as a normal gift. Unlike a gift, it's automatically repaid from <b>{request.borrowerName}&apos;s</b> future BAT 246 earnings;
            your own giving power is not restored when it's repaid.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 py-3 sm:py-3.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-base font-medium transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className="flex-1 py-3 sm:py-3.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-base font-bold transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Confirm &amp; Send
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Approving used to send immediately on click — no confirmation, no way to
 * see what you were about to approve, no way to give a different amount
 * than what was literally asked. This is the popup that fixes all three:
 * shows the request in full, and (for a plain-amount request — a
 * product-targeted one's amount is always the real product price and
 * can't be edited) lets the approver adjust the amount before anything
 * actually moves.
 */
function ApproveRequestModal({
  request,
  submitting,
  onCancel,
  onConfirm,
}: {
  request: LayawayRequestView;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (amount?: number) => void;
}) {
  const isProduct = !!request.productLabel;
  const [amount, setAmount] = useState(String(request.amount));
  const amountChanged = !isProduct && Number(amount) !== request.amount;

  return createPortal(
    // p-4 on the overlay keeps this off the screen edges on a phone —
    // same pattern as LayawayModal's own overlay.
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="bg-[#12121e] border border-white/15 rounded-[18px] w-full max-w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-7 py-5 sm:py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Check className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400 flex-shrink-0" />
            <span className="text-white font-bold text-xl sm:text-2xl truncate">Approve Request</span>
          </div>
          <button onClick={onCancel} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-7 space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="text-white text-base sm:text-lg font-semibold break-words">
              {request.requesterName} is asking for B2 Coins — to give to {request.recipientName}
            </div>
            <div className="text-white/40 text-sm mt-1 break-words">{request.requesterEmail}</div>
            {request.note && (
              <div className="text-white/45 text-sm sm:text-base italic mt-2 break-words">&ldquo;{request.note}&rdquo;</div>
            )}
          </div>

          {isProduct ? (
            <div>
              <div className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-2">Amount</div>
              <div className="text-white text-xl sm:text-2xl font-black break-words">
                ${fmtCoins(request.amount)} <span className="text-sm sm:text-base text-white/40 font-semibold">— {request.productLabel}</span>
              </div>
              <p className="text-white/35 text-sm mt-2">
                Product-based amounts are always the real product price — this can&apos;t be edited here.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-white/60 text-sm font-semibold uppercase tracking-wider block mb-2">Amount to send</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xl sm:text-2xl font-semibold rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-yellow-500 px-4 sm:px-5 py-3 sm:py-3.5"
              />
              <p className={`text-sm mt-2 ${amountChanged ? "text-amber-300" : "text-white/35"}`}>
                {amountChanged
                  ? `Originally asked for $${fmtCoins(request.amount)} — you're sending a different amount.`
                  : `Originally asked for $${fmtCoins(request.amount)}.`}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 py-3 sm:py-3.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-base font-medium transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(isProduct ? undefined : Number(amount))}
              disabled={submitting || (!isProduct && !(Number(amount) > 0))}
              className="flex-1 py-3 sm:py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-base font-bold transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Confirm &amp; Send
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
