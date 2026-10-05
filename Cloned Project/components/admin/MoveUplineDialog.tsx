"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  ArrowRight,
  Check,
  AlertTriangle,
  Users,
  GitBranch,
  Coins,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  listUsers,
  moveUpline,
  type AdminUserListItem,
  type AdminUplineRef,
} from "@/lib/admin-api/users";

/** Small avatar — image if present, otherwise an initial chip. */
function Avatar({
  name,
  email,
  src,
  size = 40,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: number;
}) {
  const initial = (name || email || "?").charAt(0).toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ height: size, width: size }}
        className="rounded-xl object-cover shrink-0 ring-1 ring-[#2a2a35]"
      />
    );
  }
  return (
    <div
      style={{ height: size, width: size }}
      className="rounded-xl bg-gradient-to-br from-[#FBD10D]/15 to-[#FBD10D]/[0.02] border border-[#FBD10D]/15 flex items-center justify-center shrink-0 font-black text-[#FBD10D]"
    >
      {initial}
    </div>
  );
}

/** Compact person chip used in the current → new preview row. */
function PersonChip({
  label,
  name,
  email,
  src,
  tone,
}: {
  label: string;
  name?: string | null;
  email?: string | null;
  src?: string | null;
  tone: "muted" | "accent";
}) {
  return (
    <div
      className={`flex-1 min-w-0 rounded-xl border p-3 ${
        tone === "accent"
          ? "border-[#FBD10D]/25 bg-[#FBD10D]/[0.04]"
          : "border-[#2a2a35] bg-[#0d0d11]"
      }`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#5a5a72] mb-2">
        {label}
      </p>
      {name || email ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={name} email={email} src={src} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {name || "Unnamed"}
            </p>
            <p className="text-[11px] text-[#5a5a72] truncate">{email}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#5a5a72] italic py-1.5">No upline — root</p>
      )}
    </div>
  );
}

