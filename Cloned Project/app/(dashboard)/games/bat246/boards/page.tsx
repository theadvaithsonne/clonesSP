"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBoards } from "@/components/bat246/hooks/useBoards";
import { BoardSummary } from "@/components/bat246/types";
import { Search, Check, X, Loader2, Users, ChevronLeft, ChevronDown, ChevronRight as ChevronRightIcon, AlertTriangle, Tag, Lock, Star, ShieldCheck, Trophy, Plus, Link2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PlatformCouponInput } from "@/components/ui/platform-coupon-input";
import { Bat246NotificationBell, type PlacementNotification } from "@/components/bat246/Bat246NotificationBell";
import { SnapBackLoanModal } from "@/components/bat246/modals/SnapBackLoanModal";

const BOARDS_PER_PAGE = 6; // 2 rows × 3 cols

// Both spellings accepted: the org's real DB name was recently changed from
// "Bat246" to "BAT 246" (via the admin org-settings page, outside this
// codebase), and this exact-string check would otherwise silently lock out
// every member of the org the moment the name changes again in the future.
const BAT246_ORGS = ["TestCompany XYZ", "Bat246", "BAT 246"];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-orange-700/70 text-orange-200",
  active:    "bg-green-700/70 text-green-200",
  stalled:   "bg-yellow-700/70 text-yellow-200",
  splitting: "bg-blue-700/70 text-blue-200",
  split:     "bg-indigo-600/70 text-indigo-200",
  completed: "bg-neutral-700/70 text-white/50",
};

const WARP_COLOR: Record<number, string> = {
  0: "text-white/30", 1: "text-blue-400",
  2: "text-yellow-400", 3: "text-orange-400", 4: "text-red-400",
};


function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
}

// ─── Distributor Progress Bar ─────────────────────────────────────────────────

interface DistributorProgress {
  isQualified: boolean;
  membershipExpiresAt: string | null;
  qualifiedAt: string | null;
  bat246RefUserId: string | null;
  invitedProductId: string | null;
  steps: {
    isOfficeMember: boolean;
    hasPurchasedProduct: boolean;
    hasBat246Membership: boolean;
  };
  // No longer inside `steps` (it doesn't gate isQualified anymore) — see
  // the matching comment on GET /bat246/distributor/progress.
  isGarageAffiliate: boolean;
  completedCount: number;
  totalCount: number;
}

const POD_ENTRY_PRODUCT_ID = "6a7236f5e76fd9817e7238d9";

const PROGRESS_STEPS_BASE = [
  { key: "isOfficeMember"      as const, label: "BAT 246 Office",    sublabel: "Part of the office",    Icon: ShieldCheck },
  // TEMP: "$25 Garage Affiliate" step hidden on request, same as the
  // Unilevel Plus banner below — uncomment to bring back.
  // { key: "isGarageAffiliate"   as const, label: "$25 Garage Affiliate", sublabel: "Affiliate earnings",   Icon: Plus },
  { key: "hasBat246Membership" as const, label: "BAT 246 Membership", sublabel: "Free 2mo, then $12/mo", Icon: Star },
];

// Step 4 label mirrors whichever entry product this distributor was invited
// for (see the "+ Invite" flow on the Distributors page) — defaults to the
// $650 board entry product when there's no invite/it wasn't the $160 one.
function entryStep(invitedProductId: string | null) {
  const isPodInvite = invitedProductId === POD_ENTRY_PRODUCT_ID;
  return {
    key: "hasPurchasedProduct" as const,
    label: isPodInvite ? "$160 POD Entry" : "$650 Board Entry",
    sublabel: "Entry product",
    Icon: Trophy,
  };
}

