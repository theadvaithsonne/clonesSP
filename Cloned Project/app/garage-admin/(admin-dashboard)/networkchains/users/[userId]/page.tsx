"use client";

import { useEffect, useState, useCallback, useMemo, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Search,
  Users,
  MessageSquare,
  Video,
  Film,
  Network,
  Contact as ContactIcon,
  Wallet,
  Plus,
  UserX,
  Activity,
  ExternalLink,
  MousePointerClick,
  FileText as PageIcon,
  AlertOctagon,
} from "lucide-react";
import {
  getAdminUserOverview,
  getAdminUserContacts,
  getAdminUserConversations,
  getAdminUserMeetings,
  getAdminUserNoteSessions,
  getAdminUserRecordings,
  getAdminUserWallet,
  creditAdminUserWallet,
  AdminUnauthorizedError,
  AdminApiError,
  getAdminUserActivity,
  getAdminUserSentryIssues,
  type AdminUserOverview,
  type AdminContact,
  type AdminConversationRow,
  type AdminMeeting,
  type AdminNoteSession,
  type AdminRecording,
  type AdminUserWallet,
  type AdminUserActivityEvent,
  type AdminUserSentryIssue,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EarnGPTChatViewer } from "@/components/nc-admin/users/earngpt-chat-viewer";
import { MeetingDetail } from "@/components/nc-admin/users/meeting-detail";

type Tab =
  | "overview"
  | "network"
  | "contacts"
  | "earngpt"
  | "meetings"
  | "wallet"
  | "activity"
  | "errors";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: Users },
  { key: "network", label: "1Network", icon: Network },
  { key: "contacts", label: "Contacts", icon: ContactIcon },
  { key: "earngpt", label: "EarnGPT", icon: MessageSquare },
  { key: "meetings", label: "Meetings", icon: Video },
  { key: "wallet", label: "Wallet", icon: Wallet },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "errors", label: "Errors", icon: AlertOctagon },
];

