"use client";

/**
 * User Wallets — global bird's-eye list across every user × every wallet.
 *
 * Powers the use case: "show me every wallet, search by name/email, sort by
 * biggest balance, withdraw without drilling into each user one-by-one."
 *
 * Each row reuses the same `InitiateWithdrawalDialog` the per-user detail page
 * opens, so the withdrawal contract (fee + taxes + payout account) stays
 * single-sourced. On Withdraw click we fetch the canonical per-user wallets
 * via `getUserWallets()` and pass the matching wallet to the dialog so it
 * receives the freshest `withdrawableBalance` + populated `accounts` array.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  Wallet,
  Building2,
  Sparkles,
  Gift,
  ArrowUpRight,
  ArrowDownAZ,
  Activity,
  DollarSign,
  ChevronRight,
  Globe,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableSelectField } from "@/components/ui/searchable-select";
import { getCountryFlag } from "@/lib/country-flag";
import {
  listAllUserWallets,
  type UserWalletRow,
  type UserWalletType,
  type UserWalletsListFilters,
  type UserWalletCountry,
} from "@/lib/admin-api/user-wallets";
import { getUserWallets, type AdminUserWallet } from "@/lib/admin-api/users";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { InitiateWithdrawalDialog } from "@/components/admin/InitiateWithdrawalDialog";

const PAGE_SIZE = 50;

const TYPE_META: Record<
  UserWalletType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tint: string;
    pill: string;
  }
> = {
  store: {
    label: "Store",
    icon: Building2,
    tint: "text-[#FBD10D]",
    pill: "bg-[#FBD10D]/10 text-[#FBD10D] border-[#FBD10D]/20",
  },
  affiliate: {
    label: "Affiliate",
    icon: Wallet,
    tint: "text-emerald-400",
    pill: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  content_rewards: {
    label: "Content rewards",
    icon: Gift,
    tint: "text-violet-400",
    pill: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  },
};

function fmtMoney(usd: number, currency = "USD"): string {
  const sym = currency === "INR" ? "₹" : "$";
  return `${sym}${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtRelative(dateIso: string | null): string {
  if (!dateIso) return "never";
  const ms = Date.now() - new Date(dateIso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateIso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const TYPE_FILTERS: { id: UserWalletType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "store", label: "Store" },
  { id: "affiliate", label: "Affiliate" },
  { id: "content_rewards", label: "Content rewards" },
];

const SORT_FILTERS: {
  id: NonNullable<UserWalletsListFilters["sort"]>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "balance", label: "Biggest balance", icon: DollarSign },
  { id: "activity", label: "Recent activity", icon: Activity },
  { id: "name", label: "Name A → Z", icon: ArrowDownAZ },
];

export default function UserWalletsPage() {
  const [items, setItems] = useState<UserWalletRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [type, setType] = useState<UserWalletType | "all">("all");
  const [sort, setSort] =
    useState<NonNullable<UserWalletsListFilters["sort"]>>("balance");
  const [hasFunds, setHasFunds] = useState(false);
  const [country, setCountry] = useState<string>("");
  // Held separately from `items` so the dropdown keeps every option while a
  // country is selected — the server builds it before applying the filter.
  const [countries, setCountries] = useState<UserWalletCountry[]>([]);
  const [payout, setPayout] = useState<"any" | "yes" | "no">("any");
  const [payoutCounts, setPayoutCounts] = useState<{
    withAccount: number;
    withoutAccount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Withdraw flow — opens the dialog with the freshest per-user wallet doc
  // (which includes the accurate `withdrawableBalance` + populated accounts).
  const [withdrawWallet, setWithdrawWallet] = useState<AdminUserWallet | null>(
    null
  );
  const [withdrawUserId, setWithdrawUserId] = useState<string | null>(null);
  const [openingWithdraw, setOpeningWithdraw] = useState<string | null>(null);

  // Debounce the search input so we don't hammer the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Shared header search — filters this table server-side (debounced). Feeds
  // the same ?q= param as the toolbar box; the toolbar wins when both are set.
  const { query: headerSearch } = useAdminSearch();
  const [debouncedHeaderSearch, setDebouncedHeaderSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHeaderSearch(headerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [headerSearch]);

  const effectiveQuery = search || debouncedHeaderSearch;

  // Reset pagination whenever the filter set changes.
  useEffect(() => {
    setOffset(0);
  }, [effectiveQuery, type, sort, hasFunds, country, payout]);

  // Flag + name + how many wallets sit in that country. "" clears the filter.
  const countryOptions = useMemo(
    () => [
      { value: "", label: "All countries", keywords: "any all clear" },
      ...countries.map((c) => ({
        value: c.country,
        label: c.country,
        code: getCountryFlag(c.country),
        sublabel: `${c.count} wallet${c.count === 1 ? "" : "s"}`,
      })),
    ],
    [countries]
  );

  const filters: UserWalletsListFilters = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      q: effectiveQuery || undefined,
      type,
      sort,
      hasFunds,
      country: country || undefined,
      payout: payout === "any" ? undefined : payout,
    }),
    [offset, effectiveQuery, type, sort, hasFunds, country, payout]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listAllUserWallets(filters)
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        if (res.countries?.length) setCountries(res.countries);
        if (res.payoutCounts) setPayoutCounts(res.payoutCounts);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to load wallets"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  const reload = () => {
    listAllUserWallets(filters)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to refresh"));
  };

  async function handleWithdraw(row: UserWalletRow) {
    setOpeningWithdraw(row.walletId);
    try {
      // Refetch the canonical wallets for this user so the dialog has the
      // freshest `withdrawableBalance` + accounts array. Defensive: also
      // protects against stale rows (e.g. user added/removed an account
      // since the list was loaded).
      const data = await getUserWallets(row.user._id);
      const matched = data.wallets.find(
        (w) =>
          w.walletType === row.walletType &&
          String(w.orgId || "") === String(row.orgId || "")
      );
      if (!matched) {
        toast.error("That wallet isn't available any more — refresh the list.");
        return;
      }
      if (!matched.accounts.length) {
        toast.error(
          "This user hasn't added a payout account for that wallet yet."
        );
        return;
      }
      setWithdrawUserId(data.user.id);
      setWithdrawWallet(matched);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open the withdrawal dialog");
    } finally {
      setOpeningWithdraw(null);
    }
  }

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FBD10D]/5 border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-[#FBD10D]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              User Wallets
            </h1>
            <p className="text-xs text-[#7a7a8e] mt-1.5">
              Every user × every wallet. Search, sort, and withdraw without
              drilling in.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-[#2a2a35] bg-[#0d0d11] p-3 sm:p-4 mb-4 space-y-3">
        {/* Search + funds toggle */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a5a72] pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by user name or email…"
              className="pl-9 h-10 bg-[#0a0a10] border-[#2a2a35] focus-visible:border-[#FBD10D]/40 focus-visible:ring-0 text-[13px] text-white placeholder:text-[#3a3a45]"
            />
          </div>
          <button
            onClick={() => setHasFunds((v) => !v)}
            className={
              "inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border text-[11.5px] font-semibold tracking-wide transition-colors " +
              (hasFunds
                ? "bg-[#FBD10D]/10 border-[#FBD10D]/30 text-[#FBD10D]"
                : "bg-[#0a0a10] border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white")
            }
          >
            <DollarSign className="h-3.5 w-3.5" />
            Funded only
          </button>

          {/* Country — the console's searchable dropdown, not a native
              select: 51 options with flags and counts, filterable by typing. */}
          <SearchableSelectField
            options={countryOptions}
            value={country}
            onChange={setCountry}
            placeholder="All countries"
            searchPlaceholder="Search country…"
            emptyText="No country matches"
            align="end"
            className={
              "h-10 w-auto min-w-[168px] rounded-xl px-3 text-[11.5px] font-semibold tracking-wide " +
              (country
                ? "border-[#FBD10D]/30 bg-[#FBD10D]/10 text-[#FBD10D] hover:bg-[#FBD10D]/[0.14]"
                : "border-[#2a2a35] bg-[#0a0a10] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white")
            }
            contentClassName="w-[280px] border-[#2a2a35] bg-[#0d0d11]"
            renderValue={(o) => (
              <span className="flex items-center gap-2 truncate">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {o ? (
                  <>
                    <span className="shrink-0">{getCountryFlag(o.value)}</span>
                    <span className="truncate">{o.label}</span>
                  </>
                ) : (
                  <span className="truncate">All countries</span>
                )}
              </span>
            )}
          />
        </div>

        {/* Type + sort filter chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] mr-1">
              Type
            </span>
            {TYPE_FILTERS.map((f) => {
              const active = type === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setType(f.id)}
                  className={
                    "px-3 h-7 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all " +
                    (active
                      ? "bg-[#FBD10D]/10 border-[#FBD10D]/35 text-[#FBD10D]"
                      : "bg-[#0a0a10] border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white")
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {/* Payout destination. "Not set up" is the actionable one — those
              wallets cannot be withdrawn from at all, so this is the list of
              people to chase. Counts come from the server and are computed
              before the filter, so they never change as you toggle. */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] mr-1">
              Payout
            </span>
            {(
              [
                { id: "any", label: "All", count: null },
                { id: "yes", label: "Set up", count: payoutCounts?.withAccount ?? null },
                { id: "no", label: "Not set up", count: payoutCounts?.withoutAccount ?? null },
              ] as const
            ).map((f) => {
              const active = payout === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setPayout(f.id)}
                  className={
                    "inline-flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all " +
                    (active
                      ? "bg-[#FBD10D]/10 border-[#FBD10D]/35 text-[#FBD10D]"
                      : "bg-[#0a0a10] border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white")
                  }
                >
                  {f.id !== "any" && <Landmark className="h-3 w-3" />}
                  {f.label}
                  {f.count !== null && (
                    <span className={active ? "text-[#FBD10D]/70" : "text-[#5a5a72]"}>
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] mr-1">
              Sort
            </span>
            {SORT_FILTERS.map((f) => {
              const active = sort === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setSort(f.id)}
                  className={
                    "inline-flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all " +
                    (active
                      ? "bg-[#FBD10D]/10 border-[#FBD10D]/35 text-[#FBD10D]"
                      : "bg-[#0a0a10] border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white")
                  }
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results bar */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p className="text-[11px] text-[#7a7a8e] tabular-nums">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading wallets…
            </span>
          ) : (
            <>
              Showing <span className="text-white font-semibold">{showingFrom}</span>–
              <span className="text-white font-semibold">{showingTo}</span> of{" "}
              <span className="text-white font-semibold">
                {total.toLocaleString()}
              </span>
            </>
          )}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!canPrev || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="h-7 px-2 text-[11px] text-[#9fa0b8] hover:text-white"
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!canNext || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="h-7 px-2 text-[11px] text-[#9fa0b8] hover:text-white"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Rows */}
      {loading && items.length === 0 ? (
        <div className="rounded-2xl border border-[#2a2a35] bg-[#0d0d11] py-16 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#FBD10D]" />
          <p className="text-[12px] text-[#7a7a8e]">Loading user wallets…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2a35] bg-[#0d0d11] py-16 text-center">
          <Sparkles className="h-5 w-5 text-[#5a5a72] mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-white">
            No wallets match
          </p>
          <p className="text-[11px] text-[#7a7a8e] mt-1">
            Try a different search, type, country, or clear the “Funded only” toggle.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((row) => (
            <WalletListRow
              key={row.walletId}
              row={row}
              opening={openingWithdraw === row.walletId}
              onWithdraw={() => handleWithdraw(row)}
            />
          ))}
        </div>
      )}

      {/* Withdraw dialog — reused verbatim from the user-detail page */}
      {withdrawWallet && withdrawUserId && (
        <InitiateWithdrawalDialog
          userId={withdrawUserId}
          wallet={withdrawWallet}
          walletLabel={
            (TYPE_META[withdrawWallet.walletType]?.label || "Wallet") +
            (withdrawWallet.orgName ? ` · ${withdrawWallet.orgName}` : "")
          }
          open={!!withdrawWallet}
          onOpenChange={(o) => {
            if (!o) {
              setWithdrawWallet(null);
              setWithdrawUserId(null);
            }
          }}
          onDone={() => {
            setWithdrawWallet(null);
            setWithdrawUserId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function WalletListRow({
  row,
  opening,
  onWithdraw,
}: {
  row: UserWalletRow;
  opening: boolean;
  onWithdraw: () => void;
}) {
  const meta = TYPE_META[row.walletType];
  const Icon = meta.icon;
  const hasBalance = row.balance > 0;
  const canWithdraw = row.hasAccount && hasBalance;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#0d0d11] hover:border-[#3a3a45] transition-colors">
      {/* Status rail */}
      <span
        aria-hidden
        className={
          "absolute inset-y-0 left-0 w-[3px] " +
          (hasBalance
            ? row.walletType === "store"
              ? "bg-[#FBD10D]/45"
              : row.walletType === "affiliate"
                ? "bg-emerald-500/45"
                : "bg-violet-500/45"
            : "bg-[#2a2a35]")
        }
      />

      <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 pl-5">
        {/* Avatar */}
        <Link
          href={`/garage-admin/users/${row.user._id}`}
          className="shrink-0"
          title="Open user"
        >
          {row.user.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.user.profilePicture}
              alt=""
              className="h-11 w-11 rounded-xl object-cover border border-[#2a2a35]"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#FBD10D]/15 to-[#FBD10D]/[0.02] border border-[#FBD10D]/15 flex items-center justify-center text-[13px] font-black text-[#FBD10D]">
              {(row.user.name || row.user.email || "?")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}
        </Link>

        {/* User + type meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/garage-admin/users/${row.user._id}`}
              className="text-[13.5px] font-semibold text-white hover:text-[#FBD10D] transition-colors truncate"
            >
              {row.user.name || row.user.email || "Unknown user"}
            </Link>
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider border " +
                meta.pill
              }
            >
              <Icon className="h-2.5 w-2.5" />
              {meta.label}
            </span>
            {row.orgName && (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium bg-[#1a1a22] border border-[#2c2c3a] text-[#c7c7da]">
                <Building2 className="h-2.5 w-2.5 text-[#5a5a72]" />
                {row.orgName}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#5a5a72] truncate mt-0.5">
            {row.user.email || "—"}
            <span className="text-[#2a2a35] mx-1.5">·</span>
            Last activity {fmtRelative(row.lastTransactionAt)}
            {!row.hasAccount && (
              <>
                <span className="text-[#2a2a35] mx-1.5">·</span>
                <span className="text-[#9fa0b8]">No payout account</span>
              </>
            )}
          </p>
        </div>

        {/* Balance */}
        <div className="text-right shrink-0 mr-1">
          <p
            className={
              "text-[16px] font-black tabular-nums leading-none " +
              (hasBalance ? "text-white" : "text-[#5a5a72]")
            }
          >
            {fmtMoney(row.balance, row.currency)}
          </p>
          <p className="text-[9.5px] text-[#5a5a72] mt-1 uppercase tracking-wider">
            Balance
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canWithdraw ? (
            <button
              onClick={onWithdraw}
              disabled={opening}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#FBD10D]/10 border border-[#FBD10D]/25 text-[#FBD10D] text-[11.5px] font-bold hover:bg-[#FBD10D]/15 hover:shadow-[0_0_18px_-6px_rgba(251,209,13,0.5)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
              title="Initiate withdrawal"
            >
              {opening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5" />
              )}
              Withdraw
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#0a0a10] border border-[#2a2a35] text-[#5a5a72] text-[11px] font-medium cursor-not-allowed"
              title={
                !hasBalance
                  ? "Balance is zero"
                  : "User has no payout account for this wallet"
              }
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Withdraw
            </span>
          )}
          <Link
            href={`/garage-admin/users/${row.user._id}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#0a0a10] border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] transition-colors"
            title="Open user detail"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