function DistributorProgressBar({ progress }: { progress: DistributorProgress | null }) {
  if (!progress) {
    // Loading skeleton
    return (
      <div className="mb-6 bg-white/4 border border-white/8 rounded-xl p-5 animate-pulse">
        <div className="h-3 w-40 bg-white/10 rounded mb-4" />
        <div className="h-2 w-full bg-white/8 rounded-full" />
      </div>
    );
  }

  if (progress.isQualified) {
    const expiry = progress.membershipExpiresAt
      ? new Date(progress.membershipExpiresAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
      : null;
    // expiry is intentionally computed but not rendered — the badge no
    // longer shows a "Valid till" date, per explicit request.
    void expiry;
    return (
      <div className="mb-6 relative overflow-hidden rounded-xl border border-yellow-400/30 bg-gradient-to-r from-yellow-900/30 via-yellow-800/20 to-yellow-900/30 px-6 py-5">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/6 to-transparent -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite]" />
        <div className="relative flex items-center gap-4">
          <Trophy className="w-7 h-7 text-yellow-400 flex-shrink-0" />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-yellow-300 font-bold text-2xl tracking-wide">BAT 246 Distributor</span>
            <span className="bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-sm font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Qualified</span>
          </div>
        </div>
      </div>
    );
  }

  const pct = (progress.completedCount / progress.totalCount) * 100;

  return (
    // Bigger throughout (larger text, bigger step nodes, more padding) —
    // easier to read at a glance, and there's plenty of free vertical
    // space on this page below it anyway.
    <div className="mb-6 bg-white/4 border border-white/10 rounded-xl p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="text-white/80 font-semibold text-lg sm:text-xl tracking-wide">Path to BAT 246 Distributor</div>
          <div className="text-white/70 text-[15.4px] sm:text-[17.6px] mt-1">Complete all steps to become a qualified distributor</div>
        </div>
        <div className="text-right">
          <span className="text-white/60 text-lg font-mono">{progress.completedCount}<span className="text-white/25"> / {progress.totalCount}</span></span>
        </div>
      </div>

      {/* Step nodes — w-14 circles instead of w-8, so the connecting
          line's centering math below scales with them: half of 3.5rem
          (w-14) is 1.75rem, i.e. Tailwind's `7` spacing step (28px). */}
      <div className="relative flex items-start justify-between mb-6">
        {/* connecting line behind nodes */}
        <div className="absolute top-7 left-7 right-7 h-1 bg-white/8" />
        {/* filled portion */}
        <div
          className="absolute top-7 left-7 h-1 bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700"
          style={{ width: `calc(${pct}% - 3.5rem)` }}
        />

        {(() => {
          const steps = [...PROGRESS_STEPS_BASE, entryStep(progress.invitedProductId)];
          // Was a flat 25% assuming exactly 4 steps — computed from the
          // actual count instead so removing/adding a step (like
          // isGarageAffiliate above) keeps the rest evenly spaced instead
          // of leaving a gap where it used to be.
          const stepWidth = `${100 / steps.length}%`;
          return steps.map((step) => {
          const done = progress.steps[step.key];
          const { Icon } = step;
          return (
            <div key={step.key} className="relative flex flex-col items-center gap-3 z-10" style={{ width: stepWidth }}>
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done
                    ? "bg-green-500/20 border-2 border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.35)]"
                    : "bg-white/5 border-2 border-dashed border-white/20"
                }`}
              >
                {done
                  ? <Check className="w-7 h-7 text-green-400" />
                  : <Icon className="w-6 h-6 text-white/25" />
                }
              </div>
              <div className="text-center px-1">
                <div className={`text-[11px] sm:text-sm font-semibold leading-tight ${done ? "text-green-400" : "text-white/40"}`}>
                  {step.label}
                </div>
                <div className="text-xs text-white/20 mt-1 leading-tight hidden sm:block">{step.sublabel}</div>
              </div>
            </div>
          );
          });
        })()}
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}


const LINK_POSITIONS = [
  { key: "thirdBase",   label: "3rd Base",   group: "upper" },
  { key: "secondBaseA", label: "2nd Base A", group: "upper" },
  { key: "secondBaseB", label: "2nd Base B", group: "upper" },
  { key: "1stA",        label: "1st Base A", group: "first" },
  { key: "1stB",        label: "1st Base B", group: "first" },
  { key: "1stC",        label: "1st Base C", group: "first" },
  { key: "1stD",        label: "1st Base D", group: "first" },
  { key: "atBat-0",     label: "AT BAT 1",  group: "atbat" },
  { key: "atBat-1",     label: "AT BAT 2",  group: "atbat" },
  { key: "atBat-2",     label: "AT BAT 3",  group: "atbat" },
  { key: "atBat-3",     label: "AT BAT 4",  group: "atbat" },
  { key: "atBat-4",     label: "AT BAT 5",  group: "atbat" },
  { key: "atBat-5",     label: "AT BAT 6",  group: "atbat" },
  { key: "atBat-6",     label: "AT BAT 7",  group: "atbat" },
  { key: "atBat-7",     label: "AT BAT 8",  group: "atbat" },
];


const POSITION_LABEL_MAP: Record<string, string> = Object.fromEntries(LINK_POSITIONS.map(p => [p.key, p.label]));

const POSITION_SHORT_LABEL_MAP: Record<string, string> = {
  thirdBase: "3B", secondBaseA: "2A", secondBaseB: "2B",
  "1stA": "1A", "1stB": "1B", "1stC": "1C", "1stD": "1D",
  "atBat-0": "B1", "atBat-1": "B2", "atBat-2": "B3", "atBat-3": "B4",
  "atBat-4": "B5", "atBat-5": "B6", "atBat-6": "B7", "atBat-7": "B8",
};

function PositionSummary({ positions }: { positions?: BoardSummary["positions"] }) {
  if (!positions || positions.length === 0) return null;
  const filled   = positions.filter(p => p.status === "filled").length;
  const reserved = positions.filter(p => p.status === "reserved").length;
  const blank    = positions.length - filled - reserved;

  return (
    <div className="mt-3 pt-3 border-t border-white/8">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-white/40">Positions</span>
        <span className="text-white/60 font-semibold">{filled}/{positions.length} filled</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {positions.map(p => {
          const label = POSITION_LABEL_MAP[p.key] ?? p.key;
          let title = label;
          let cls = "bg-white/8";
          if (p.status === "filled") {
            cls = "bg-green-500/60";
            title += " — filled";
          } else if (p.status === "reserved") {
            cls = "bg-yellow-500/50";
            title += p.expiresAt
              ? ` — reserved until ${new Date(p.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : " — reserved";
          } else {
            title += " — open";
          }
          const short = POSITION_SHORT_LABEL_MAP[p.key] ?? p.key;
          const textCls = p.status === "blank" ? "text-white/30" : "text-black/70";
          return (
            <span
              key={p.key}
              title={title}
              className={`flex items-center justify-center w-6 h-5 rounded-sm text-[9px] font-bold ${textCls} ${cls}`}
            >
              {short}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/60 inline-block" />Filled {filled}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/50 inline-block" />Reserved {reserved}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/8 inline-block" />Open {blank}</span>
      </div>
    </div>
  );
}

function PositionLinksPanel({ boardId, trackingNumber }: { boardId: string; trackingNumber: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = (url: string, key: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
      toast.success("Link copied");
    });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      <button
        onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
        className="w-full flex items-center justify-between text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          Position Links
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="mt-2.5 space-y-2" onClick={e => e.preventDefault()}>
          {/* Generic board link */}
          <div className="flex items-center justify-between bg-white/5 rounded-md px-2.5 py-1.5">
            <span className="text-[11px] text-blue-300 font-medium">Board Overview</span>
            <button
              onClick={() => copyLink(`${origin}/games/bat246/${boardId}`, "generic")}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
            >
              {copied === "generic" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied === "generic" ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Upper positions */}
          <div className="text-[9px] uppercase tracking-widest text-white/20 pt-0.5">Upper Base</div>
          <div className="grid grid-cols-3 gap-1">
            {LINK_POSITIONS.filter(p => p.group === "upper").map(p => (
              <button
                key={p.key}
                onClick={() => copyLink(`${origin}/games/bat246/join/${boardId}/${p.key}`, p.key)}
                className="flex items-center justify-between bg-white/5 hover:bg-white/8 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className="text-[10px] text-white/60">{p.label}</span>
                {copied === p.key
                  ? <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                  : <Copy className="w-3 h-3 text-white/25 flex-shrink-0" />}
              </button>
            ))}
          </div>

          {/* 1st Base */}
          <div className="text-[9px] uppercase tracking-widest text-white/20 pt-0.5">1st Base</div>
          <div className="grid grid-cols-4 gap-1">
            {LINK_POSITIONS.filter(p => p.group === "first").map(p => (
              <button
                key={p.key}
                onClick={() => copyLink(`${origin}/games/bat246/join/${boardId}/${p.key}`, p.key)}
                className="flex items-center justify-between bg-white/5 hover:bg-white/8 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className="text-[10px] text-white/60">{p.label.replace("1st Base ", "")}</span>
                {copied === p.key
                  ? <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                  : <Copy className="w-3 h-3 text-white/25 flex-shrink-0" />}
              </button>
            ))}
          </div>

          {/* AT BAT */}
          <div className="text-[9px] uppercase tracking-widest text-white/20 pt-0.5">AT BAT</div>
          <div className="grid grid-cols-4 gap-1">
            {LINK_POSITIONS.filter(p => p.group === "atbat").map(p => (
              <button
                key={p.key}
                onClick={() => copyLink(`${origin}/games/bat246/join/${boardId}/${p.key}`, p.key)}
                className="flex items-center justify-between bg-white/5 hover:bg-white/8 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className="text-[10px] text-white/60">{p.label.replace("AT BAT ", "AB")}</span>
                {copied === p.key
                  ? <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                  : <Copy className="w-3 h-3 text-white/25 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BoardCard({ board, isAdmin }: { board: BoardSummary; isAdmin?: boolean }) {
  const isPostPP = Date.now() > new Date(board.protectionPeriodEnd).getTime();
  const [copied, setCopied] = useState(false);

  const copyPreviewLink = (e: React.MouseEvent) => {
    e.preventDefault();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/games/bat246/preview/${board._id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Preview link copied");
    });
  };

  return (
    <div className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all">
      <Link href={`/games/bat246/${board._id}`} className="block group">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-red-400 font-black text-xl tracking-wide">{board.trackingNumber}</div>
            {board.title && <div className="text-white/50 text-xs mt-0.5">{board.title}</div>}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
            board.status === "active" && isPostPP ? STATUS_COLOR.stalled : STATUS_COLOR[board.status] ?? "bg-white/10 text-white/50"
          }`}>
            {board.status === "active" && isPostPP ? "PP Ended" : board.status}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Minor League</span>
            <span className="text-white/80 font-semibold">${board.minorLeagueAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Warp Level</span>
            <span className={`font-bold ${WARP_COLOR[board.warpCount]}`}>
              {board.warpCount === 0 ? "None" : `WARP-${board.warpCount}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">PP Status</span>
            <span className={isPostPP ? "text-red-400 font-semibold" : "text-green-400 font-semibold"}>
              {isPostPP ? "Ended" : "Active"}
            </span>
          </div>
        </div>

        <PositionSummary positions={board.positions} />

        <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between">
          <span className="text-white/30 text-xs">Board #{board.boardNumber}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={copyPreviewLink}
              className="flex items-center gap-1 text-white/30 hover:text-white/70 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Link2 className="w-3 h-3" />}
              Preview
            </button>
            <span className="text-blue-400 text-xs font-semibold group-hover:text-blue-300 transition-colors">Open →</span>
          </div>
        </div>
      </Link>
      {isAdmin && <PositionLinksPanel boardId={board._id} trackingNumber={board.trackingNumber} />}
    </div>
  );
}

export default function Bat246BoardsPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAmIFounder();
  const { isAdmin: isAlanK } = useBat246CardAccess("boards");
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
  const [mine, setMine] = useState(false);

  useEffect(() => {
    if (authLoading || isAlanK) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setHasDashboardAccess(!!d.hasAccess))
      .catch(() => {});
  }, [authLoading, isAlanK]);
  // Non-admin users always see only their own boards
  const effectiveMine = isAlanK ? mine : true;
  const { boards, completed, loading, error, refetch } = useBoards(effectiveMine);
  const [activatingBoardId, setActivatingBoardId] = useState<string | null>(null);
  const [boardPayouts, setBoardPayouts] = useState<Record<string, number>>({});

  // Membership state (non-admin only)
  const [membershipActive,          setMembershipActive]          = useState<boolean | null>(null);
  const [membershipInvoiceId,       setMembershipInvoiceId]       = useState<string | null>(null);
  const [membershipModalOpen,       setMembershipModalOpen]       = useState(false);
  const [membershipLoading,         setMembershipLoading]         = useState(false);
  const [membershipDiscountedTotal, setMembershipDiscountedTotal] = useState<number | null>(null);
  const [membershipAppliedCoupon,   setMembershipAppliedCoupon]   = useState<string | null>(null);
  // Confirmation popup shown before the free trial actually activates.
  const [freeTrialConfirmOpen,      setFreeTrialConfirmOpen]      = useState(false);

  // Board/POD entry ($650/$160) purchase — a small in-page payment popup,
  // same pattern as the Garage Affiliate ($25) modal below: create the
  // invoice for the ALREADY-authenticated visitor directly (their session
  // email, no OTP), then show PaymentMethodSelector in a small centered
  // card. Never navigates off /games/bat246/boards.
  const [boardEntryModalOpen,     setBoardEntryModalOpen]     = useState(false);
  const [boardEntryInvoiceId,     setBoardEntryInvoiceId]     = useState<string | null>(null);
  const [boardEntryProcessing,    setBoardEntryProcessing]    = useState(false);
  const [boardEntryPriceLabel,    setBoardEntryPriceLabel]    = useState<string>("");
  const [boardEntryDiscountedTotal, setBoardEntryDiscountedTotal] = useState<number | null>(null);
  const [boardEntryAppliedCoupon, setBoardEntryAppliedCoupon] = useState<string | null>(null);

  // Board/POD entry paid with B2 Coins instead of real money — its own
  // small popup (balance vs. required, Pay or "not enough"), separate
  // from the PaymentMethodSelector modal above. Creates its own invoice
  // via the same process-checkout endpoint (no coupon), then settles it
  // through POST /bat246/layaway/pay-entry instead of Razorpay/wallet.
  //
  // Both b2CoinsRequiredAmount and b2CoinsBalance are plain DOLLARS, not
  // cents — process-checkout's response returns product.totalAmount
  // already divided by 100 (unlike the Razorpay-flow invoice totals used
  // above, which PaymentMethodSelector wants in cents), and the B2 Coin
  // wallet balance is stored/returned in the same dollar units as
  // Product.price throughout the backend. No cents conversion anywhere
  // in this block, on purpose.
  const [b2CoinsModalOpen,       setB2CoinsModalOpen]       = useState(false);
  const [b2CoinsInvoiceId,       setB2CoinsInvoiceId]       = useState<string | null>(null);
  const [b2CoinsProductId,       setB2CoinsProductId]       = useState<string | null>(null);
  const [b2CoinsPriceLabel,      setB2CoinsPriceLabel]      = useState<string>("");
  const [b2CoinsRequiredAmount,  setB2CoinsRequiredAmount]  = useState<number>(0);
  const [b2CoinsBalance,         setB2CoinsBalance]         = useState<number | null>(null);
  const [b2CoinsLoadingBalance,  setB2CoinsLoadingBalance]  = useState(false);
  const [b2CoinsBuying,          setB2CoinsBuying]          = useState(false);
  const [b2CoinsProcessing,      setB2CoinsProcessing]      = useState(false);

  // "Request SBL" — a Snap Back Loan, a separate borrow-against-future-
  // earnings path from the Pay-With-B2-Coins flow above. Entirely handled
  // inside SnapBackLoanModal (its own loan/terms/request-an-eligible-
  // person flow) — this page just tracks which product it was opened for.
  const [sblModalOpen,           setSblModalOpen]           = useState(false);
  const [sblProductId,           setSblProductId]           = useState<string | null>(null);
  const [sblPriceLabel,          setSblPriceLabel]          = useState<string>("");

  // Unilevel Plus affiliate state
  const [upHasPurchased,       setUpHasPurchased]       = useState<boolean | null>(null);
  const [upProductPrice,       setUpProductPrice]       = useState<number | null>(null);
  /** 24h window closed AND a combo product exists → don't sell licence-only here. */
  const [upOfferClosed,        setUpOfferClosed]        = useState(false);
  const [upProcessing,         setUpProcessing]         = useState(false);
  const [upModalOpen,          setUpModalOpen]          = useState(false);
  const [upInvoiceId,          setUpInvoiceId]          = useState<string | null>(null);
  // GST-inclusive total returned by the BE after create-order (cents).
  // Populated from response.razorpayOrder.amount so the buyer sees the
  // exact charged amount instead of a pre-tax display that would mismatch
  // whatever Razorpay/Stripe actually collect.
  const [upInvoiceTotalCents,  setUpInvoiceTotalCents]  = useState<number | null>(null);
  const [upDiscountedTotal,    setUpDiscountedTotal]    = useState<number | null>(null);
  const [upAppliedCouponCode,  setUpAppliedCouponCode]  = useState<string | null>(null);

  // NOT a universal rate — Unilevel Plus only applies GST when the buyer
  // pays in INR (see shouldApplyGstForChannel in backend/utils/gstTax.ts);
  // a USD/international checkout is charged the flat base price, no tax.
  // Only used as a last-resort fallback below when the BE's real
  // create-order total (upInvoiceTotalCents) isn't available yet/at all —
  // never as the assumed truth for what a buyer will actually be charged.
  const UP_GST_MULT = 1.18;

  // ─── Garage Affiliate (Unilevel Plus) payment completion ────────────
  // `PaymentMethodSelector`'s `onPaymentInitiated` fires as soon as the
  // BACKEND STEP is initiated — for a wallet/Stripe/zero-cost-coupon pay
  // that already means done, but for Razorpay (every INR method, and any
  // fresh-card/UPI USD method routed through it) it only means an ORDER
  // was created: `/api/invoices/:id/select-payment` returns
  // { razorpayOrderId, razorpayKeyId, amount, currency, ... } and the
  // CONSUMER is responsible for opening the actual Razorpay checkout
  // popup and, once the buyer pays, calling verify-payment — see the
  // canonical implementation in CheckoutPaymentStep.tsx.
  //
  // This modal used to treat ANY onPaymentInitiated call as "paid" and
  // immediately show "Garage Affiliate activated!" — so picking INR/UPI
  // (or any non-saved-card Razorpay method) never opened a payment popup
  // at all and never charged anything, yet still claimed success and
  // never created the UnilevelPlusPurchase record, so the distributor
  // progress bar never updated. This mirrors CheckoutPaymentStep's
  // handling exactly, scoped to this one modal.
  const loadRazorpaySdk = async (): Promise<void> => {
    const w = window as { Razorpay?: unknown };
    if (w.Razorpay) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load payment gateway"));
      document.body.appendChild(script);
    });
  };

  const handleUpVerifyPayment = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    try {
      const res = await fetch(`${API}/api/invoices/${upInvoiceId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Payment verification failed");

      setUpModalOpen(false);
      setUpInvoiceId(null);
      setUpInvoiceTotalCents(null);
      setUpDiscountedTotal(null);
      setUpAppliedCouponCode(null);
      setUpHasPurchased(true);
      toast.success("Garage Affiliate activated! You can now earn affiliate commissions.");
      fetchDistributorProgress();
    } catch (e: any) {
      toast.error(e.message || "Payment verification failed");
    }
  };

  const handleUpPaymentInitiated = async (data: any) => {
    // Wallet / Stripe / zero-amount coupon — already complete server-side.
    if (data.walletPaid || data.stripePaid || data.alreadyPaid) {
      setUpModalOpen(false);
      setUpInvoiceId(null);
      setUpInvoiceTotalCents(null);
      setUpDiscountedTotal(null);
      setUpAppliedCouponCode(null);
      setUpHasPurchased(true);
      toast.success("Garage Affiliate activated! You can now earn affiliate commissions.");
      fetchDistributorProgress();
      return;
    }

    // Razorpay (INR, or any fresh-card/UPI method) — open the actual
    // checkout popup; only the `handler` callback (a real completed
    // payment) triggers verification. Leaves the modal open underneath
    // so a dismissed/cancelled popup can simply be retried.
    if (data.razorpayOrderId && data.razorpayKeyId) {
      try {
        await loadRazorpaySdk();
        const RazorpayClass = (window as any).Razorpay;
        const rzp = new RazorpayClass({
          key: data.razorpayKeyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,
          name: "Garage Affiliate",
          description: "BAT 246 Garage Affiliate activation",
          handler: async (response: any) => {
            await handleUpVerifyPayment(response);
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment cancelled");
            },
          },
          theme: { color: "var(--brand)" },
          ...(data.razorpayCustomerId ? { customer_id: data.razorpayCustomerId } : {}),
          ...(data.upiAutopay ? { recurring: 1 as const } : {}),
          ...(data.razorpaySave ? { save: 1 as const } : {}),
          ...(data.razorpaySave ? { remember_customer: true } : {}),
          ...(data.razorpayPreferredTokenId ? { token: data.razorpayPreferredTokenId } : {}),
          prefill: { name: userData?.name, email: userData?.email },
        });
        rzp.open();
      } catch (err: any) {
        toast.error(err.message || "Failed to open payment gateway");
      }
      return;
    }

    // Unrecognized shape (e.g. crypto — not offered/handled in this
    // modal) — fail loudly instead of silently claiming success.
    toast.error("Payment could not be started. Please try a different method.");
    console.error("[Garage Affiliate] onPaymentInitiated: no branch matched.", data);
  };

  const closeBoardEntryModal = () => {
    setBoardEntryModalOpen(false);
    setBoardEntryInvoiceId(null);
    setBoardEntryDiscountedTotal(null);
    setBoardEntryAppliedCoupon(null);
  };

  // Board/POD entry ($650/$160) purchase completion — same shape as the
  // Garage Affiliate handlers above, just fed the invoice this product's
  // checkout created instead of Unilevel Plus's own create-order endpoint.
  const handleBoardEntryVerifyPayment = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    try {
      const res = await fetch(`${API}/api/invoices/${boardEntryInvoiceId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Payment verification failed");

      closeBoardEntryModal();
      toast.success("Purchase complete! You've been placed on a board.");
      fetchDistributorProgress();
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Payment verification failed");
    }
  };

  const handleBoardEntryPaymentInitiated = async (data: any) => {
    if (data.walletPaid || data.stripePaid || data.alreadyPaid) {
      closeBoardEntryModal();
      toast.success("Purchase complete! You've been placed on a board.");
      fetchDistributorProgress();
      refetch();
      return;
    }

    if (data.razorpayOrderId && data.razorpayKeyId) {
      try {
        await loadRazorpaySdk();
        const RazorpayClass = (window as any).Razorpay;
        const rzp = new RazorpayClass({
          key: data.razorpayKeyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,
          name: "BAT 246",
          description: `BAT 246 ${boardEntryPriceLabel} Board Entry`,
          handler: async (response: any) => {
            await handleBoardEntryVerifyPayment(response);
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment cancelled");
            },
          },
          theme: { color: "var(--brand)" },
          ...(data.razorpayCustomerId ? { customer_id: data.razorpayCustomerId } : {}),
          ...(data.upiAutopay ? { recurring: 1 as const } : {}),
          ...(data.razorpaySave ? { save: 1 as const } : {}),
          ...(data.razorpaySave ? { remember_customer: true } : {}),
          ...(data.razorpayPreferredTokenId ? { token: data.razorpayPreferredTokenId } : {}),
          prefill: { name: userData?.name, email: userData?.email },
        });
        rzp.open();
      } catch (err: any) {
        toast.error(err.message || "Failed to open payment gateway");
      }
      return;
    }

    toast.error("Payment could not be started. Please try a different method.");
    console.error("[Board Entry] onPaymentInitiated: no branch matched.", data);
  };

  // Starts the board/POD entry purchase — creates the invoice for THIS
  // already-logged-in visitor directly (their session email, no OTP —
  // that's the same identity path ProductCheckoutPage's own "already
  // signed in" bypass uses), then opens the small payment popup above.
  const handleBoardEntryBuy = async (productId: string, priceLabel: string) => {
    if (!userData?.email) {
      toast.error("Please sign in again.");
      return;
    }
    setBoardEntryProcessing(true);
    try {
      const res = await fetch(`${API}/checkout/product/${productId}/process-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          name: userData.name || undefined,
          quantity: 1,
          referralId: "aff_ntguyspc",
          ...(distributorProgress?.bat246RefUserId ? { bat246Ref: distributorProgress.bat246RefUserId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to start checkout");

      if (data.invoiceId) {
        setBoardEntryPriceLabel(priceLabel);
        setBoardEntryInvoiceId(data.invoiceId);
        setBoardEntryModalOpen(true);
      } else if (data.isFree || data.isMember) {
        // Already covered (free coupon, or already placed) — nothing left to pay.
        toast.success("You're all set!");
        fetchDistributorProgress();
        refetch();
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    } finally {
      setBoardEntryProcessing(false);
    }
  };

  const closeB2CoinsModal = () => {
    setB2CoinsModalOpen(false);
    setB2CoinsInvoiceId(null);
    setB2CoinsBalance(null);
  };

  // Starts the "pay with B2 Coins" flow — creates its own invoice via the
  // exact same process-checkout endpoint handleBoardEntryBuy uses (no
  // coupon code, so this is always the full price), then fetches the
  // buyer's current B2 Coin balance in parallel so the popup can show
  // "Available" vs. "Required" immediately instead of a second loading
  // flash after opening.
  const handleB2CoinsBuy = async (productId: string, priceLabel: string) => {
    if (!userData?.email) {
      toast.error("Please sign in again.");
      return;
    }
    setB2CoinsBuying(true);
    try {
      const res = await fetch(`${API}/checkout/product/${productId}/process-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          name: userData.name || undefined,
          quantity: 1,
          referralId: "aff_ntguyspc",
          ...(distributorProgress?.bat246RefUserId ? { bat246Ref: distributorProgress.bat246RefUserId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to start checkout");

      if (data.invoiceId) {
        setB2CoinsPriceLabel(priceLabel);
        setB2CoinsProductId(productId);
        setB2CoinsInvoiceId(data.invoiceId);
        // Dollars — see the state block's own note on units.
        setB2CoinsRequiredAmount(Number(data.product?.totalAmount) || 0);
        setB2CoinsModalOpen(true);
        setB2CoinsLoadingBalance(true);
        fetch(`${API}/bat246/layaway/my-wallet`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
          .then((r) => r.json())
          .then((d) => setB2CoinsBalance(d?.wallet?.balance ?? 0))
          .catch(() => setB2CoinsBalance(0))
          .finally(() => setB2CoinsLoadingBalance(false));
      } else if (data.isFree || data.isMember) {
        // Already covered (free coupon, or already placed) — nothing left to pay.
        toast.success("You're all set!");
        fetchDistributorProgress();
        refetch();
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    } finally {
      setB2CoinsBuying(false);
    }
  };

  const handleB2CoinsPay = async () => {
    if (!b2CoinsInvoiceId) return;
    setB2CoinsProcessing(true);
    try {
      const res = await fetch(`${API}/bat246/layaway/pay-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ invoiceId: b2CoinsInvoiceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Payment failed");

      closeB2CoinsModal();
      toast.success("Purchase complete! You've been placed on a board.");
      fetchDistributorProgress();
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setB2CoinsProcessing(false);
    }
  };

  // Distributor progress (non-admin only)
  const [distributorProgress, setDistributorProgress] = useState<DistributorProgress | null>(null);

  useEffect(() => {
    if (authLoading || isAlanK) return;
    fetch(`${API}/bat246/membership/status`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => setMembershipActive(d.active ?? false))
      .catch(() => setMembershipActive(false));
  }, [authLoading, isAlanK]);

  const fetchDistributorProgress = useCallback(() => {
    if (isAlanK) return;
    fetch(`${API}/bat246/distributor/progress`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => setDistributorProgress(d))
      .catch(() => {});
  }, [isAlanK]);

  useEffect(() => {
    if (authLoading) return;
    fetchDistributorProgress();
  }, [authLoading, fetchDistributorProgress]);

  // Re-fetch when user returns to this tab (e.g. after completing $650 checkout on another page)
  useEffect(() => {
    window.addEventListener("focus", fetchDistributorProgress);
    return () => window.removeEventListener("focus", fetchDistributorProgress);
  }, [fetchDistributorProgress]);

  useEffect(() => {
    if (authLoading || isAlanK) return;
    fetch(`${API}/wallet/affiliate/balance`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => setUpHasPurchased(d.hasPurchasedUnilevelPlus ?? false))
      .catch(() => setUpHasPurchased(false));
    fetch(`${API}/unilevel-plus/product`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.plan?.productPrice) setUpProductPrice(d.plan.productPrice);
        // The $25 licence is only sold on its own while the 24h window is
        // open. After it closes it's sold with the first subscription cycle
        // ($61), and this page has no combo checkout — so we stop offering it
        // here rather than quote a price that no longer exists. (The backend
        // now refuses such an order anyway; this keeps the user from hitting
        // that error.) Only suppress when a combo product actually exists to
        // be sold instead — otherwise licence-only is still the real offer.
        setUpOfferClosed(
          d.freeMonthWindow?.open === false &&
            Array.isArray(d.comboTerms) &&
            d.comboTerms.length > 0,
        );
      })
      .catch(() => {});
  }, [authLoading, isAlanK]);

  const handleUPActivate = async () => {
    setUpProcessing(true);
    try {
      const res = await fetch(`${API}/unilevel-plus/checkout/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        // source: "bat246_office" exempts this purchase from the backend's
        // post-window guard — inside the BAT246 office the $25 licence is
        // always sold standalone, regardless of the 24h combo window.
        body: JSON.stringify({ quantity: 1, source: "bat246_office" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      if (data.invoiceId) {
        setUpInvoiceId(data.invoiceId);
        // razorpayOrder.amount is the BE-authoritative GST-inclusive total
        // in cents. Fall back to the local pre-computed total if the BE
        // ever stops sending it (defensive — shouldn't happen in prod).
        setUpInvoiceTotalCents(
          typeof data.razorpayOrder?.amount === "number"
            ? data.razorpayOrder.amount
            : null
        );
        setUpModalOpen(true);
      } else {
        toast.error("Unable to initiate payment. Please try again.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpProcessing(false);
    }
  };

  // Free 2-month trial, then $12/month auto-debited — replaces the old
  // one-time $20/year checkout for new users. No invoice, no payment modal:
  // activates immediately once confirmed in the popup below. (The old $20
  // checkout modal further down is left in place, unused by this button
  // now, in case it's ever needed again.)
  const handleActivateMembership = async () => {
    setFreeTrialConfirmOpen(false);
    setMembershipLoading(true);
    try {
      const res = await fetch(`${API}/bat246/membership/activate-free`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to activate membership");
      setMembershipActive(true);
      toast.success("You're in! Free for 2 months - then $12/month from your B2 wallet.");
      fetchDistributorProgress();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMembershipLoading(false);
    }
  };

  const handlePlaceNow = useCallback(async (n: PlacementNotification) => {
    const res = await fetch(`${API}/bat246/boards/${n.boardId}/place-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ notificationId: n._id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Placement failed");
    toast.success(`${n.qualifiedUserName} placed at position ${n.position}!`);
  }, []);

  // Create board
  const [creating, setCreating] = useState(false);
  const handleCreateBoard = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/bat246/boards`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create board");
      toast.success(`Board ${data.board.trackingNumber} created`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const activatePendingBoard = async (boardId: string) => {
    const payout = boardPayouts[boardId] ?? 200;
    setActivatingBoardId(boardId);
    try {
      const res = await fetch(`${API}/bat246/boards/${boardId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ nextHomePlatePayout: payout }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      toast.success("Board activated! Protection Period (120h) has started.");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActivatingBoardId(null);
    }
  };

  // Section collapse state
  const [activeOpen,    setActiveOpen]    = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);

  // Per-section search
  const [activeSearch,    setActiveSearch]    = useState("");
  const [completedSearch, setCompletedSearch] = useState("");

  // Per-section pagination
  const [activePage,    setActivePage]    = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (userData.orgName && BAT246_ORGS.includes(userData.orgName)) {
      // Confirmed in the right org — clear the guard so a genuine future
      // mismatch (e.g. switching into a different org later, then back to
      // one that needs auto-join again) still gets its one retry, instead
      // of this tab remembering the guard forever.
      sessionStorage.removeItem("bat246_org_autojoin_attempted");
      return;
    }
    if (userData.orgName && !BAT246_ORGS.includes(userData.orgName)) {
      // Auto-switch to Bat246 org instead of redirecting away. Guarded to
      // run at most once per tab: without this, if orgName still doesn't
      // resolve to a match after the reload (a slow/failed /auth/me race,
      // a token write that didn't actually stick, anything), this effect
      // just fires again on the freshly-reloaded page and reloads again —
      // an infinite reload loop with no way to break out of it. One
      // attempt, then give up and send them to /workspace like the
      // existing failure branch already does.
      if (sessionStorage.getItem("bat246_org_autojoin_attempted")) {
        router.replace("/workspace");
        return;
      }
      sessionStorage.setItem("bat246_org_autojoin_attempted", "1");

      const tok = getToken();
      fetch(`${API}/bat246/office/join`, { method: "POST", headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.token) {
            localStorage.setItem("garage_tok", d.token);
            localStorage.setItem("garage_org_id", d.orgId || "6a0d34e677323d1b81c6469b");
            window.location.reload();
          } else {
            router.replace("/workspace");
          }
        })
        .catch(() => router.replace("/workspace"));
    }
  }, [userData.orgName, authLoading, router]);

  // "Make Live" / "Pause Live" for the 3 Family-6 boards — one button
  // toggles all 3 together via POST /bat246/boards/:id/hidden (Alan-K-only
  // on the backend too). Only rendered once those boards are actually in
  // the currently-fetched list (i.e. Alan K has "All Boards" selected,
  // since a hidden board won't be "mine" unless he happens to hold a slot
  // on it) — no point showing a button with nothing to act on.
  const FAMILY6_TRACKING = ["6-1001", "6-1002 L", "6-1003 R"];
  const family6Boards = [...boards, ...completed].filter(b => FAMILY6_TRACKING.includes(b.trackingNumber));
  const family6Hidden = family6Boards.some(b => b.hidden);
  const [family6Busy, setFamily6Busy] = useState(false);
  const [family6ConfirmOpen, setFamily6ConfirmOpen] = useState(false);
  const handleToggleFamily6Live = async () => {
    setFamily6ConfirmOpen(false);
    setFamily6Busy(true);
    try {
      const nextHidden = !family6Hidden;
      await Promise.all(
        family6Boards.map(b =>
          fetch(`${API}/bat246/boards/${b._id}/hidden`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ hidden: nextHidden }),
          })
        )
      );
      toast.success(nextHidden ? "Family-6 boards paused" : "Family-6 boards live");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setFamily6Busy(false);
    }
  };

  const pendingBoards = boards.filter(b => b.status === "pending");
  const activeBoards  = boards.filter(b => !["pending", "split", "completed"].includes(b.status));
  const leakedDone    = boards.filter(b => b.status === "split" || b.status === "completed");
  const allCompleted  = [...leakedDone, ...completed];

  // Search filtering
  function matchBoard(b: BoardSummary, q: string) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      b.trackingNumber.toLowerCase().includes(s) ||
      (b.title ?? "").toLowerCase().includes(s) ||
      String(b.boardNumber).includes(s)
    );
  }

  const filteredActive    = activeBoards.filter(b => matchBoard(b, activeSearch));
  const filteredCompleted = allCompleted.filter(b => matchBoard(b, completedSearch));

  // Reset page on search change
  useEffect(() => { setActivePage(1); }, [activeSearch]);
  useEffect(() => { setCompletedPage(1); }, [completedSearch]);

  // Pagination slices
  const activeTotalPages    = Math.max(1, Math.ceil(filteredActive.length / BOARDS_PER_PAGE));
  const completedTotalPages = Math.max(1, Math.ceil(filteredCompleted.length / BOARDS_PER_PAGE));
  const activeSlice    = filteredActive.slice((activePage - 1) * BOARDS_PER_PAGE, activePage * BOARDS_PER_PAGE);
  const completedSlice = filteredCompleted.slice((completedPage - 1) * BOARDS_PER_PAGE, completedPage * BOARDS_PER_PAGE);

  return (
    <div className="min-h-full bg-[#09090f] text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">

        {/* Back to admin / dashboard — always shown now. Alan and
            board-position holders go to their existing dashboards
            unchanged; everyone else (a plain office member, no board
            position) now falls back to the /games/bat246 3-card dashboard
            instead of having no way back at all. */}
        <div className="mb-5">
          <Link
            href={isAlanK ? "/games/bat246" : hasDashboardAccess ? "/games/bat246/dashboard" : "/games/bat246"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            {isAlanK ? "Admin Board" : "Dashboard"}
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-widest uppercase text-white/90">BAT 246</h1>
            <p className="text-white/40 text-base sm:text-lg mt-1">BAT 246 Minor League</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Bat246NotificationBell onPlaceNow={handlePlaceNow} />
          {isAlanK && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCreateBoard}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/50 bg-green-600/20 hover:bg-green-600/35 text-green-300 text-sm font-semibold transition-all disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Board
              </button>
              <button
                onClick={() => setMine(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  mine
                    ? "bg-blue-600/80 border-blue-400/50 text-white"
                    : "bg-white/5 border-white/15 text-white/50 hover:text-white/80 hover:border-white/25"
                }`}
              >
                <Users className="w-4 h-4" />
                {mine ? "My Boards" : "All Boards"}
              </button>
              {family6Boards.length > 0 && (
                <button
                  onClick={() => setFamily6ConfirmOpen(true)}
                  disabled={family6Busy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all disabled:opacity-50 ${
                    family6Hidden
                      ? "bg-emerald-600/25 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/40"
                      : "bg-red-600/25 border-red-500/50 text-red-300 hover:bg-red-600/40"
                  }`}
                >
                  {family6Busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {family6Hidden ? "Make All Live" : "Pause All Live"}
                </button>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Distributor progress bar — non-admin users only */}
        {!isAlanK && <DistributorProgressBar progress={distributorProgress} />}

        {/* Unilevel Plus banner — the 24h-window/combo-only rule does not
            apply inside the BAT246 office: this page always sells the
            standalone $25 licence (handleUPActivate below tells the backend
            so via `source: "bat246_office"`, which exempts it from the
            post-window guard).
            TEMP: hidden on request — `false &&` instead of deleting/JSX-
            commenting so the block (which has its own nested comment)
            stays intact; flip back to `!isAlanK && ...` to restore. */}
        {false && !isAlanK && upHasPurchased === false && !distributorProgress?.isQualified && (
          <div className="mb-6 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <Lock className="w-6 h-6 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-base sm:text-lg font-medium text-purple-300">
                    You&apos;re missing out on all affiliate earnings
                  </p>
                  <p className="text-sm sm:text-base text-purple-400/70 mt-1">
                    Activate Garage Affiliate to earn commissions on every referral.
                  </p>
                </div>
              </div>
              <button
                onClick={handleUPActivate}
                disabled={upProcessing}
                className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white h-11 sm:h-12 text-sm sm:text-base font-semibold px-4 sm:px-5 rounded-md transition-colors"
              >
                {upProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {/* Base price only — the real total (this button doesn't
                    know yet) depends on the buyer's actual country/pincode,
                    computed server-side once the order is created. Assuming
                    a flat 18% GST here was wrong for anyone outside India;
                    the create-order response (upInvoiceTotalCents, shown in
                    the modal right after this fires) is the source of truth. */}
                {upProductPrice != null ? `Activate $${upProductPrice.toFixed(2)}` : "Activate"}
              </button>
            </div>
          </div>
        )}

        {/* Membership banner — non-admin users who haven't purchased */}
        {!isAlanK && membershipActive === false && !distributorProgress?.steps.hasBat246Membership && !distributorProgress?.isQualified && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <Lock className="w-6 h-6 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-base sm:text-lg font-medium text-red-400">
                    Get BAT 246 Monthly Membership
                  </p>
                  <p className="text-[14.7px] sm:text-[16.8px] text-red-400/70 mt-1">
                    Your first 2 months of BAT 246 Monthly Membership are completely free.
                  </p>
                  <p className="text-[14.7px] sm:text-[16.8px] text-red-400/70">
                    After that, there will be monthly debit from your B2 Wallet.
                  </p>
                  <p className="text-[14.7px] sm:text-[16.8px] text-red-400/70">
                    You&apos;ll never be billed or never have to pay it regardless if account{" "}
                    <span className="font-semibold text-red-500">reads negative</span>,
                  </p>
                  <p className="text-[14.7px] sm:text-[16.8px] text-red-400/70">
                    you can walk away or quit any time.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFreeTrialConfirmOpen(true)}
                disabled={membershipLoading}
                className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1.5 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-50 text-brand-foreground h-11 sm:h-12 text-sm sm:text-base font-semibold px-4 sm:px-5 rounded-md transition-colors cursor-pointer"
              >
                {membershipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Claim Free for 2 Months
              </button>
            </div>
          </div>
        )}

        {/* Board/POD entry product banner — defaults to the $650 board entry
            product, but shows the $160 POD entry product instead when this
            distributor was invited specifically for it (see the admin
            "+ Invite" flow on the Distributors page). */}
        {!isAlanK && distributorProgress && !distributorProgress.steps.hasPurchasedProduct && !distributorProgress.isQualified && (() => {
          const isPodInvite = distributorProgress.invitedProductId === POD_ENTRY_PRODUCT_ID;
          const entryProductId = isPodInvite ? POD_ENTRY_PRODUCT_ID : "6a159466cd9f94f7f23b2ef9";
          const priceLabel = isPodInvite ? "$160" : "$650";
          return (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <Lock className="w-6 h-6 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-base sm:text-lg font-medium text-red-400">
                      {priceLabel} Product Sale
                    </p>
                    <p className="text-[14.7px] sm:text-[16.8px] text-red-400/70 mt-1">
                      Sale of a {priceLabel} Product gains you a free entry to be part of the team
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={boardEntryProcessing}
                  onClick={() => handleBoardEntryBuy(entryProductId, priceLabel)}
                  className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1.5 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-50 text-brand-foreground h-11 sm:h-12 text-sm sm:text-base font-semibold px-4 sm:px-5 rounded-md transition-colors cursor-pointer"
                >
                  {boardEntryProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Buy {priceLabel}
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-red-500/20 flex items-center justify-between gap-3 flex-wrap">
                <p className="ml-[3.8%] text-[13.48px] sm:text-[15.73px] text-red-400/60">Or Pay Using B2 Coins</p>
                <button
                  type="button"
                  disabled={b2CoinsBuying}
                  onClick={() => handleB2CoinsBuy(entryProductId, priceLabel)}
                  className="flex-shrink-0 flex items-center justify-center gap-1.5 bg-transparent hover:bg-brand/10 disabled:opacity-50 text-brand border border-brand/40 h-8 sm:h-9 text-xs sm:text-sm font-semibold px-3 sm:px-4 rounded-md transition-colors cursor-pointer"
                >
                  {b2CoinsBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Pay With B2 Coins
                </button>
              </div>
            </div>
          );
        })()}

        {loading && (
          <div className="flex items-center gap-3 text-white/40 py-12 justify-center">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Loading boards…
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-500/30 rounded-xl p-6 text-red-300 text-sm">
            Failed to load boards: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {isAlanK && pendingBoards.length > 0 && (
              <div className="mb-8">
                <div className="text-[11px] font-bold text-orange-400/80 uppercase tracking-widest mb-3">
                  Setup Required
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingBoards.map((board) => (
                    <div
                      key={board._id}
                      className="bg-orange-950/30 border border-orange-500/25 rounded-xl p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-red-400 font-black text-xl tracking-wide">{board.trackingNumber}</div>
                          <div className="text-orange-300/70 text-xs mt-0.5">Awaiting admin configuration</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${STATUS_COLOR.pending}`}>
                          Pending
                        </span>
                      </div>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-white/40">Board #</span>
                          <span className="text-white/70">#{board.boardNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Minor League</span>
                          <span className="text-white/70">${board.minorLeagueAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      {isAlanK && (
                        <div className="space-y-2 mb-2">
                          {/* HP Payout — fixed at $200 for now
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-white/40 whitespace-nowrap">HP Payout</label>
                            <select
                              value={boardPayouts[board._id] ?? 200}
                              onChange={e => setBoardPayouts(p => ({ ...p, [board._id]: Number(e.target.value) }))}
                              className="flex-1 bg-[#1c1c2e] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-500/40"
                            >
                              {[100, 150, 200, 250, 300, 500].map(v => (
                                <option key={v} value={v} style={{ backgroundColor: "#1c1c2e", color: "#fff" }}>${v}</option>
                              ))}
                            </select>
                          </div>
                          */}
                          <button
                            onClick={() => activatePendingBoard(board._id)}
                            disabled={activatingBoardId === board._id}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-700/70 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                          >
                            {activatingBoardId === board._id
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
                              : "Activate Board — Start PP Clock"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Board lists are meaningless noise before someone's actually a
                qualified distributor — there's nothing to be "active" or
                "completed" on yet. Admin (isAlanK) still sees everything,
                since they manage boards for the whole office regardless of
                their own distributor status. */}
            {(isAlanK || distributorProgress?.isQualified) && (
              <>
            {/* ── Active Boards ─────────────────────────── */}
            <div className="mb-6">
              {/* Section header — collapsible */}
              <button
                onClick={() => setActiveOpen(v => !v)}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                    Active Boards
                  </span>
                  <span className="text-[10px] font-semibold text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full">
                    {activeBoards.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-white/25 transition-transform duration-200 ${activeOpen ? "" : "-rotate-90"}`}
                />
              </button>

              {activeOpen && (
                <>
                  {/* Search */}
                  {activeBoards.length > 0 && (
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                      <input
                        type="text"
                        placeholder="Search active boards…"
                        value={activeSearch}
                        onChange={e => setActiveSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#141414] border border-white/8 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/30 transition-colors"
                      />
                      {activeSearch && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                          {filteredActive.length} result{filteredActive.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {activeBoards.length > 0 ? (
                    <>
                      {filteredActive.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {activeSlice.map((board) => (
                            <BoardCard key={board._id} board={board} isAdmin={isAlanK} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-white/25 text-sm py-4">No boards match your search.</div>
                      )}

                      {/* Pagination */}
                      {activeTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                          <span className="text-xs text-white/30">
                            Page <span className="text-white/50 font-medium">{activePage}</span> of {activeTotalPages}
                            <span className="ml-2 text-white/20">· {filteredActive.length} boards</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActivePage(p => Math.max(1, p - 1))}
                              disabled={activePage <= 1}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" /> Previous
                            </button>
                            <button
                              onClick={() => setActivePage(p => Math.min(activeTotalPages, p + 1))}
                              disabled={activePage >= activeTotalPages}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Next <ChevronRightIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-white/25 text-sm py-4">
                      {effectiveMine ? "You are not a player on any active board." : "No active boards found."}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Completed / Split Boards ──────────────── */}
            <div>
              {/* Section header — collapsible */}
              <button
                onClick={() => setCompletedOpen(v => !v)}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                    Completed / Split Boards
                  </span>
                  <span className="text-[10px] font-semibold text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full">
                    {allCompleted.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-white/25 transition-transform duration-200 ${completedOpen ? "" : "-rotate-90"}`}
                />
              </button>

              {completedOpen && (
                <>
                  {/* Search */}
                  {allCompleted.length > 0 && (
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                      <input
                        type="text"
                        placeholder="Search completed boards…"
                        value={completedSearch}
                        onChange={e => setCompletedSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#141414] border border-white/8 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/30 transition-colors"
                      />
                      {completedSearch && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                          {filteredCompleted.length} result{filteredCompleted.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {allCompleted.length > 0 ? (
                    <>
                      {filteredCompleted.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {completedSlice.map((board) => (
                            <BoardCard key={board._id} board={board} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-white/25 text-sm py-4">No boards match your search.</div>
                      )}

                      {/* Pagination */}
                      {completedTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                          <span className="text-xs text-white/30">
                            Page <span className="text-white/50 font-medium">{completedPage}</span> of {completedTotalPages}
                            <span className="ml-2 text-white/20">· {filteredCompleted.length} boards</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                              disabled={completedPage <= 1}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" /> Previous
                            </button>
                            <button
                              onClick={() => setCompletedPage(p => Math.min(completedTotalPages, p + 1))}
                              disabled={completedPage >= completedTotalPages}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Next <ChevronRightIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-white/25 text-sm py-4">
                      {effectiveMine ? "No completed boards yet." : "No completed boards found."}
                    </div>
                  )}
                </>
              )}
            </div>

            {effectiveMine && activeBoards.length === 0 && allCompleted.length === 0 && (
              <div className="text-center py-16 text-white/30 text-sm">
                You are not a player on any board yet.
              </div>
            )}
              </>
            )}
          </>
        )}
      </div>

      {/* Unilevel Plus payment modal */}
      {upModalOpen && upInvoiceId && upProductPrice !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12121e] border border-white/15 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div>
                <div className="text-white font-bold text-base">Garage Affiliate</div>
                <div className="text-white/40 text-sm">
                  {(() => {
                    // Real BE-computed total (tax is country/pincode-
                    // dependent — 18% GST only actually applies in India,
                    // not universally) — fall back to the 18% estimate
                    // only in the unlikely case the BE didn't send one.
                    const bestCents = upInvoiceTotalCents ?? Math.round(upProductPrice * UP_GST_MULT * 100);
                    const baseCents = Math.round(upProductPrice * 100);
                    const hasTax = bestCents > baseCents;
                    return `$${upProductPrice.toFixed(2)}${hasTax ? " + tax" : ""} · $${(bestCents / 100).toFixed(2)} / year`;
                  })()}
                </div>
              </div>
              <button
                onClick={() => { setUpModalOpen(false); setUpInvoiceId(null); setUpInvoiceTotalCents(null); setUpDiscountedTotal(null); setUpAppliedCouponCode(null); }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!upAppliedCouponCode ? (
                <div className="mb-3">
                  <PlatformCouponInput
                    productType="unilevel_plus"
                    amountCents={Math.round(upProductPrice * 100)}
                    invoiceCurrency="USD"
                    authToken={getToken() || undefined}
                    onApplied={async (ap) => {
                      try {
                        const res = await fetch(`${API}/api/invoices/${upInvoiceId}/apply-platform-coupon`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                          body: JSON.stringify({ code: ap.code }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) { throw new Error(data.error || "Failed to apply coupon"); }
                        setUpDiscountedTotal(data.invoice.totalAmount);
                        setUpAppliedCouponCode(data.invoice.couponCode);
                        toast.success("Coupon applied");
                      } catch (e: any) { toast.error(e.message || "Failed to apply coupon"); throw e; }
                    }}
                  />
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Coupon {upAppliedCouponCode} applied</span>
                </div>
              )}
              <PaymentMethodSelector
                invoiceId={upInvoiceId}
                itemCurrency="USD"
                // Priority: coupon-adjusted total > BE-reported GST-inclusive
                // total from create-order > local GST-inclusive fallback.
                // Never the raw pre-tax price — that would mismatch the
                // invoice on the BE and confuse the payment gateway.
                totalAmount={
                  upDiscountedTotal ??
                  upInvoiceTotalCents ??
                  Math.round(upProductPrice * UP_GST_MULT * 100)
                }
                onPaymentInitiated={handleUpPaymentInitiated}
                onError={(err) => toast.error(err)}
              />
              <button
                onClick={() => { setUpModalOpen(false); setUpInvoiceId(null); setUpInvoiceTotalCents(null); setUpDiscountedTotal(null); setUpAppliedCouponCode(null); }}
                className="mt-3 text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors w-full text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Make All Live / Pause All Live confirmation — sized like the
          free-trial confirm popup below (large text, generous tap targets)
          since Alan reads this on both desktop and phone. */}
      {family6ConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12121e] border border-white/15 rounded-2xl sm:rounded-[24px] w-full max-w-md sm:max-w-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-6 border-b border-white/10">
              <div className="flex items-center gap-2.5 sm:gap-4">
                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-brand shrink-0" />
                <div className="text-white font-bold text-xl sm:text-3xl">
                  {family6Hidden ? "Make all live?" : "Pause all live?"}
                </div>
              </div>
              <button
                onClick={() => setFamily6ConfirmOpen(false)}
                className="text-white/40 hover:text-white transition-colors shrink-0"
              >
                <X className="w-7 h-7 sm:w-9 sm:h-9" />
              </button>
            </div>
            <div className="p-5 sm:p-8">
              <p className="text-lg sm:text-2xl text-white/80 leading-relaxed">
                {family6Hidden
                  ? "This will make 6-1001, 6-1002 L, and 6-1003 R visible to everyone again."
                  : "This will hide 6-1001, 6-1002 L, and 6-1003 R from everyone except redbaron2020@mail.com."}
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 sm:mt-8">
                <button
                  onClick={() => setFamily6ConfirmOpen(false)}
                  className="px-5 py-3 sm:px-7 sm:py-4 rounded-lg bg-white/[0.06] border border-white/10 text-white text-lg sm:text-2xl font-medium hover:bg-white/[0.1] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleToggleFamily6Live}
                  disabled={family6Busy}
                  className={`flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-4 rounded-lg disabled:opacity-50 text-white text-lg sm:text-2xl font-semibold transition-colors ${
                    family6Hidden ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                  }`}
                >
                  {family6Busy ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : null}
                  {family6Hidden ? "Make All Live" : "Pause All Live"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Free trial confirmation popup — shown before the free membership
          actually activates, so the recurring $12/month charge is clearly
          disclosed up front rather than as a surprise later. */}
      {freeTrialConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12121e] border border-white/15 rounded-2xl sm:rounded-[24px] w-full max-w-md sm:max-w-2xl md:max-w-[1040px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 sm:px-7 sm:py-6 md:px-10 md:py-8 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-brand shrink-0" />
                <div className="text-white font-bold text-lg sm:text-2xl md:text-[32px]">Confirm Free Membership</div>
              </div>
              <button
                onClick={() => setFreeTrialConfirmOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" />
              </button>
            </div>
            <div className="p-5 sm:p-7 md:p-10 overflow-y-auto">
              <div className="space-y-2 md:space-y-3 text-sm sm:text-xl md:text-[28px] text-white/80 leading-relaxed">
                <p>Your first 2 months of BAT 246 Monthly Membership are completely free.</p>
                <p>After that, there will be monthly debit from your B2 Wallet.</p>
                <p>
                  You&apos;ll never be billed or never have to pay it regardless if account{" "}
                  <span className="font-semibold text-red-500">reads negative</span>, you can walk
                  away or quit any time.
                </p>
              </div>
              <p className="mt-3 sm:mt-4 md:mt-6 text-sm sm:text-xl md:text-[28px] text-white/80 leading-relaxed">
                Click <span className="font-semibold text-white">OK</span> to claim your free membership, or{" "}
                <span className="font-semibold text-white">Cancel</span> if you&apos;d rather not proceed.
              </p>
              <div className="flex justify-end gap-2 sm:gap-3 md:gap-4 mt-5 sm:mt-7 md:mt-10">
                <button
                  onClick={() => setFreeTrialConfirmOpen(false)}
                  className="px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 rounded-md bg-white/[0.06] border border-white/10 text-white text-sm sm:text-xl md:text-[28px] font-medium hover:bg-white/[0.1] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivateMembership}
                  disabled={membershipLoading}
                  className="flex items-center gap-1.5 sm:gap-2 md:gap-3 px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm sm:text-xl md:text-[28px] font-semibold transition-colors"
                >
                  {membershipLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-7 md:h-7 animate-spin" /> : null}
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Membership payment modal */}
      {membershipModalOpen && membershipInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12121e] border border-white/15 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div>
                <div className="text-white font-bold text-base">BAT 246 Annual Membership</div>
                <div className="text-white/40 text-sm">$20.00 / year</div>
              </div>
              <button
                onClick={() => { setMembershipModalOpen(false); setMembershipInvoiceId(null); setMembershipDiscountedTotal(null); setMembershipAppliedCoupon(null); }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!membershipAppliedCoupon ? (
                <div className="mb-4">
                  <PlatformCouponInput
                    productType="product"
                    amountCents={2000}
                    invoiceCurrency="USD"
                    authToken={getToken() || undefined}
                    onApplied={async (ap) => {
                      try {
                        const res = await fetch(`${API}/api/invoices/${membershipInvoiceId}/apply-platform-coupon`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                          body: JSON.stringify({ code: ap.code }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) { throw new Error(data.error || "Failed to apply coupon"); }
                        setMembershipDiscountedTotal(data.invoice.totalAmount);
                        setMembershipAppliedCoupon(data.invoice.couponCode);
                        toast.success("Coupon applied!");
                      } catch (e: any) { toast.error(e.message || "Failed to apply coupon"); throw e; }
                    }}
                  />
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Coupon {membershipAppliedCoupon} applied</span>
                </div>
              )}
              <PaymentMethodSelector
                invoiceId={membershipInvoiceId}
                itemCurrency="USD"
                totalAmount={membershipDiscountedTotal ?? 2000}
                onPaymentInitiated={() => {
                  setMembershipModalOpen(false);
                  setMembershipInvoiceId(null);
                  setMembershipDiscountedTotal(null);
                  setMembershipAppliedCoupon(null);
                  setMembershipActive(true);
                  toast.success("Membership activated! Welcome to BAT 246.");
                  fetchDistributorProgress();
                  window.location.reload();
                }}
                onError={(err) => toast.error(err)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Board/POD entry ($650/$160) payment popup — same small-modal
          pattern as the Garage Affiliate ($25) modal above, never leaves
          this page. */}
      {boardEntryModalOpen && boardEntryInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12121e] border border-white/15 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div>
                <div className="text-white font-bold text-base">BAT 246 {boardEntryPriceLabel} Board Entry</div>
                <div className="text-white/40 text-sm">{boardEntryPriceLabel} · one-time</div>
              </div>
              <button
                onClick={closeBoardEntryModal}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!boardEntryAppliedCoupon ? (
                <div className="mb-3">
                  <PlatformCouponInput
                    productType="product"
                    amountCents={Math.round(parseFloat(boardEntryPriceLabel.replace(/[^0-9.]/g, "")) * 100)}
                    invoiceCurrency="USD"
                    authToken={getToken() || undefined}
                    onApplied={async (ap) => {
                      try {
                        const res = await fetch(`${API}/api/invoices/${boardEntryInvoiceId}/apply-platform-coupon`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                          body: JSON.stringify({ code: ap.code }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) { throw new Error(data.error || "Failed to apply coupon"); }
                        setBoardEntryDiscountedTotal(data.invoice.totalAmount);
                        setBoardEntryAppliedCoupon(data.invoice.couponCode);
                        toast.success("Coupon applied");
                      } catch (e: any) { toast.error(e.message || "Failed to apply coupon"); throw e; }
                    }}
                  />
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Coupon {boardEntryAppliedCoupon} applied</span>
                </div>
              )}
              <PaymentMethodSelector
                invoiceId={boardEntryInvoiceId}
                itemCurrency="USD"
                // bat246_entry products are always sold tax-free (see
                // ProductCheckoutPage's own GST comments), so the sticker
                // price is the exact total — no GST multiplier needed here,
                // unlike the Garage Affiliate modal above.
                totalAmount={
                  boardEntryDiscountedTotal ??
                  Math.round(parseFloat(boardEntryPriceLabel.replace(/[^0-9.]/g, "")) * 100)
                }
                onPaymentInitiated={handleBoardEntryPaymentInitiated}
                onError={(err) => toast.error(err)}
              />
              <button
                onClick={closeBoardEntryModal}
                className="mt-3 text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors w-full text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Pay With B2 Coins" checkout popup — separate from the
          PaymentMethodSelector modal above on purpose: no coupon UI, no
          method picker, just Available vs. Required and a single Pay
          button (or a "request more" nudge when short). */}
      {b2CoinsModalOpen && b2CoinsInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12121e] border border-white/15 rounded-xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-white font-bold text-lg sm:text-xl truncate">BAT 246 {b2CoinsPriceLabel} Product Payment</div>
                <div className="text-white/40 text-base sm:text-lg">Pay with B2 Coins</div>
              </div>
              <button
                onClick={closeB2CoinsModal}
                className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </div>
            <div className="p-5 sm:p-6">
              {b2CoinsLoadingBalance ? (
                <div className="flex items-center justify-center py-8 text-white/40 gap-2 text-lg">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading your balance…
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5 mb-4 space-y-2.5">
                    <div className="flex items-center justify-between text-base sm:text-lg flex-wrap gap-1">
                      <span className="text-white/50">Available Balance</span>
                      <span className="text-white font-semibold">{(b2CoinsBalance ?? 0).toLocaleString()} B2 Coins</span>
                    </div>
                    <div className="flex items-center justify-between text-base sm:text-lg flex-wrap gap-1">
                      <span className="text-white/50">Required</span>
                      <span className="text-white font-semibold">{b2CoinsRequiredAmount.toLocaleString()} B2 Coins</span>
                    </div>
                  </div>

                  {(b2CoinsBalance ?? 0) >= b2CoinsRequiredAmount ? (
                    <button
                      type="button"
                      disabled={b2CoinsProcessing}
                      onClick={handleB2CoinsPay}
                      className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-50 text-brand-foreground h-12 sm:h-14 text-base sm:text-lg font-semibold rounded-md transition-colors cursor-pointer"
                    >
                      {b2CoinsProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Pay {b2CoinsRequiredAmount.toLocaleString()} B2 Coins
                    </button>
                  ) : (
                    <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 sm:p-5 text-center">
                      {/* Only surfaced here — the moment a real balance
                          check comes back short — not as a standalone
                          always-visible banner row, so it only ever shows
                          up when it's actually relevant. */}
                      <p className="text-base sm:text-lg text-orange-300">Don&apos;t have enough B2 Coins? Borrow them instead.</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!b2CoinsProductId) return;
                          setSblProductId(b2CoinsProductId);
                          setSblPriceLabel(b2CoinsPriceLabel);
                          setSblModalOpen(true);
                          closeB2CoinsModal();
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 bg-transparent hover:bg-orange-400/10 text-orange-300 border border-orange-400/40 h-11 sm:h-12 text-base sm:text-lg font-semibold px-3 rounded-md transition-colors cursor-pointer"
                      >
                        Request SBL
                      </button>
                    </div>
                  )}
                  <button
                    onClick={closeB2CoinsModal}
                    className="mt-4 text-base sm:text-lg text-[#6b6b80] hover:text-[#9fa0b8] transition-colors w-full text-center"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {sblModalOpen && sblProductId && (
        <SnapBackLoanModal
          productId={sblProductId}
          priceLabel={sblPriceLabel}
          onClose={() => setSblModalOpen(false)}
        />
      )}
    </div>
  );
}