/** Avatar with an initials-on-gradient fallback for missing/broken images. */
function Avatar({
  src,
  name,
  className = "h-8 w-8 text-xs",
}: {
  src?: string;
  name?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImg = !!src && !failed;
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] font-semibold text-black ${className}`}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const [overview, setOverview] = useState<AdminUserOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once data loads again.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const data = await getAdminUserOverview(userId);
      setOverview(data);
      setError("");
      setNotFound(false);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 404) {
        setNotFound(true);
      } else if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchOverview();
          }
        });
        return;
      } else {
        setError("Failed to load user");
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const user = overview?.user;

  // Ghost user: the account record is gone (e.g. deleted/purged) while orphaned
  // data may still reference its id. Show a clean "no longer exists" screen
  // instead of the broken header + empty tabs.
  if (notFound) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] px-8 pb-8 pt-7 text-white">
        <button
          onClick={() => router.push("/garage-admin/networkchains/users")}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All users
        </button>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
            <UserX className="h-8 w-8 text-zinc-500" />
          </div>
          <h2 className="text-lg font-semibold text-white">This user no longer exists</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            This account has been removed. Any contacts or data still referencing
            it are orphaned and are no longer accessible here.
          </p>
          <button
            onClick={() => router.push("/garage-admin/networkchains/users")}
            className="mt-5 rounded-lg bg-[#FFC200] px-4 py-2 text-sm font-medium text-black hover:bg-[#FFB000]"
          >
            Back to all users
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] px-8 pb-8 pt-7 text-white">
      <button
        onClick={() => router.push("/garage-admin/networkchains/users")}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All users
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Avatar src={user?.profilePicture} name={user?.name} className="h-14 w-14 text-lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user?.name || (loadingOverview ? "…" : "Unknown user")}
          </h1>
          <p className="text-sm text-zinc-400">{user?.email || ""}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Counts */}
      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountCard label="Contacts" value={overview.counts.contacts} icon={ContactIcon} />
          <CountCard label="EarnGPT Chats" value={overview.counts.conversations} icon={MessageSquare} />
          <CountCard label="Meetings" value={overview.counts.meetings} icon={Video} />
          <CountCard label="Note Sessions" value={overview.counts.noteSessions} icon={Film} />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        {tab === "overview" && (
          <OverviewTab overview={overview} loading={loadingOverview} />
        )}
        {tab === "network" && <NetworkTab userId={userId} />}
        {tab === "contacts" && <ContactsTab userId={userId} />}
        {tab === "earngpt" && <EarnGPTTab userId={userId} />}
        {tab === "meetings" && <MeetingsTab userId={userId} />}
        {tab === "wallet" && <WalletTab userId={userId} />}
        {tab === "activity" && <ActivityTab userId={userId} />}
        {tab === "errors" && <ErrorsTab userId={userId} />}
      </div>
    </div>
  );
}

function CountCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

// ── Wallet tab ───────────────────────────────────────────────────────
function WalletTab({ userId }: { userId: string }) {
  const [wallet, setWallet] = useState<AdminUserWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Two independent operations against this tab's data — the background load
  // and the user-triggered credit action — each gets its own one-shot guard
  // so a 401 in one never consumes the other's single retry.
  const loadRecoveryAttempted = useRef(false);
  const creditRecoveryAttempted = useRef(false);

  // Tracks whether the credit dialog is still the one the operator is
  // looking at. Set false on unmount (tab switch) AND on an explicit
  // Cancel/X of the dialog — closing the dialog doesn't unmount this
  // component, so without this the queued re-elevation retry below would
  // still fire the wallet-credit POST after the operator dismissed it.
  const dialogActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      dialogActiveRef.current = false;
    };
  }, []);

  // Crediting a wallet is a write, so it needs "Full" on NC · Users.
  // contacts-backend answers 403 for a view-only grant regardless; hiding the
  // trigger keeps us from offering a button that can only fail.
  const { ready: accessReady, canManage } = useAdminAccess();
  const canCredit = accessReady && canManage("nc_users");

  function openCreditDialog() {
    dialogActiveRef.current = true;
    setDialogOpen(true);
  }

  function closeCreditDialog() {
    dialogActiveRef.current = false;
    setDialogOpen(false);
  }

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const w = await getAdminUserWallet(userId);
      setWallet(w);
      setError("");
      loadRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (loadRecoveryAttempted.current) return; // one attempt per failure episode
        loadRecoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchWallet();
          }
        });
        return;
      }
      setError("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const amountNum = Number(amount);
  const validAmount = amount.trim() !== "" && !Number.isNaN(amountNum) && amountNum > 0 && amountNum <= 10000;

  const handleCredit = useCallback(async () => {
    if (!validAmount) return;
    setSubmitting(true);
    try {
      const updated = await creditAdminUserWallet(userId, amountNum);
      setWallet(updated);
      toast.success(`Added $${amountNum.toFixed(2)} to wallet`);
      closeCreditDialog();
      setAmount("");
      setError("");
      creditRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (creditRecoveryAttempted.current) {
          setError("Session expired. Please try again.");
          return;
        }
        creditRecoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (!dialogActiveRef.current) return; // dismissed during elevation — no request, no state update
          if (result.ok === true) {
            handleCredit();
          } else {
            setError("Session expired. Please try again.");
          }
        });
        return;
      }
      setError("Failed to add credits");
      toast.error("Failed to add credits");
    } finally {
      setSubmitting(false);
    }
  }, [userId, amountNum, validAmount]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Balance + add credits */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
              <Wallet className="h-3 w-3" />
              Credits balance
            </div>
            <div className="mt-1 text-3xl font-semibold text-white">
              ${wallet?.balanceDollars ?? "0.00"}
            </div>
            {!!wallet && wallet.debtCents > 0 && (
              <div className="mt-1 text-xs text-amber-400">Outstanding debt ${wallet.debtDollars}</div>
            )}
          </div>
          {canCredit && (
            <Button size="sm" onClick={openCreditDialog} className="shrink-0">
              <Plus className="h-4 w-4" />
              Add credits
            </Button>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Recent transactions
        </h3>
        {!wallet || wallet.transactions.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {wallet.transactions.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-100">{t.description}</div>
                  <div className="text-[10px] text-zinc-500">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    t.type === "credit" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {t.type === "credit" ? "+" : "−"}${t.amountDollars}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (submitting) return; if (o) openCreditDialog(); else closeCreditDialog(); }}>
        <DialogContent className="sm:max-w-[400px] bg-[#0f0f0f] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-zinc-100">
              <Wallet className="h-4 w-4 text-[#FFC200]" />
              Add credits
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Amount (USD)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="10000"
              placeholder="0.00"
              value={amount}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && validAmount && !submitting) handleCredit(); }}
              disabled={submitting}
            />
            <p className="text-[11px] text-zinc-500">
              Added to the user&apos;s credits balance immediately. Any outstanding debt is cleared first.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreditDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCredit} disabled={!validAmount || submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Adding…</>
              ) : (
                <>Add{validAmount ? ` $${amountNum.toFixed(2)}` : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────
function OverviewTab({
  overview,
  loading,
}: {
  overview: AdminUserOverview | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
      </div>
    );
  }
  if (!overview) return <p className="py-8 text-center text-sm text-zinc-500">No data</p>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Contacts synced from
        </h3>
        {overview.syncedPlatforms.length === 0 ? (
          <p className="text-sm text-zinc-500">No synced contacts yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {overview.syncedPlatforms.map((p) => (
              <span
                key={p.platform}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs capitalize text-zinc-200"
              >
                {p.platform}
                <span className="rounded-full bg-[#FFC200]/20 px-1.5 text-[10px] text-[#FFD24D]">
                  {p.contactCount}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Connected accounts
        </h3>
        {overview.connectedAccounts.length === 0 ? (
          <p className="text-sm text-zinc-500">No connected accounts</p>
        ) : (
          <div className="space-y-2">
            {overview.connectedAccounts.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase text-zinc-300">
                    {a.platform}
                  </span>
                  <span className="text-sm text-zinc-200">{a.label || "—"}</span>
                  {a.verified && (
                    <span className="text-[10px] text-emerald-400">verified</span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500">
                  {a.connectedAt ? new Date(a.connectedAt).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 1Network tab ─────────────────────────────────────────────────────
// NC scopes the embedded globe to the TARGET user via AffiliateGlobeContext
// (an injection seam on the fetcher/root-user/org, backed by an
// admin-affiliate-proxy endpoint that mints a short-lived target-user JWT
// server-side) — see NC's app/(admin)/admin/users/[userId]/page.tsx:534.
// Garage's own components/affiliate/globe/* copy (used by the regular,
// non-admin Vaults/affiliate surfaces here) has NO such context at all —
// no AffiliateGlobeContext.tsx, no network-cache.ts — and its
// useAffiliateGlobe hook is hard-wired to the logged-in user ("me") via
// localStorage + @/lib/api, with no rootUserId/apiFetch injection point.
// This is structural, not a missing prop, and per this port's rules we do
// not modify Garage's shared globe copy (other surfaces depend on it; an
// injection seam is its own change with its own regression risk and
// deserves its own task). Rendering the globe unscoped here would show the
// signed-in ADMIN's own network under the VIEWED user's name — silently
// wrong data is worse than no data on a tool people make decisions from —
// so this tab renders a plain "not available" panel instead. Revisit once
// Garage's globe grows a per-user injection seam.
function NetworkTab({ userId }: { userId: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Network className="h-8 w-8 text-zinc-600" />
      <div className="text-sm font-medium text-white">
        1Network isn&apos;t available here yet
      </div>
      <div className="max-w-sm text-xs text-zinc-500">
        The 1Network globe can&apos;t be scoped to another user from the
        Garage admin console yet. View user{" "}
        <span className="font-mono">{userId}</span>&apos;s network in the
        NetworkChains admin panel for now.
      </div>
    </div>
  );
}

// ── Contacts tab ─────────────────────────────────────────────────────
function ContactsTab({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const recoveryAttempted = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUserContacts(userId, { search: debounced, page });
      setContacts(data.contacts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchData();
          }
        });
        return;
      }
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [userId, debounced, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">{total} contacts</span>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] pl-7 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-white/[0.2]"
          />
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">No contacts</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Company</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={c.imageUrl}
                        name={c.fullName || c.firstName}
                        className="h-7 w-7 text-[10px]"
                      />
                      <div>
                        <div className="text-zinc-100">{c.fullName || c.firstName || "—"}</div>
                        {c.jobTitle && <div className="text-[10px] text-zinc-500">{c.jobTitle}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-xs text-zinc-400">{c.company || "—"}</td>
                  <td className="py-2.5 text-xs text-zinc-400">{c.email || "—"}</td>
                  <td className="py-2.5">
                    {c.source?.platform && (
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] capitalize text-zinc-300">
                        {c.source.platform}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={totalPages} setPage={setPage} />
        </div>
      )}
    </div>
  );
}

// ── EarnGPT tab ──────────────────────────────────────────────────────
function EarnGPTTab({ userId }: { userId: string }) {
  const [convos, setConvos] = useState<AdminConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSession, setOpenSession] = useState<string | null>(null);

  const recoveryAttempted = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUserConversations(userId, { search: debounced, page });
      setConvos(data.conversations);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchData();
          }
        });
        return;
      }
      setError("Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, [userId, debounced, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (openSession) {
    return (
      <EarnGPTChatViewer
        userId={userId}
        sessionId={openSession}
        onBack={() => setOpenSession(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">{total} chats</span>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by contact..."
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] pl-7 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-white/[0.2]"
          />
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
        </div>
      ) : convos.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">No EarnGPT chats</p>
      ) : (
        <div className="space-y-2">
          {convos.map((c) => (
            <button
              key={c.sessionId}
              onClick={() => setOpenSession(c.sessionId)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={c.contact?.imageUrl} name={c.displayName} />
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-100">{c.displayName}</div>
                  {c.lastMessage && (
                    <div className="truncate text-[11px] text-zinc-500">
                      <span className="text-zinc-600">
                        {c.lastMessage.role === "user" ? "User: " : "EarnGPT: "}
                      </span>
                      {c.lastMessage.content}
                    </div>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-zinc-600">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
          <Pager page={page} totalPages={totalPages} setPage={setPage} />
        </div>
      )}
    </div>
  );
}

// ── Meetings tab ─────────────────────────────────────────────────────
function MeetingsTab({ userId }: { userId: string }) {
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [notes, setNotes] = useState<AdminNoteSession[]>([]);
  const [recordings, setRecordings] = useState<AdminRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(null);

  const recoveryAttempted = useRef(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const [m, n, r] = await Promise.all([
        getAdminUserMeetings(userId),
        getAdminUserNoteSessions(userId),
        getAdminUserRecordings(userId),
      ]);
      setMeetings(m.meetings);
      setNotes(n.sessions);
      setRecordings(r.recordings);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchMeetings();
          }
        });
        return;
      }
      setError("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  if (openNote) {
    return <MeetingDetail userId={userId} sessionId={openNote} onBack={() => setOpenNote(null)} />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
      </div>
    );
  }

  if (error) return <p className="py-8 text-center text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-8">
      {/* Notes & transcripts */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Notes &amp; Transcripts
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-500">No transcribed meetings</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <button
                key={n._id}
                onClick={() => setOpenNote(n._id)}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.05]"
              >
                <div>
                  <div className="text-sm text-zinc-100">{n.title || n.roomName}</div>
                  <div className="text-[10px] text-zinc-500">
                    {new Date(n.startedAt).toLocaleString()}
                    {n.durationSeconds ? ` · ${Math.round(n.durationSeconds / 60)} min` : ""}
                    {` · ${n.status}`}
                  </div>
                </div>
                <span className="text-[10px] text-[#FFC200]">View →</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recordings */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Recordings
        </h3>
        {recordings.length === 0 ? (
          <p className="text-sm text-zinc-500">No recordings</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recordings.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="truncate text-xs text-zinc-300">
                    {r.displayName || r.roomName}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {r.duration ? `${Math.round(r.duration / 60)} min` : ""}
                  </span>
                </div>
                {r.url ? (
                  <video
                    src={r.url}
                    controls
                    className="w-full rounded-md bg-black"
                    preload="metadata"
                  />
                ) : (
                  <p className="py-4 text-center text-[11px] text-zinc-500">
                    Recording unavailable
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Meeting history */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Meeting History
        </h3>
        {meetings.length === 0 ? (
          <p className="text-sm text-zinc-500">No meetings</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-zinc-500">
                  <th className="pb-2 font-medium">Room</th>
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Participants</th>
                  <th className="pb-2 font-medium">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2.5 text-xs text-zinc-200">{m.roomName}</td>
                    <td className="py-2.5 text-xs text-zinc-400">
                      {new Date(m.startedAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-xs text-zinc-400">
                      {m.durationSeconds ? `${Math.round(m.durationSeconds / 60)} min` : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-zinc-400">{m.peakParticipants}</td>
                    <td className="py-2.5 text-xs">
                      {m.wasRecorded ? (
                        <span className="text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-zinc-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Shared pager ─────────────────────────────────────────────────────
function Pager({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (fn: (p: number) => number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-1 text-xs text-zinc-400">
      <button
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page === 1}
        className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-30"
      >
        Prev
      </button>
      <span className="px-3 text-zinc-300">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-30"
      >
        Next
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Activity tab — PostHog event feed (page views, clicks, custom)
   ═══════════════════════════════════════════════════════════════════════ */

const WINDOW_OPTIONS: { hours: number; label: string }[] = [
  { hours: 24, label: "Last 24 h" },
  { hours: 24 * 7, label: "Last 7 d" },
  { hours: 24 * 30, label: "Last 30 d" },
];

function ActivityTab({ userId }: { userId: string }) {
  const [events, setEvents] = useState<AdminUserActivityEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [fromHours, setFromHours] = useState<number>(24 * 7);
  const [eventFilter, setEventFilter] = useState<string>("");

  const recoveryAttempted = useRef(false);

  const load = useCallback(
    async (opts: { append?: boolean; before?: string } = {}) => {
      if (opts.append) setLoadingMore(true);
      else {
        setLoading(true);
        setEvents([]);
      }
      setError("");
      try {
        const res = await getAdminUserActivity(userId, {
          limit: 100,
          fromHours,
          event: eventFilter || undefined,
          before: opts.before,
        });
        if (opts.append) setEvents((prev) => [...prev, ...res.events]);
        else setEvents(res.events);
        setCursor(res.nextCursor);
        setHasNext(res.hasNext);
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        if (e instanceof AdminUnauthorizedError) {
          if (recoveryAttempted.current) return; // one attempt per failure episode
          recoveryAttempted.current = true;
          ensureNcAdminToken().then((result) => {
            if (result.ok === true) {
              load(opts);
            }
          });
          return;
        }
        setError("Failed to load activity");
      } finally {
        if (opts.append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [userId, fromHours, eventFilter],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fromHours, eventFilter]);

  // Distinct event names in the current page — for the filter dropdown.
  const eventNames = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) if (e.event) s.add(e.event);
    return [...s].sort();
  }, [events]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w.hours}
              onClick={() => setFromHours(w.hours)}
              className={`rounded px-2.5 py-1 text-[11px] transition ${
                fromHours === w.hours
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-xs text-white outline-none focus:border-white/[0.15]"
        >
          <option value="">All event types</option>
          {eventNames.map((n) => (
            <option key={n} value={n} className="bg-[#111111]">
              {n}
            </option>
          ))}
        </select>
        <button
          onClick={() => load()}
          className="ml-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading activity…</span>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Activity className="h-8 w-8 text-zinc-600" />
          <div className="text-sm font-medium text-white">
            No activity in this window
          </div>
          <div className="text-xs text-zinc-500">
            Try widening the time range above.
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
            {events.map((e, i) => (
              <ActivityRow key={`${e.timestamp}-${i}`} event={e} />
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {events.length} event{events.length === 1 ? "" : "s"}
              {hasNext ? " (more available)" : ""}
            </span>
            {hasNext && cursor && (
              <button
                onClick={() => load({ append: true, before: cursor })}
                disabled={loadingMore}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
              >
                {loadingMore ? "Loading…" : "Load older"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityRow({ event }: { event: AdminUserActivityEvent }) {
  const Icon = eventIcon(event.event);
  const label = prettyEventLabel(event);
  const sub = subLabel(event);
  const replayHref =
    event.session_id && POSTHOG_PROJECT_URL
      ? `${POSTHOG_PROJECT_URL}/replay/${encodeURIComponent(event.session_id)}?t=${encodeURIComponent(
          event.timestamp,
        )}`
      : null;

  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          event.audit_flag === "true"
            ? "border border-[#FBD10D]/30 bg-[#FBD10D]/10 text-[#FBD10D]"
            : "border border-white/[0.06] bg-white/[0.03] text-zinc-400"
        }`}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-white">{label}</span>
          {event.audit_flag === "true" && (
            <span className="rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/10 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide text-[#FBD10D]">
              audit
            </span>
          )}
        </div>
        {sub && (
          <div className="mt-0.5 truncate text-[11px] text-zinc-500">{sub}</div>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
          <span>{new Date(event.timestamp).toLocaleString()}</span>
          {event.device_type && <span>· {event.device_type}</span>}
          {event.browser && <span>· {event.browser}</span>}
        </div>
      </div>
      {replayHref && (
        <a
          href={replayHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
          title="Open session replay in PostHog"
        >
          Replay
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </li>
  );
}

/** Public PostHog project URL for replay deep-links. Optional — env not
 *  set = replay button hidden but everything else still works. */
const POSTHOG_PROJECT_URL: string | undefined =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_URL;

function eventIcon(name: string) {
  if (name === "$pageview" || name === "$pageleave") return PageIcon;
  if (name === "$autocapture" || name === "$rageclick")
    return MousePointerClick;
  return Activity;
}

function prettyEventLabel(e: AdminUserActivityEvent): string {
  if (e.event === "$pageview") return e.pathname || e.url || "Page view";
  if (e.event === "$pageleave") return `Left ${e.pathname || e.url || "page"}`;
  if (e.event === "$autocapture")
    return e.el_text ? `Clicked "${e.el_text}"` : "Clicked element";
  if (e.event === "$rageclick")
    return e.el_text ? `Rage-clicked "${e.el_text}"` : "Rage clicked";
  return e.event;
}

function subLabel(e: AdminUserActivityEvent): string | null {
  if (e.event === "$pageview" || e.event === "$pageleave") return e.url || null;
  if (e.event === "$autocapture" || e.event === "$rageclick") {
    return e.url ? `on ${e.pathname || e.url}` : null;
  }
  return e.url || null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Errors tab — Sentry issues where this user's session hit an exception
   ═══════════════════════════════════════════════════════════════════════ */

const SENTRY_WINDOW_OPTIONS: { period: string; label: string }[] = [
  { period: "24h", label: "Last 24 h" },
  { period: "7d", label: "Last 7 d" },
  { period: "30d", label: "Last 30 d" },
  { period: "90d", label: "Last 90 d" },
];

function ErrorsTab({ userId }: { userId: string }) {
  const [issues, setIssues] = useState<AdminUserSentryIssue[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [statsPeriod, setStatsPeriod] = useState<string>("30d");
  const [includeResolved, setIncludeResolved] = useState(false);

  const recoveryAttempted = useRef(false);

  const load = useCallback(
    async (opts: { append?: boolean; cursor?: string } = {}) => {
      if (opts.append) setLoadingMore(true);
      else {
        setLoading(true);
        setIssues([]);
      }
      setError("");
      try {
        const res = await getAdminUserSentryIssues(userId, {
          statsPeriod,
          query: includeResolved ? "" : "is:unresolved",
          cursor: opts.cursor,
        });
        if (opts.append) setIssues((prev) => [...prev, ...res.issues]);
        else setIssues(res.issues);
        setCursor(res.nextCursor);
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        if (e instanceof AdminUnauthorizedError) {
          if (recoveryAttempted.current) return; // one attempt per failure episode
          recoveryAttempted.current = true;
          ensureNcAdminToken().then((result) => {
            if (result.ok === true) {
              load(opts);
            }
          });
          return;
        }
        setError("Failed to load errors");
      } finally {
        if (opts.append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [userId, statsPeriod, includeResolved],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, statsPeriod, includeResolved]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {SENTRY_WINDOW_OPTIONS.map((w) => (
            <button
              key={w.period}
              onClick={() => setStatsPeriod(w.period)}
              className={`rounded px-2.5 py-1 text-[11px] transition ${
                statsPeriod === w.period
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <input
            type="checkbox"
            checked={includeResolved}
            onChange={(e) => setIncludeResolved(e.target.checked)}
            className="h-3 w-3 accent-[#FBD10D]"
          />
          Include resolved
        </label>
        <button
          onClick={() => load()}
          className="ml-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading Sentry issues…</span>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <AlertOctagon className="h-8 w-8 text-zinc-600" />
          <div className="text-sm font-medium text-white">
            No Sentry issues in this window
          </div>
          <div className="text-xs text-zinc-500">
            Either this user hit nothing, or Sentry hasn&apos;t captured them
            yet. Try widening the range or including resolved.
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
            {issues.map((iss) => (
              <SentryIssueRow key={iss.id} issue={iss} />
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {issues.length} issue{issues.length === 1 ? "" : "s"}
              {cursor ? " (more available)" : ""}
            </span>
            {cursor && (
              <button
                onClick={() => load({ append: true, cursor })}
                disabled={loadingMore}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SentryIssueRow({ issue }: { issue: AdminUserSentryIssue }) {
  const levelColor: Record<string, string> = {
    fatal: "border-red-500/40 bg-red-500/15 text-red-300",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
    warning: "border-[#FBD10D]/30 bg-[#FBD10D]/10 text-[#FBD10D]",
    info: "border-white/[0.1] bg-white/[0.04] text-zinc-300",
    debug: "border-white/[0.1] bg-white/[0.04] text-zinc-500",
  };
  const chip = levelColor[String(issue.level ?? "error")] || levelColor.error;
  const isResolved = String(issue.status ?? "").toLowerCase() === "resolved";

  // Internal deep-link: use the admin Sentry viewer instead of sending admins
  // out to sentry.io (keeps our masked/privacy-safe rendering).
  const internalHref = `/garage-admin/networkchains/sentry/${encodeURIComponent(issue.id)}`;

  return (
    <li className="hover:bg-white/[0.02]">
      <a href={internalHref} className="flex items-start gap-3 px-4 py-3">
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${chip}`}
        >
          {issue.level || "error"}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-[13px] ${
                isResolved ? "text-zinc-400 line-through" : "text-white"
              }`}
            >
              {issue.title || issue.shortId || issue.id}
            </span>
            {issue.shortId && (
              <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0 text-[9px] text-zinc-400">
                {issue.shortId}
              </span>
            )}
            {isResolved && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide text-emerald-400">
                resolved
              </span>
            )}
          </div>
          {issue.culprit && (
            <div className="mt-0.5 truncate text-[11px] text-zinc-500">
              {issue.culprit}
            </div>
          )}
          {issue.metadata?.value && (
            <div className="mt-0.5 truncate text-[11px] text-zinc-400">
              {issue.metadata.value}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
            {issue.lastSeen && (
              <span>Last seen {new Date(issue.lastSeen).toLocaleString()}</span>
            )}
            {issue.count != null && <span>· {issue.count} events</span>}
            {issue.userCount != null && (
              <span>· {issue.userCount} users</span>
            )}
          </div>
        </div>
        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />
      </a>
    </li>
  );
}
