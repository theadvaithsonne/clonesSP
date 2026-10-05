"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, X, Trash2, ArrowLeft, ArrowRight, Search, UserPlus, Mail, PauseCircle, PlayCircle, Pencil, Check, Clock, ArrowRightCircle, ArrowLeftCircle } from "lucide-react";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
// Same Bat246 org used across the backend — the "Invite to Bat246" button
// sends its invite into this org via the existing /invites/create endpoint.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

interface PaidEntry {
  _id: string;
  name: string;
  email?: string;
  userId?: string | null;
  reportedLoss?: string;
  approvedAmount: number;
  totalPaid: number;
  lastPaymentAmount?: number;
  lastPaymentAt: string | null;
  createdAt: string;
  // Absent (undefined) = legacy row, already active. null = new row, parked
  // in the 90-day waiting grid. A real timestamp = moved into the lineup.
  movedToLineupAt?: string | null;
  // Waiting-grid rows only — computed server-side, freezes while Stop All
  // Payments is on (paused time doesn't count toward the 90 days).
  eligibleOn?: string;
  eligibleNow?: boolean;
  // Both grids — true when the linked account is already a Bat246 office
  // member, so the Invite button is replaced with a static badge instead.
  alreadyBat246Member?: boolean;
}

type LineupView = "active" | "waiting";

interface PaidStats {
  totalMembers: number;
  totalRepaid: number;
}

interface PersonResult {
  _id: string;
  name: string;
  email: string;
}

const PAID_PAGE_SIZE = 10;

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
  return { Authorization: `Bearer ${token}` };
}

