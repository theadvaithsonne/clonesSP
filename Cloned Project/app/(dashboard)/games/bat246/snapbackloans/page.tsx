"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Landmark, Sparkles, DollarSign, Check, X as XIcon, Clock } from "lucide-react";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";
import { SnapBackLoanModal } from "@/components/bat246/modals/SnapBackLoanModal";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const POD_ENTRY_PRODUCT_ID = "6a7236f5e76fd9817e7238d9";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
  return { Authorization: `Bearer ${token}` };
}

interface LoanRow {
  id: string;
  borrowerName: string;
  borrowerEmail: string;
  giverName: string;
  giverEmail: string;
  productLabel: "board" | "pod";
  principal: number;
  outstandingBalance: number;
  repaid: number;
  status: "active" | "repaid";
  createdAt: string;
  repaidAt: string | null;
  borrowerCurrentGivingPower: number;
}

function fmt(n: number) {
  if (n >= Number.MAX_SAFE_INTEGER) return "Unlimited";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PRODUCT_LABELS: Record<"board" | "pod", string> = {
  board: "$650 Board Entry",
  pod: "$160 POD Entry",
};

type ReqStatus = "pending" | "approved" | "denied" | "insufficient_at_approval" | "cancelled";
interface SblRequest {
  id: string;
  amount: number;
  productLabel: "board" | "pod";
  note: string;
  status: ReqStatus;
  createdAt: string;
  loanId: string | null;
  eligibleName?: string;
  eligibleEmail?: string;
  borrowerName?: string;
  borrowerEmail?: string;
  // Set when someone without giving power of their own refers a
  // friend/contact to an eligible lender instead of asking for
  // themselves — the referrer, distinct from who the loan is actually
  // for (borrowerName/borrowerEmail above).
  requestedByName?: string;
  requestedByEmail?: string;
  isReferral: boolean;
}

const STATUS_STYLES: Record<ReqStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
  denied: { label: "Denied", className: "bg-red-500/10 border-red-500/30 text-red-300" },
  insufficient_at_approval: { label: "Couldn't be covered", className: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  cancelled: { label: "Cancelled", className: "bg-white/5 border-white/15 text-white/45" },
};

/**
 * Shared table — same columns for the admin's org-wide grid and a plain
 * member's own-activity grid, so both "grids" genuinely look like the
 * same feature rather than two different UIs that happen to share a name.
 *
 * Text sizes throughout this page are bumped a step or two above this
 * app's usual defaults, per explicit feedback: this office's members
 * skew 60+ with low eyesight, and small/dense text is genuinely hard for
 * them to read. Applies everywhere in this file, not just here.
 */
function LoansGrid({
  loans,
  error,
  onRetry,
  emptyMessage,
}: {
  loans: LoanRow[] | null;
  error: boolean;
  onRetry: () => void;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] overflow-hidden">
      {!loans && !error && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-white/30" />
        </div>
      )}
      {error && (
        <div className="text-red-400 text-lg py-10 text-center">
          Failed to load. <button onClick={onRetry} className="underline font-semibold">Try again</button>
        </div>
      )}
      {loans && loans.length === 0 && (
        <div className="text-white/35 text-lg sm:text-xl py-10 text-center">{emptyMessage}</div>
      )}
      {loans && loans.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-base sm:text-lg">
            <thead>
              <tr className="border-b border-white/10 text-white/45 text-sm uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Borrower</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-right px-4 py-3 font-semibold">Principal</th>
                <th className="text-right px-4 py-3 font-semibold">Repaid</th>
                <th className="text-right px-4 py-3 font-semibold">Outstanding</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold" title="The borrower's own current B2 Coins giving power — underwriting context for extending another loan.">
                  Purchasing Power
                </th>
                <th className="text-left px-4 py-3 font-semibold">Issued By</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5">
                    <div className="text-white font-semibold">{l.borrowerName}</div>
                    <div className="text-white/40 text-sm sm:text-base">{l.borrowerEmail}</div>
                  </td>
                  <td className="px-4 py-3.5 text-white/70">{PRODUCT_LABELS[l.productLabel]}</td>
                  <td className="px-4 py-3.5 text-right text-white/80 font-semibold">{fmt(l.principal)}</td>
                  <td className="px-4 py-3.5 text-right text-emerald-300">{fmt(l.repaid)}</td>
                  <td className="px-4 py-3.5 text-right text-orange-300 font-semibold">{fmt(l.outstandingBalance)}</td>
                  <td className="px-4 py-3.5">
                    {l.status === "active" ? (
                      <span className="text-sm font-semibold px-3 py-1 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-300">
                        Active
                      </span>
                    ) : (
                      <span className="text-sm font-semibold px-3 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                        Repaid
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-white/60">{fmt(l.borrowerCurrentGivingPower)}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-white/70">{l.giverName}</div>
                    <div className="text-white/35 text-sm sm:text-base">{l.giverEmail}</div>
                  </td>
                  <td className="px-4 py-3.5 text-white/50 whitespace-nowrap">
                    {fmtWhen(l.createdAt)}
                    {l.repaidAt && <div className="text-emerald-400/60 text-sm">Repaid {fmtWhen(l.repaidAt)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfirmApproveModal({
  request, submitting, onCancel, onConfirm,
}: { request: SblRequest; submitting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="bg-[#12121e] border border-orange-500/25 rounded-[18px] w-full max-w-[620px] shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-7 py-5 sm:py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <Landmark className="w-7 h-7 text-orange-400 flex-shrink-0" />
            <span className="text-white font-bold text-2xl sm:text-3xl truncate">Approve Loan Request</span>
          </div>
          <button onClick={onCancel} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <XIcon className="w-7 h-7" />
          </button>
        </div>
        <div className="p-5 sm:p-7 space-y-5">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-4 sm:p-5">
            <div className="text-white text-lg sm:text-xl font-semibold">
              {request.isReferral
                ? <>{request.requestedByName} is asking you to fund a ${request.amount.toLocaleString()} Snap Back Loan for {request.borrowerName}</>
                : <>{request.borrowerName} is requesting a ${request.amount.toLocaleString()} Snap Back Loan</>}
            </div>
            <div className="text-white/40 text-base sm:text-lg mt-1">
              {request.isReferral
                ? <>For {request.borrowerName} ({request.borrowerEmail}) · Asked by {request.requestedByName} · {PRODUCT_LABELS[request.productLabel]}</>
                : <>{request.borrowerEmail} · {PRODUCT_LABELS[request.productLabel]}</>}
            </div>
            {request.note && <div className="text-white/45 text-base sm:text-lg italic mt-2">&ldquo;{request.note}&rdquo;</div>}
          </div>
          <p className="text-white/70 text-base sm:text-lg leading-relaxed">
            Approving will send ${request.amount.toLocaleString()} in B2 Coins from your own giving power to {request.borrowerName}.
            Unlike a gift, it's automatically repaid from <b>{request.borrowerName}&apos;s</b> future earnings — your own giving power
            is not restored when it's repaid.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onCancel} disabled={submitting} className="flex-1 py-3.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-lg sm:text-xl font-medium transition-colors order-2 sm:order-1">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={submitting} className="flex-1 py-3.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black text-lg sm:text-xl font-bold transition-colors flex items-center justify-center gap-2 order-1 sm:order-2">
              {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
              Confirm &amp; Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Self-contained "Loan Requests" panel — Waiting on you (Approve/Deny) +
 * Sent by you (Cancel while pending). Shared by both the admin view and
 * the member view (admin can be asked for a loan too, and rarely might
 * ask one themselves) so this UI only exists once, not duplicated per
 * view. Owns its own data; `onPendingCountChange`/`onChanged` are the
 * only way it talks to its parent, for the tab-bar red dot and to let
 * the parent refresh whatever else depends on a request's outcome
 * (the admin grid, or the member's giving-power/activity).
 */
function LoanRequestsPanel({
  onPendingCountChange,
  onChanged,
}: {
  onPendingCountChange?: (n: number) => void;
  onChanged?: () => void;
}) {
  const [incoming, setIncoming] = useState<SblRequest[] | null>(null);
  const [incomingError, setIncomingError] = useState(false);
  const [sent, setSent] = useState<SblRequest[] | null>(null);
  const [sentError, setSentError] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SblRequest | null>(null);

  function loadIncoming() {
    setIncoming(null);
    setIncomingError(false);
    fetch(`${API}/bat246/snapbackloans/requests-for-me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setIncoming(d.requests ?? []))
      .catch(() => setIncomingError(true));
  }
  function loadSent() {
    setSent(null);
    setSentError(false);
    fetch(`${API}/bat246/snapbackloans/my-requests`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setSent(d.requests ?? []))
      .catch(() => setSentError(true));
  }

  useEffect(() => { loadIncoming(); loadSent(); }, []);
  useEffect(() => {
    if (incoming) onPendingCountChange?.(incoming.filter((r) => r.status === "pending").length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  async function respond(id: string, approve: boolean): Promise<boolean> {
    setActingOnId(id);
    try {
      const res = await fetch(`${API}/bat246/snapbackloans/requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond to request");
      toast.success(approve ? "Loan approved — coins sent." : "Loan request denied.");
      loadIncoming();
      onChanged?.();
      return true;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      return false;
    } finally {
      setActingOnId(null);
    }
  }

  async function confirmApprove() {
    if (!confirming) return;
    const ok = await respond(confirming.id, true);
    if (ok) setConfirming(null);
  }

  async function cancelSent(id: string) {
    setActingOnId(id);
    try {
      const res = await fetch(`${API}/bat246/snapbackloans/requests/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request");
      toast.success("Request cancelled.");
      loadSent();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setActingOnId(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 sm:p-7 space-y-7">
        <div>
          <div className="text-white/70 text-base sm:text-lg font-semibold uppercase tracking-wide mb-3">Waiting on you</div>
          {!incoming && !incomingError && <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>}
          {incomingError && <div className="text-red-400 text-lg py-3 text-center">Failed to load. <button onClick={loadIncoming} className="underline font-semibold">Try again</button></div>}
          {/* Only genuinely pending asks — an already-approved/denied one
              isn't "waiting" on anything anymore, and an approved one's
              loan already shows up in the All Loans grid, so repeating it
              here would just be stale clutter. */}
          {incoming && incoming.filter((r) => r.status === "pending").length === 0 && !incomingError && (
            <div className="text-white/35 text-lg py-3">No Snap Back Loan requests waiting on you right now.</div>
          )}
          {incoming && incoming.filter((r) => r.status === "pending").length > 0 && (
            <div className="space-y-3">
              {incoming.filter((r) => r.status === "pending").map((r) => (
                <div key={r.id} className="bg-orange-500/[0.04] border border-orange-500/15 rounded-xl px-4 sm:px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-white text-lg sm:text-xl font-semibold">
                        {r.isReferral
                          ? <>{r.requestedByName} is asking you to fund a ${r.amount.toLocaleString()} Snap Back Loan ({PRODUCT_LABELS[r.productLabel]}) for {r.borrowerName}</>
                          : <>{r.borrowerName} is requesting a ${r.amount.toLocaleString()} Snap Back Loan ({PRODUCT_LABELS[r.productLabel]})</>}
                      </div>
                      <div className="text-white/40 text-base sm:text-lg mt-0.5">
                        {r.isReferral
                          ? <>For {r.borrowerName} ({r.borrowerEmail}) · Asked by {r.requestedByName} · {fmtWhen(r.createdAt)}</>
                          : <>{r.borrowerEmail} · {fmtWhen(r.createdAt)}</>}
                      </div>
                      {r.note && <div className="text-white/40 text-base sm:text-lg italic mt-1">&ldquo;{r.note}&rdquo;</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setConfirming(r)}
                        disabled={actingOnId === r.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black text-base sm:text-lg font-bold transition-colors"
                      >
                        {actingOnId === r.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Approve
                      </button>
                      <button
                        onClick={() => respond(r.id, false)}
                        disabled={actingOnId === r.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-base sm:text-lg font-semibold transition-colors"
                      >
                        <XIcon className="w-5 h-5" /> Deny
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-white/70 text-base sm:text-lg font-semibold uppercase tracking-wide mb-3">Sent by you</div>
          {!sent && !sentError && <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>}
          {sentError && <div className="text-red-400 text-lg py-3 text-center">Failed to load. <button onClick={loadSent} className="underline font-semibold">Try again</button></div>}
          {sent && sent.length === 0 && <div className="text-white/35 text-lg py-3">You haven&apos;t requested a Snap Back Loan yet.</div>}
          {sent && sent.length > 0 && (
            <div className="space-y-3">
              {sent.map((r) => (
                <div key={r.id} className="bg-orange-500/[0.04] border border-orange-500/15 rounded-xl px-4 sm:px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-white text-lg sm:text-xl font-semibold">
                        ${r.amount.toLocaleString()} Snap Back Loan ({PRODUCT_LABELS[r.productLabel]}){r.isReferral ? <> for {r.borrowerName}</> : null}
                      </div>
                      <div className="text-white/40 text-base sm:text-lg mt-0.5">Asked {r.eligibleName} · {fmtWhen(r.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-base sm:text-lg font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLES[r.status].className}`}>
                        {STATUS_STYLES[r.status].label}
                      </span>
                      {r.status === "pending" && (
                        <button
                          onClick={() => cancelSent(r.id)}
                          disabled={actingOnId === r.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white/70 text-base sm:text-lg font-semibold transition-colors"
                        >
                          {actingOnId === r.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />} Cancel
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

      {confirming && (
        <ConfirmApproveModal
          request={confirming}
          submitting={actingOnId === confirming.id}
          onCancel={() => setConfirming(null)}
          onConfirm={confirmApprove}
        />
      )}
    </>
  );
}

/**
 * Read-only history of every Snap Back Loan request this admin has ever
 * been asked to answer — every status, not just pending (that's what
 * "Loan Requests" already covers). An approved one already has its own
 * row in the "All Loans" grid; this is the request-level record (who
 * asked, when, any note) for the full audit trail, including denied/
 * insufficient/cancelled ones that never became a loan at all.
 */
function TransactionsHistory() {
  const [incoming, setIncoming] = useState<SblRequest[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setIncoming(null);
    setError(false);
    fetch(`${API}/bat246/snapbackloans/requests-for-me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setIncoming(d.requests ?? []))
      .catch(() => setError(true));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 sm:p-7">
      <div className="text-white/70 text-base sm:text-lg font-semibold uppercase tracking-wide mb-3">Every request you've been asked to answer</div>
      {!incoming && !error && <div className="flex items-center justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-white/30" /></div>}
      {error && <div className="text-red-400 text-lg py-6 text-center">Failed to load. <button onClick={load} className="underline font-semibold">Try again</button></div>}
      {incoming && incoming.length === 0 && <div className="text-white/35 text-lg py-6 text-center">No Snap Back Loan requests yet.</div>}
      {incoming && incoming.length > 0 && (
        <div className="space-y-3">
          {incoming.map((r) => (
            <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 sm:px-5 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-white text-lg sm:text-xl font-semibold">
                    {r.isReferral
                      ? <>{r.requestedByName} requested ${r.amount.toLocaleString()} for {r.borrowerName} ({PRODUCT_LABELS[r.productLabel]})</>
                      : <>{r.borrowerName} requested ${r.amount.toLocaleString()} ({PRODUCT_LABELS[r.productLabel]})</>}
                  </div>
                  <div className="text-white/40 text-base sm:text-lg mt-0.5">{r.borrowerEmail} · {fmtWhen(r.createdAt)}</div>
                  {r.note && <div className="text-white/40 text-base sm:text-lg italic mt-1">&ldquo;{r.note}&rdquo;</div>}
                </div>
                <span className={`text-base sm:text-lg font-semibold px-3 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_STYLES[r.status].className}`}>
                  {STATUS_STYLES[r.status].label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full w-full bg-[#09090f] text-white">
      <div className="px-4 sm:px-8 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto">
        <div className="mb-5">
          <Link
            href="/games/bat246"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-base sm:text-lg font-semibold transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Admin view — every loan across the whole office, plus its own
//     Loan Requests (admin/Alan is usually who gets asked to approve) ───

function AdminSnapBackLoansView() {
  const [tab, setTab] = useState<"grid" | "requests" | "transactions">("grid");
  const [loans, setLoans] = useState<LoanRow[] | null>(null);
  const [error, setError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  function load() {
    setLoans(null);
    setError(false);
    fetch(`${API}/bat246/snapbackloans/admin/list`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setLoans(d.loans ?? []))
      .catch(() => setError(true));
  }

  useEffect(() => { load(); }, []);

  const outstandingTotal = (loans ?? []).reduce((sum, l) => sum + l.outstandingBalance, 0);
  const activeCount = (loans ?? []).filter((l) => l.status === "active").length;

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3">
        <Landmark className="w-8 h-8 text-orange-400" />
        <div>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Snap Back Loans</h1>
          <p className="text-white/50 text-lg sm:text-xl mt-1.5">
            Who's borrowed B2 Coins against future earnings, and what's still owed.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {([
          ["grid", "All Loans"],
          ["requests", "Loan Requests"],
          ["transactions", "Transactions"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 rounded-lg text-base sm:text-lg font-semibold transition-colors border ${tab === key ? "bg-orange-500 border-orange-400 text-black" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"}`}
          >
            {label}
            {key === "requests" && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-red-400 align-middle" aria-label="Requests waiting on you" />
            )}
          </button>
        ))}
      </div>

      {tab === "grid" ? (
        <>
          {loans && loans.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="text-white/40 text-sm sm:text-base font-semibold uppercase tracking-wide">Total Loans</div>
                <div className="text-white text-3xl font-black mt-1">{loans.length}</div>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:p-5">
                <div className="text-amber-300/70 text-sm sm:text-base font-semibold uppercase tracking-wide">Active</div>
                <div className="text-amber-300 text-3xl font-black mt-1">{activeCount}</div>
              </div>
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-4 sm:p-5 col-span-2 sm:col-span-1">
                <div className="text-orange-300/70 text-sm sm:text-base font-semibold uppercase tracking-wide">Outstanding</div>
                <div className="text-orange-300 text-3xl font-black mt-1">{fmt(outstandingTotal)}</div>
              </div>
            </div>
          )}
          <LoansGrid loans={loans} error={error} onRetry={load} emptyMessage="No Snap Back Loans yet." />
        </>
      ) : tab === "requests" ? (
        <LoanRequestsPanel onPendingCountChange={setPendingCount} onChanged={load} />
      ) : (
        <TransactionsHistory />
      )}
    </PageShell>
  );
}

// ─── Member view — my own loan, giving power, and requests ─────────────

interface Pool { pool: string; cap: number; alreadyGiven: number; remaining: number; detail: string; }
interface Eligibility { eligible: boolean; isAlanK: boolean; totalRemaining: number; pools: Pool[]; }
interface DistributorProgress { invitedProductId: string | null; steps: { hasPurchasedProduct: boolean } }

function MemberSnapBackLoansView() {
  const [tab, setTab] = useState<"givingPower" | "requests" | "activity">("activity");
  const [progress, setProgress] = useState<DistributorProgress | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityError, setEligibilityError] = useState(false);
  const [activity, setActivity] = useState<LoanRow[] | null>(null);
  const [activityError, setActivityError] = useState(false);
  // Specifically "do I, as the BORROWER, currently have an active loan" —
  // NOT derivable from `activity` above, which also includes loans I've
  // personally funded as the giver. Needs its own /my-loan check.
  const [myActiveLoan, setMyActiveLoan] = useState(false);
  const [myLoanChecked, setMyLoanChecked] = useState(false);
  const [myPendingRequest, setMyPendingRequest] = useState<SblRequest | null>(null);
  const [myPendingRequestChecked, setMyPendingRequestChecked] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // "self" — the My Loan tab's own request; "friend" — the Giving Power
  // tab's referral shortcut (borrowing isn't gated on the CALLER's own
  // loan/purchase state in that case, since the coins aren't for them).
  const [modalMode, setModalMode] = useState<"self" | "friend" | null>(null);

  function loadMyLoan() {
    fetch(`${API}/bat246/snapbackloans/my-loan`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setMyActiveLoan(d.loan?.status === "active"))
      .catch(() => {})
      .finally(() => setMyLoanChecked(true));
  }
  function loadEligibility() {
    setEligibility(null);
    setEligibilityError(false);
    fetch(`${API}/bat246/layaway/my-eligibility`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setEligibility(d.eligibility ?? null))
      .catch(() => setEligibilityError(true));
  }
  function loadActivity() {
    setActivity(null);
    setActivityError(false);
    fetch(`${API}/bat246/snapbackloans/my-activity`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setActivity(d.loans ?? []))
      .catch(() => setActivityError(true));
  }
  function loadMyPendingRequest() {
    fetch(`${API}/bat246/snapbackloans/my-requests`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setMyPendingRequest((d.requests ?? []).find((r: SblRequest) => r.status === "pending") ?? null))
      .catch(() => {})
      .finally(() => setMyPendingRequestChecked(true));
  }

  useEffect(() => {
    loadMyLoan();
    loadEligibility();
    loadActivity();
    loadMyPendingRequest();
    fetch(`${API}/bat246/distributor/progress`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setProgress(d))
      .catch(() => {});
  }, []);

  const isPodInvite = progress?.invitedProductId === POD_ENTRY_PRODUCT_ID;
  const priceLabel = isPodInvite ? "$160" : "$650";
  const alreadyPurchased = !!progress?.steps.hasPurchasedProduct;

  // Shared by both the "My Loan" tab's Request button and the "Giving
  // Power" tab's "can't lend? borrow instead" shortcut below — same
  // button, same blocked-state rules, just reachable from two places.
  const checksReady = myPendingRequestChecked && myLoanChecked;
  const blockedReason = !checksReady
    ? null
    : myActiveLoan
      ? "You already have an outstanding Snap Back Loan — repay it before requesting another."
      : alreadyPurchased
        ? "You've already completed your BAT 246 entry purchase — there's nothing to borrow for."
        : myPendingRequest
          ? `Your Snap Back Loan request is waiting on ${myPendingRequest.eligibleName ?? "an eligible member"} to approve it.`
          : null;

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3">
        <Landmark className="w-8 h-8 text-orange-400" />
        <div>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Snap Back Loans</h1>
          <p className="text-white/50 text-lg sm:text-xl mt-1.5">
            Borrow B2 Coins for your entry, see what you can lend, and track every request.
          </p>
        </div>
      </div>

      {/* ── Tabs — one section visible at a time ────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([
          ["activity", "My Loan"],
          ["givingPower", "Giving Power"],
          ["requests", "Loan Requests"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 rounded-lg text-base sm:text-lg font-semibold transition-colors border ${tab === key ? "bg-orange-500 border-orange-400 text-black" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"}`}
          >
            {label}
            {key === "requests" && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-red-400 align-middle" aria-label="Requests waiting on you" />
            )}
          </button>
        ))}
      </div>

      {/* ── My Giving Power ──────────────────────────────────────────── */}
      {tab === "givingPower" && (
        <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl border border-emerald-400/30 bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="text-white font-bold text-xl sm:text-2xl">Your Ability to Give a Snap Back Loan</div>
          </div>
          {eligibility ? (
            eligibility.isAlanK ? (
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                <span className="text-3xl font-black text-yellow-300">Unlimited</span>
              </div>
            ) : eligibility.eligible ? (
              <>
                <div className="text-3xl font-black text-emerald-300 mb-3">
                  ${eligibility.totalRemaining.toLocaleString()} <span className="text-lg sm:text-xl text-white/40 font-semibold">you could lend right now</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {eligibility.pools.map((p) => (
                    <span key={p.pool} className="text-sm sm:text-base px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/55" title={p.detail}>
                      {p.detail} — ${p.remaining.toLocaleString()} left
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div>
                <p className="text-white/45 text-lg sm:text-xl">
                  You're not currently eligible to fund a Snap Back Loan for someone else — you'd need to be seated at Home Plate,
                  hold a Leaderboard trophy, qualify for the Matching Bonus, or be #1 in the Lostmoney lineup.
                </p>
                {/* Can't lend yourself? You can still connect a friend or
                    contact who needs one with someone who CAN lend — this
                    is a referral, not a self-request, so it's never gated
                    on the caller's own loan/purchase state (that only
                    matters for the "My Loan" tab's button above). */}
                <div className="mt-5 pt-5 border-t border-white/10">
                  <p className="text-white/60 text-base sm:text-lg mb-3">
                    Know someone who needs one? You can ask an eligible lender to fund a Snap Back Loan for a friend or contact.
                  </p>
                  <button
                    onClick={() => setModalMode("friend")}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-black text-base sm:text-lg font-bold transition-colors"
                  >
                    <Landmark className="w-5 h-5" />
                    Request Snap Back Loan for Someone Else
                  </button>
                </div>
              </div>
            )
          ) : eligibilityError ? (
            <div className="text-red-400 text-lg">Failed to load. <button onClick={loadEligibility} className="underline font-semibold">Try again</button></div>
          ) : (
            <Loader2 className="w-7 h-7 animate-spin text-white/30" />
          )}
        </div>
      )}

      {/* ── Loan Requests — approve/deny + track what I've sent ─────── */}
      {tab === "requests" && (
        <LoanRequestsPanel
          onPendingCountChange={setPendingCount}
          onChanged={() => { loadEligibility(); loadActivity(); loadMyPendingRequest(); loadMyLoan(); }}
        />
      )}

      {/* ── My Loan — request one + the same grid shape as the admin view,
            scoped to loans I'm personally part of. The Request button is
            always shown (never swapped out); if requesting isn't actually
            allowed right now, a validation message renders under it and
            the button is disabled — same as any other blocked-until-fixed
            form control, rather than the button disappearing entirely. ── */}
      {tab === "activity" && (
        <>
          <div className="rounded-2xl border-2 border-orange-500/25 bg-orange-500/[0.05] p-4 sm:p-6 mb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-white/70 text-base sm:text-lg">
                Don&apos;t have enough B2 Coins to purchase your {priceLabel} entry? Borrow them as a Snap Back Loan.
              </p>
              <button
                onClick={() => setModalMode("self")}
                disabled={!!blockedReason || !checksReady}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-base sm:text-lg font-bold transition-colors flex-shrink-0"
              >
                <Landmark className="w-5 h-5" />
                Request Snap Back Loan
              </button>
            </div>
            {blockedReason && (
              <div className="flex items-start gap-2 mt-3 pt-3 border-t border-orange-500/15">
                <Clock className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300/90 text-base sm:text-lg">{blockedReason}</p>
              </div>
            )}
          </div>
          <LoansGrid loans={activity} error={activityError} onRetry={loadActivity} emptyMessage="No Snap Back Loan activity yet." />
        </>
      )}

      {/* No productId/priceLabel passed — unlike the boards/page.tsx and
          "Pay With B2 Coins" entry points (which already know exactly
          which product the person is trying to buy), this tab has no
          such context, so the modal always opens on its own product-pick
          step and lets the person choose Board $650 or POD $160
          themselves. `forFriend` (Giving Power tab's referral shortcut)
          additionally opens on a "who's this for" step first. */}
      {modalMode && (
        <SnapBackLoanModal
          forFriend={modalMode === "friend"}
          onClose={() => setModalMode(null)}
          onRequested={() => { loadActivity(); loadMyPendingRequest(); loadMyLoan(); }}
        />
      )}
    </PageShell>
  );
}

// ─── Top-level — one tab, role-aware content ────────────────────────────

export default function SnapBackLoansPage() {
  const { isAdmin, loading } = useBat246CardAccess("snapbackloans");

  if (loading) return null;
  return isAdmin ? <AdminSnapBackLoansView /> : <MemberSnapBackLoansView />;
}