export function MoveUplineDialog({
  memberId,
  memberName,
  memberEmail,
  currentUpline,
  directReferrals,
  open,
  onOpenChange,
  onDone,
}: {
  memberId: string;
  memberName?: string | null;
  memberEmail?: string | null;
  currentUpline: AdminUplineRef | null;
  directReferrals: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<AdminUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminUserListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Off by default: a move must not touch the historical ledger unless the
  // admin explicitly opts in. Reset on every open so it can never carry over
  // from a previous member.
  const [moveCommissions, setMoveCommissions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset everything whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setSearch("");
      setDebounced("");
      setResults([]);
      setSelected(null);
      setSubmitting(false);
      setMoveCommissions(false);
      // Focus the search field once the open animation settles.
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    if (debounced.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    // includeActivated is REQUIRED here. /garage-admin/users defaults to a
    // prospecting view that hides anyone with typeFlags.oneNetworkActivated —
    // i.e. everyone who has paid for the $25 UnilevelPlus sub. That default is
    // right for the users table, but backwards for an upline picker: paying
    // members are the most likely uplines, and omitting this flag made them
    // the only people who could NOT be picked. It read as "user doesn't
    // exist" for someone who had just enrolled and paid.
    // The other admin pickers (CompanyScopeDialog,
    // OneTimeAffiliatesFilterDrawer) already pass it.
    listUsers({ search: debounced, limit: 8, includeActivated: true })
      .then((res) => {
        if (!alive) return;
        // Never allow picking the member as their own upline.
        setResults(res.items.filter((u) => u.id !== memberId));
      })
      .catch(() => {
        if (alive) setResults([]);
      })
      .finally(() => {
        if (alive) setSearching(false);
      });
    return () => {
      alive = false;
    };
  }, [debounced, open, memberId]);

  const alreadyUpline = useMemo(
    () => !!selected && !!currentUpline && selected.id === currentUpline.id,
    [selected, currentUpline]
  );

  async function handleConfirm() {
    if (!selected || submitting || alreadyUpline) return;
    setSubmitting(true);
    try {
      const res = await moveUpline(memberId, selected.id, { moveCommissions });
      const who = res.newUpline.name || res.newUpline.email;
      const movedNote =
        res.directReferralsMoved > 0
          ? `${res.directReferralsMoved} direct downline member${
              res.directReferralsMoved === 1 ? "" : "s"
            } moved along with them.`
          : "Future commissions now route to the new upline.";

      // The move can succeed while the sweep declines or fails — the endpoint
      // reports them separately, so don't imply money moved when it didn't.
      const cm = res.commissionMove;
      if (!moveCommissions || !cm) {
        toast.success(`Moved under ${who}`, { description: movedNote });
      } else if (cm.status === "applied") {
        const total = cm.reversalTotal?.toFixed(2) ?? "0.00";
        toast.success(`Moved under ${who} — commissions re-pointed`, {
          description: `$${total} reversed and re-distributed down the new chain${
            cm.balanced === false ? ". Totals did not reconcile — please review." : "."
          }`,
        });
      } else if (cm.status === "skipped") {
        toast.success(`Moved under ${who}`, {
          description: `Commissions unchanged: ${cm.reason ?? "nothing to move"}.`,
        });
      } else {
        // blocked | failed — the move stands, the sweep did not happen.
        toast.warning(`Moved under ${who}, but commissions did NOT move`, {
          description: cm.reason ?? "The commission sweep could not complete.",
        });
      }
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to move upline");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // grid-cols-[minmax(0,1fr)]: DialogContent is a grid whose implicit
        // column sizes to min-content, so a long nowrap email (selected chip,
        // result row) widened the column past the dialog and got clipped
        // instead of truncated.
        className="bg-[#0b0b0f] border-[#2a2a35] text-white rounded-2xl p-0 overflow-hidden gap-0 grid-cols-[minmax(0,1fr)] sm:max-w-lg"
      >
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-[#2a2a35] text-left space-y-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#FBD10D]/15 to-[#FBD10D]/[0.02] border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
              <GitBranch className="h-5 w-5 text-[#FBD10D]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-black text-white leading-tight">
                Move upline
              </DialogTitle>
              <p className="text-xs text-[#9fa0b8] mt-0.5 truncate">
                {memberName || memberEmail}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="ml-auto h-7 w-7 rounded-lg flex items-center justify-center text-[#5a5a72] hover:text-white hover:bg-[#1a1a22] transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Current → new preview */}
          <div className="flex items-stretch gap-2">
            <PersonChip
              label="Current upline"
              name={currentUpline?.name}
              email={currentUpline?.email}
              src={currentUpline?.profilePicture}
              tone="muted"
            />
            <div className="flex items-center shrink-0">
              <div className="h-7 w-7 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-[#FBD10D]" />
              </div>
            </div>
            <PersonChip
              label="New upline"
              name={selected?.name}
              email={selected?.email}
              src={selected?.profilePicture}
              tone="accent"
            />
          </div>

          {/* Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a5a72] pointer-events-none" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a new upline by name or email…"
                className="w-full pl-10 pr-9 h-11 rounded-xl bg-[#0d0d11] border border-[#2a2a35] text-sm text-white placeholder:text-[#5a5a72] outline-none transition-shadow focus:ring-2 focus:ring-[#FBD10D]/20 focus:border-[#FBD10D]/40"
              />
              {searching ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a5a72] animate-spin" />
              ) : search ? (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-[#5a5a72] hover:text-white hover:bg-[#1a1a22] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Results */}
            <div className="mt-2 max-h-[220px] overflow-y-auto rounded-xl">
              {debounced.length >= 2 &&
              !searching &&
              results.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Users className="h-5 w-5 text-[#5a5a72]" />
                  <p className="text-xs text-[#5a5a72]">
                    No users match “{debounced}”
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {results.map((u) => {
                    const isSel = selected?.id === u.id;
                    const isCurrent = currentUpline?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelected(u)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                          isSel
                            ? "border-[#FBD10D]/40 bg-[#FBD10D]/[0.06]"
                            : "border-[#2a2a35] bg-[#0d0d11] hover:border-[#363649] hover:bg-[#111116]"
                        }`}
                      >
                        <Avatar
                          name={u.name}
                          email={u.email}
                          src={u.profilePicture}
                          size={34}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {u.name || "Unnamed"}
                            {isCurrent && (
                              <span className="ml-1.5 text-[10px] font-bold text-[#5a5a72]">
                                · current
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[#5a5a72] truncate">
                            {u.email}
                            {u.affiliateId ? ` · ${u.affiliateId}` : ""}
                          </p>
                        </div>
                        {isSel && (
                          <div className="h-5 w-5 rounded-full bg-[#FBD10D] flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-black" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Move already-paid commissions too — off by default */}
          <button
            type="button"
            role="switch"
            aria-checked={moveCommissions}
            onClick={() => setMoveCommissions((v) => !v)}
            className={`w-full text-left flex gap-3 rounded-xl border p-3 transition-colors ${
              moveCommissions
                ? "border-[#FBD10D]/40 bg-[#FBD10D]/[0.06]"
                : "border-[#2a2a35] bg-[#101016] hover:border-[#3a3a48]"
            }`}
          >
            <span
              className={`mt-0.5 h-5 w-9 rounded-full shrink-0 relative transition-colors ${
                moveCommissions ? "bg-[#FBD10D]" : "bg-[#2f2f3d]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  moveCommissions ? "left-[1.125rem]" : "left-0.5"
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Coins className="h-3.5 w-3.5 text-[#FBD10D]" />
                Also move already-paid commissions
              </span>
              <span className="block text-[11px] leading-relaxed text-[#9fa0b8] mt-1">
                {moveCommissions
                  ? "The original payout will be reversed and re-distributed down the new upline's chain. This moves real money between wallets and cannot be undone from here."
                  : "Off — the past ledger stays exactly as it is. Only future sales route to the new upline."}
              </span>
            </span>
          </button>

          {/* Commission-semantics note */}
          <div
            className={`flex gap-2.5 rounded-xl border p-3 ${
              moveCommissions
                ? "border-red-500/25 bg-red-500/[0.06]"
                : "border-amber-500/20 bg-amber-500/[0.05]"
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 shrink-0 mt-0.5 ${
                moveCommissions ? "text-red-400" : "text-amber-400"
              }`}
            />
            <p
              className={`text-[11px] leading-relaxed ${
                moveCommissions ? "text-red-200/90" : "text-amber-200/90"
              }`}
            >
              {moveCommissions ? (
                <>
                  This will claw back every payout from this member&apos;s $25
                  purchase and pay it down the new chain instead. The old upline
                  loses what they earned, and people who were never paid on this
                  sale will be. Platform revenue usually drops, because budget
                  that went unallocated now finds recipients.
                </>
              ) : (
                <>
                  Already-paid commissions stay put — the ledger is historical.
                  Moving the upline only changes who earns on this member&apos;s{" "}
                  <span className="font-semibold">future</span> sales.
                </>
              )}
              {directReferrals > 0 && (
                <>
                  {" "}
                  Their {directReferrals} direct downline member
                  {directReferrals === 1 ? "" : "s"} move with them.
                </>
              )}
            </p>
          </div>

          {alreadyUpline && (
            <p className="text-[11px] text-[#e0684f] font-medium -mt-1">
              That user is already this member&apos;s upline.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a35] bg-[#0a0a0e]">
          <button
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || submitting || alreadyUpline}
            className="h-10 px-4 rounded-xl text-sm font-bold bg-[#FBD10D] text-black hover:bg-[#ffdb35] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Moving…
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4" /> Confirm move
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