export default function LostMoneyPaidListPage() {
  const { isAdmin, loading: authLoading } = useBat246CardAccess("lostmoney");

  const [paidEntries, setPaidEntries] = useState<PaidEntry[] | null>(null);
  const [paidPage, setPaidPage] = useState(1);
  const [paidTotalPages, setPaidTotalPages] = useState(1);
  const [paidStats, setPaidStats] = useState<PaidStats | null>(null);
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [addReportedLoss, setAddReportedLoss] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // Which of the two grids is showing — "No Wait Lineup" (people eligible
  // for the auto-pay drip) or "90 Days Waiting Period" (newly-approved
  // people not eligible yet, until an admin moves them in).
  const [lineupView, setLineupView] = useState<LineupView>("active");
  const [movingToLineupId, setMovingToLineupId] = useState<string | null>(null);
  const [movingToWaitingId, setMovingToWaitingId] = useState<string | null>(null);

  // Inline edit of an existing row's approved amount.
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState("");
  const [editingAmountSaving, setEditingAmountSaving] = useState(false);

  // Inline edit of an existing row's name.
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [editingNameSaving, setEditingNameSaving] = useState(false);

  // Payment distribution on/off switch — gates the automatic 3%-of-sale
  // drip on the backend (bat246LostMoneyAutoPay.service.ts).
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [paymentsUpdatedByEmail, setPaymentsUpdatedByEmail] = useState("");
  const [paymentsToggling, setPaymentsToggling] = useState(false);

  async function refreshPaymentsStatus() {
    try {
      const res = await fetch(`${API}/bat246/lostmoney/payments/status`, { headers: authHeaders() });
      const d = await res.json();
      setPaymentsEnabled(d.paymentsEnabled ?? true);
      setPaymentsUpdatedByEmail(d.updatedByEmail ?? "");
    } catch {
      setPaymentsEnabled(true);
    }
  }

  async function togglePayments() {
    if (paymentsEnabled === null) return;
    const nextEnabled = !paymentsEnabled;
    const verb = nextEnabled ? "start" : "stop";
    if (!confirm(`Are you sure you want to ${verb} all payments?`)) return;
    setPaymentsToggling(true);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/payments/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error();
      setPaymentsEnabled(d.paymentsEnabled ?? nextEnabled);
      setPaymentsUpdatedByEmail(d.updatedByEmail ?? "");
      toast.success(nextEnabled ? "All payments started" : "All payments stopped");
    } catch {
      toast.error("Failed to update payment status");
    } finally {
      setPaymentsToggling(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    refreshPaymentsStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Loads one page of the current grid + dynamic stats (computed
  // server-side across the whole collection, unaffected by which grid is
  // showing or pagination).
  async function refreshPaidAdmin(page: number, view: LineupView = lineupView): Promise<{ total: number; totalPages: number }> {
    try {
      const res = await fetch(
        `${API}/bat246/lostmoney/paid/admin?page=${page}&limit=${PAID_PAGE_SIZE}&lineup=${view}`,
        { headers: authHeaders() }
      );
      const d = await res.json();
      setPaidEntries(d.paid ?? []);
      setPaidTotalPages(d.totalPages ?? 1);
      setPaidStats(d.stats ?? null);
      return { total: d.total ?? 0, totalPages: d.totalPages ?? 1 };
    } catch {
      setPaidEntries([]);
      return { total: 0, totalPages: 1 };
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    setPaidEntries(null);
    refreshPaidAdmin(paidPage, lineupView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, paidPage, lineupView]);

  function switchLineupView(view: LineupView) {
    if (view === lineupView) return;
    setLineupView(view);
    setPaidPage(1); // the other grid has its own independent page count
  }

  useEffect(() => {
    if (!isAdmin) return;
    const q = personQuery.trim();
    if (!q) {
      setPersonResults([]);
      return;
    }
    setPersonSearching(true);
    const handle = setTimeout(() => {
      fetch(`${API}/bat246/lostmoney/people/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => setPersonResults(d.users ?? []))
        .catch(() => setPersonResults([]))
        .finally(() => setPersonSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, personQuery]);

  function pickPerson(person: PersonResult) {
    setSelectedPerson(person);
    setManualMode(false);
    setPersonQuery("");
    setPersonResults([]);
  }

  // No Garage account found for this search — let the admin add the person
  // by name (and optionally email) directly instead.
  function startManualAdd() {
    setManualMode(true);
    setManualName(personQuery.trim());
    setManualEmail("");
    setPersonQuery("");
    setPersonResults([]);
  }

  function clearPersonSelection() {
    setSelectedPerson(null);
    setManualMode(false);
    setManualName("");
    setManualEmail("");
    setAddReportedLoss("");
    setAddAmount("");
  }

  async function submitManualAdd() {
    const name = manualMode ? manualName.trim() : selectedPerson?.name;
    if (!name) return toast.error("Enter a name");
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount");

    setAddSubmitting(true);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name,
          userId: manualMode ? undefined : selectedPerson?._id,
          email: manualMode ? manualEmail.trim() : selectedPerson?.email,
          reportedLoss: addReportedLoss.trim(),
          amount,
          // New rows land in whichever grid is currently open — so adding
          // someone while looking at No Wait Lineup puts them there
          // directly instead of always parking them in the waiting grid.
          lineup: lineupView,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to add");

      // New rows append to the end of the sequence within the SAME grid
      // they just landed in — jump to that grid's last page so the admin
      // actually sees it. Repeat approvals keep their existing position
      // (and grid), so just refresh the page we're already on.
      if (d.created) {
        const lastPage = Math.max(1, Math.ceil((d.total ?? 1) / PAID_PAGE_SIZE));
        if (lastPage === paidPage) await refreshPaidAdmin(lastPage);
        else setPaidPage(lastPage);
      } else {
        await refreshPaidAdmin(paidPage);
      }

      toast.success(
        d.created
          ? `Added to the ${lineupView === "active" ? "No Wait Lineup" : "90 Days Waiting Period"} grid`
          : `Approved amount updated — ${name} now has $${(d.entry?.approvedAmount ?? 0).toLocaleString()} approved`
      );
      clearPersonSelection();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add to the Paid List");
    } finally {
      setAddSubmitting(false);
    }
  }

  function startEditAmount(entry: PaidEntry) {
    setEditingAmountId(entry._id);
    setEditingAmountValue(String(entry.approvedAmount));
  }

  function cancelEditAmount() {
    setEditingAmountId(null);
    setEditingAmountValue("");
  }

  async function saveEditAmount(id: string) {
    const amount = Number(editingAmountValue);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount");

    setEditingAmountSaving(true);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/${id}/edit-amount`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to update");
      await refreshPaidAdmin(paidPage);
      toast.success("Approved amount updated");
      cancelEditAmount();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update approved amount");
    } finally {
      setEditingAmountSaving(false);
    }
  }

  function startEditName(entry: PaidEntry) {
    setEditingNameId(entry._id);
    setEditingNameValue(entry.name);
  }

  function cancelEditName() {
    setEditingNameId(null);
    setEditingNameValue("");
  }

  async function saveEditName(id: string) {
    const name = editingNameValue.trim();
    if (!name) return toast.error("Enter a name");

    setEditingNameSaving(true);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/${id}/edit-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to update");
      await refreshPaidAdmin(paidPage);
      toast.success("Name updated");
      cancelEditName();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update name");
    } finally {
      setEditingNameSaving(false);
    }
  }

  async function moveToLineup(entry: PaidEntry) {
    if (!confirm(`Move ${entry.name} into the No Wait Lineup? They'll join the back of the payment queue.`)) return;
    setMovingToLineupId(entry._id);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/${entry._id}/move-to-lineup`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to move");
      // They've left this (waiting) grid — refresh the page we're on.
      await refreshPaidAdmin(paidPage, "waiting");
      toast.success(`${entry.name} moved to the No Wait Lineup`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to move to lineup");
    } finally {
      setMovingToLineupId(null);
    }
  }

  async function moveToWaiting(entry: PaidEntry) {
    if (!confirm(`Move ${entry.name} back to the 90 Days Waiting Period? They'll stop receiving auto-pay money until an admin moves them back into the lineup.`)) return;
    setMovingToWaitingId(entry._id);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/${entry._id}/move-to-waiting`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to move");
      // They've left this (active) grid — refresh the page we're on.
      await refreshPaidAdmin(paidPage, "active");
      toast.success(`${entry.name} moved to the 90 Days Waiting Period`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to move to waiting");
    } finally {
      setMovingToWaitingId(null);
    }
  }

  async function deletePaidEntry(id: string) {
    if (!confirm("Remove this entry from the Paid List? This can't be undone.")) return;
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/${id}/delete`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await refreshPaidAdmin(paidPage);
      toast.success("Removed from the Paid List");
    } catch {
      toast.error("Failed to remove entry");
    }
  }

  async function movePaidOrder(index: number, direction: -1 | 1) {
    if (!paidEntries) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= paidEntries.length) return; // page boundary — no cross-page reorder
    const a = paidEntries[index];
    const b = paidEntries[targetIndex];
    const reordered = [...paidEntries];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setPaidEntries(reordered);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/swap-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ idA: a._id, idB: b._id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to reorder");
      setPaidEntries(paidEntries); // revert
    }
  }

  async function inviteToBat246(entry: PaidEntry) {
    let email = entry.email?.trim();
    if (!email) {
      const typed = window.prompt(`No email on file for ${entry.name}. Enter an email to invite:`);
      if (!typed) return;
      email = typed.trim();
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setInvitingId(entry._id);
    try {
      const res = await fetch(`${API}/invites/create?orgId=${BAT246_ORG_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ members: [{ email, name: entry.name, role: "stakeholder" }] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to send invite");
      toast.success(`Invite sent to ${email}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send invite");
    } finally {
      setInvitingId(null);
    }
  }

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-full w-full bg-[#09090f] text-white flex items-center justify-center p-8">
        <p className="text-white/40 text-sm">Admin only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[#09090f] text-white">
      <div className="px-5 sm:px-8 lg:px-12 py-6 max-w-[1400px] mx-auto">
        <div className="mb-5">
          <Link
            href="/games/bat246/lostmoney"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            Lost Money
          </Link>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-white font-black text-3xl sm:text-4xl">Paid List</h1>

          {paymentsEnabled !== null && (
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`text-sm sm:text-base font-bold px-4 py-2 rounded-full ${
                  paymentsEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                }`}
              >
                Payments: {paymentsEnabled ? "Running" : "Paused"}
                {!paymentsEnabled && paymentsUpdatedByEmail ? ` by ${paymentsUpdatedByEmail}` : ""}
              </span>
              <button
                type="button"
                onClick={togglePayments}
                disabled={paymentsToggling}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm sm:text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  paymentsEnabled
                    ? "bg-red-500/15 hover:bg-red-500/25 text-red-400"
                    : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                }`}
              >
                {paymentsToggling ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : paymentsEnabled ? (
                  <PauseCircle className="w-5 h-5" />
                ) : (
                  <PlayCircle className="w-5 h-5" />
                )}
                {paymentsEnabled ? "Stop All Payments" : "Start All Payments"}
              </button>
            </div>
          )}
        </div>

        {/* Grid switcher */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.05] border-2 border-white/10 mb-10">
          <button
            type="button"
            onClick={() => switchLineupView("active")}
            className={`px-5 py-2.5 rounded-lg text-sm sm:text-base font-bold transition-colors ${
              lineupView === "active" ? "bg-brand text-brand-foreground" : "text-white/60 hover:text-white"
            }`}
          >
            No Wait Lineup
          </button>
          <button
            type="button"
            onClick={() => switchLineupView("waiting")}
            className={`px-5 py-2.5 rounded-lg text-sm sm:text-base font-bold transition-colors ${
              lineupView === "waiting" ? "bg-brand text-brand-foreground" : "text-white/60 hover:text-white"
            }`}
          >
            90 Days Waiting Period
          </button>
        </div>

        {/* Stats + Add to Paid List — all 3 in one row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 items-start">
          <div className="rounded-xl bg-white/[0.05] border-2 border-white/10 p-5">
            <div className="text-3xl font-black text-white">{paidStats?.totalMembers ?? 0}</div>
            <div className="text-white/55 text-sm font-semibold uppercase tracking-wide mt-1.5">Total Paid Members</div>
          </div>
          <div className="rounded-xl bg-white/[0.05] border-2 border-white/10 p-5">
            <div className="text-3xl font-black text-emerald-400">
              ${(paidStats?.totalRepaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-white/55 text-sm font-semibold uppercase tracking-wide mt-1.5">Total Money Repaid</div>
          </div>

          {/* Search + add — same box classes as the stat cards so all 3 are
              the same size; the label floats above via absolute
              positioning instead of taking up its own row height. */}
          <div className="relative rounded-xl bg-white/[0.05] border-2 border-white/10 p-5">
            <div className="absolute -top-8 left-0 text-white font-bold text-base flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand" /> Add to Paid List
            </div>

            {!selectedPerson && !manualMode ? (
              <div className="relative">
                <Search className="w-5 h-5 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full h-12 pl-11 pr-3 rounded-lg bg-white/[0.06] border-2 border-white/10 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-brand"
                />
                {personSearching && (
                  <Loader2 className="w-5 h-5 text-white/40 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
                {personQuery.trim() && !personSearching && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg bg-[#15151d] border border-white/10 overflow-hidden max-h-64 overflow-y-auto">
                    {personResults.map((p) => (
                      <button
                        type="button"
                        key={p._id}
                        onClick={() => pickPerson(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="text-white text-base">{p.name}</div>
                        <div className="text-white/50 text-sm">{p.email}</div>
                      </button>
                    ))}
                    {personResults.length === 0 && (
                      <button
                        type="button"
                        onClick={startManualAdd}
                        className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4 text-brand flex-shrink-0" />
                        <span className="text-base">
                          <span className="text-white/55">No Garage account found for </span>
                          <span className="text-white font-semibold">&ldquo;{personQuery.trim()}&rdquo;</span>
                          <span className="text-white/55"> — add as new person</span>
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {manualMode ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55 text-sm font-semibold uppercase tracking-wide">New person</span>
                      <button type="button" onClick={clearPersonSelection} className="text-white/50 hover:text-white flex-shrink-0">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Full name"
                      className="w-full h-12 px-3.5 rounded-lg bg-white/[0.06] border-2 border-white/10 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-brand"
                    />
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="Email (optional)"
                      className="w-full h-12 px-3.5 rounded-lg bg-white/[0.06] border-2 border-white/10 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-brand"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 h-12 px-3.5 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/30">
                    <span className="text-emerald-400 text-base truncate">
                      {selectedPerson!.name} <span className="text-emerald-400/70">· {selectedPerson!.email}</span>
                    </span>
                    <button type="button" onClick={clearPersonSelection} className="text-white/50 hover:text-white flex-shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-white/55 text-sm font-semibold uppercase tracking-wide mb-2">
                      Reported Loss ($) <span className="text-white/30 normal-case">optional, first time only</span>
                    </label>
                    <input
                      type="text"
                      value={addReportedLoss}
                      onChange={(e) => setAddReportedLoss(e.target.value)}
                      className="w-full h-12 px-3.5 rounded-lg bg-white/[0.06] border-2 border-white/10 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-white/55 text-sm font-semibold uppercase tracking-wide mb-2">
                      Approve to Repay ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="w-full h-12 px-3.5 rounded-lg bg-white/[0.06] border-2 border-white/10 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submitManualAdd}
                  disabled={addSubmitting}
                  className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-brand-foreground text-base font-bold hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                  {addSubmitting ? "Adding…" : "Add"}
                </button>
              </div>
            )}
          </div>
        </div>

        {paidEntries === null ? (
          <div className="flex items-center gap-2 text-white/55 text-base py-10">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : paidEntries.length === 0 ? (
          <p className="text-white/55 text-base py-10">
            {lineupView === "waiting" ? "No one in the 90 Days Waiting Period grid." : "No one in the No Wait Lineup yet."}
          </p>
        ) : (
          <>
            <div className="rounded-xl border-2 border-white/10 overflow-hidden overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-white/[0.06] border-b-2 border-white/10">
                    <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5 w-12">Sr.No</th>
                    <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Name</th>
                    <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Date</th>
                    <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Time</th>
                    <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Reported Loss</th>
                    <th className="text-right font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Approved Claim</th>
                    {lineupView === "waiting" ? (
                      <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Eligible On</th>
                    ) : (
                      <>
                        <th className="text-left font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Last Payment</th>
                        <th className="text-right font-bold text-white/60 text-xs uppercase tracking-wide px-4 py-3.5">Total Paid</th>
                      </>
                    )}
                    <th className="px-4 py-3.5 w-10" />
                    <th className="px-4 py-3.5 w-48" />
                  </tr>
                </thead>
                <tbody>
                  {paidEntries.map((p, i) => {
                    const created = new Date(p.createdAt);
                    const isFirstGlobal = paidPage === 1 && i === 0;
                    const isLastGlobal = paidPage === paidTotalPages && i === paidEntries.length - 1;
                    return (
                      <tr key={p._id} className="border-b border-white/10 last:border-0 hover:bg-white/[0.03]">
                        <td className="px-4 py-3.5 text-white/55">{(paidPage - 1) * PAID_PAGE_SIZE + i + 1}</td>
                        <td className="px-4 py-3.5 text-white font-semibold">
                          {editingNameId === p._id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                autoFocus
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditName(p._id);
                                  if (e.key === "Escape") cancelEditName();
                                }}
                                className="w-40 h-9 px-2 rounded-lg bg-white/[0.08] border-2 border-brand/50 text-white text-base focus:outline-none focus:border-brand"
                              />
                              <button
                                onClick={() => saveEditName(p._id)}
                                disabled={editingNameSaving}
                                title="Save"
                                className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                              >
                                {editingNameSaving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={cancelEditName}
                                disabled={editingNameSaving}
                                title="Cancel"
                                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group/name">
                              <div>
                                {p.name}
                                {p.email && <div className="text-white/45 text-sm font-normal">{p.email}</div>}
                              </div>
                              <button
                                onClick={() => startEditName(p)}
                                title="Edit name"
                                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-brand flex items-center justify-center transition-colors flex-shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-white/60">{created.toLocaleDateString()}</td>
                        <td className="px-4 py-3.5 text-white/60">
                          {created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3.5 text-white/60">{p.reportedLoss || "—"}</td>
                        <td className="px-4 py-3.5 text-right text-white font-semibold">
                          {editingAmountId === p._id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                autoFocus
                                value={editingAmountValue}
                                onChange={(e) => setEditingAmountValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditAmount(p._id);
                                  if (e.key === "Escape") cancelEditAmount();
                                }}
                                className="w-28 h-9 px-2 rounded-lg bg-white/[0.08] border-2 border-brand/50 text-white text-base text-right focus:outline-none focus:border-brand"
                              />
                              <button
                                onClick={() => saveEditAmount(p._id)}
                                disabled={editingAmountSaving}
                                title="Save"
                                className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                              >
                                {editingAmountSaving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={cancelEditAmount}
                                disabled={editingAmountSaving}
                                title="Cancel"
                                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 group/amt">
                              ${p.approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <button
                                onClick={() => startEditAmount(p)}
                                title="Edit approved amount"
                                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-brand flex items-center justify-center transition-colors flex-shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        {lineupView === "waiting" ? (
                          <td className="px-4 py-3.5">
                            {p.eligibleNow ? (
                              <span className="text-emerald-400 font-semibold text-sm">Eligible now</span>
                            ) : (
                              <span className="text-white/60 inline-flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-white/40" />
                                {p.eligibleOn ? new Date(p.eligibleOn).toLocaleDateString() : "—"}
                                {paymentsEnabled === false && (
                                  <span className="text-red-400/80 text-xs">(paused — clock frozen)</span>
                                )}
                              </span>
                            )}
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3.5 text-white/60">
                              {p.lastPaymentAt ? new Date(p.lastPaymentAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-4 py-3.5 text-right text-emerald-400 font-bold">
                              ${p.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3.5">
                          {p.alreadyBat246Member ? (
                            <span
                              title="This person already has a BAT 246 office account"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-bold"
                            >
                              <Check className="w-4 h-4" />
                              Already part of BAT 246
                            </span>
                          ) : (
                            <button
                              onClick={() => inviteToBat246(p)}
                              disabled={invitingId === p._id}
                              title="Invite to BAT 246 in Garage"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand/15 hover:bg-brand/25 text-brand text-sm font-bold disabled:opacity-50"
                            >
                              {invitingId === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                              Invite
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {/* Sequence reorder — works the same way in both grids (swaps
                                the "order" field between two rows). Only matters for real
                                queue position in No Wait Lineup; in the waiting grid it's
                                just display order, but admin asked to control it there too. */}
                            <button
                              onClick={() => movePaidOrder(i, -1)}
                              disabled={isFirstGlobal}
                              className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
                              title="Move earlier in sequence"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => movePaidOrder(i, 1)}
                              disabled={isLastGlobal}
                              className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
                              title="Move later in sequence"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            {lineupView === "waiting" ? (
                              <button
                                onClick={() => moveToLineup(p)}
                                disabled={movingToLineupId === p._id}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-sm font-bold disabled:opacity-50 flex-shrink-0"
                                title="Move to No Wait Lineup"
                              >
                                {movingToLineupId === p._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ArrowRightCircle className="w-4 h-4" />
                                )}
                                Move
                              </button>
                            ) : (
                              <button
                                onClick={() => moveToWaiting(p)}
                                disabled={movingToWaitingId === p._id}
                                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-brand flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                                title="Move to 90 Days Waiting Period"
                              >
                                {movingToWaitingId === p._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ArrowLeftCircle className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deletePaidEntry(p._id)}
                              className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center flex-shrink-0"
                              title="Remove from Paid List"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {paidTotalPages > 1 && (
              <div className="flex items-center justify-between mt-5">
                <button
                  onClick={() => setPaidPage((p) => Math.max(1, p - 1))}
                  disabled={paidPage <= 1}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/[0.05] text-white/75 hover:bg-white/[0.1] text-base font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" /> Prev
                </button>
                <span className="text-white/55 text-base font-semibold">
                  Page {paidPage} of {paidTotalPages}
                </span>
                <button
                  onClick={() => setPaidPage((p) => Math.min(paidTotalPages, p + 1))}
                  disabled={paidPage >= paidTotalPages}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/[0.05] text-white/75 hover:bg-white/[0.1] text-base font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
