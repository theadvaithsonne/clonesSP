"use client";

// Affiliate Guests — Admin → Citizens → Affiliate Guests.
//
// Every user with at least one `organizations.$.guest === true` membership
// (the default state for OTP-signup users in GARAGE HQ + anyone founders
// admitted as a guest via a join request). Super-admin can graduate any
// individual membership to full-member (guest → false) with one click.
//
// Rendered through the same Bigin-style DataTable
// (components/data-table/*) as Founders / One Time Affiliates / Users so
// column resize, reorder, and layout persistence come for free. Endpoint
// returns the full (capped) list, so paging + footer totals are computed
// client-side; search stays server-side.
//
// Backend: GET /garage-admin/affiliate-guests → { success, rows, total, returned }
// PATCH   /garage-admin/affiliate-guests/:userId/orgs/:orgId/graduate

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { DataTable } from "@/components/data-table/DataTable";
import { applyColumnFilters } from "@/components/data-table/filter";
import type { ColumnDef } from "@/components/data-table/types";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import {
  Building2,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";

interface GuestMembership {
  orgId: string;
  orgName: string;
  orgIcon: string | null;
  role: string;
  joinedAt: string | null;
}

interface GuestRow {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  referredBy: string | null;
  createdAt: string;
  guestMemberships: GuestMembership[];
}

interface ListResponse {
  success: true;
  rows: GuestRow[];
  total: number;
  returned: number;
}

const RPP_OPTIONS = [10, 20, 30, 50, 100];

export default function AffiliateGuestsPage() {
  // Graduating a guest to a full member is a write on the
  // "affiliate_guests" page. A view-only role sees the list, not the
  // button that changes someone's membership.
  const { canManage } = useAdminAccess();
  const canGraduate = canManage("affiliate_guests");
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(30);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, string>>({});
  // Set of "userId::orgId" keys currently being graduated — disables the
  // specific row-button while the mutation is in flight.
  const [graduating, setGraduating] = useState<Set<string>>(new Set());
  const router = useRouter();

  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const res = await garageAdminApi<ListResponse>(
        `/garage-admin/affiliate-guests${
          qs.toString() ? `?${qs.toString()}` : ""
        }`,
      );
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } catch (error: any) {
      const msg = error?.message || "Failed to load affiliate guests";
      if (/invalid token|unauthor|401|expired/i.test(msg)) {
        try {
          localStorage.removeItem("garage_admin_token");
          localStorage.removeItem("garage_admin_info");
        } catch {}
        toast.error("Session expired — signing you out");
        router.push("/garage-admin/login");
        return;
      }
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGraduate(
    userId: string,
    orgId: string,
    label: string,
  ) {
    const key = `${userId}::${orgId}`;
    setGraduating((s) => new Set(s).add(key));
    try {
      const r = await garageAdminApi<{
        success: true;
        modified: number;
        alreadyGraduated: boolean;
      }>(`/garage-admin/affiliate-guests/${userId}/orgs/${orgId}/graduate`, {
        method: "PATCH",
      });
      if (r.alreadyGraduated) {
        toast.info(`${label} was already a full member`);
      } else {
        toast.success(`${label} graduated to full member`);
      }
      // Optimistic — drop the row locally so the admin doesn't wait for a
      // full refetch. Row disappears entirely once its last guest
      // membership is graduated (matches server-side filter).
      setRows((prev) =>
        prev
          .map((row) =>
            row.userId === userId
              ? {
                  ...row,
                  guestMemberships: row.guestMemberships.filter(
                    (m) => m.orgId !== orgId,
                  ),
                }
              : row,
          )
          .filter((row) => row.guestMemberships.length > 0),
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to graduate user");
    } finally {
      setGraduating((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  const columns = useMemo<ColumnDef<GuestRow>[]>(
    () => buildColumns({ graduating, onGraduate: handleGraduate, canGraduate }),
    // canGraduate resolves in an effect, so it flips from false to true on
    // the second render — leaving it out of the deps would freeze the
    // columns in their "no permission" shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graduating, canGraduate],
  );

  const filteredRows = useMemo(
    () => applyColumnFilters(rows, columns, filters),
    [rows, columns, filters],
  );

  const filteredTotal = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const rangeLabel = useMemo(() => {
    if (filteredTotal === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(filteredTotal, page * pageSize);
    return `${from} to ${to}`;
  }, [page, pageSize, filteredTotal]);

  // Footer totals describe the filtered set so numbers agree with the row
  // count shown above them.
  const totalMemberships = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.guestMemberships.length, 0),
    [filteredRows],
  );
  const referredCount = useMemo(
    () => filteredRows.filter((r) => !!r.referredBy).length,
    [filteredRows],
  );

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] flex-col">
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm font-medium text-white">
            Couldn&apos;t load affiliate guests
          </div>
          <div className="max-w-md text-xs text-zinc-500">{loadError}</div>
          <button
            onClick={load}
            className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
          >
            Retry
          </button>
        </div>
      ) : (
        <DataTable<GuestRow>
          tableId="garage-admin-affiliate-guests-v1"
          stickyBg="#181818"
          columns={columns}
          rows={pageRows}
          getRowId={(r) => r.userId}
          loading={loading}
          emptyLabel={
            debouncedSearch
              ? "No affiliate guests match your search."
              : "No affiliate guests yet — every user is already a full member."
          }
          filters={filters}
          onFiltersChange={setFilters}
          selectable
          selectedIds={selectedIds}
          allSelected={
            pageRows.length > 0 &&
            pageRows.every((r) => selectedIds.has(r.userId))
          }
          onToggleRow={(id) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleAll={() =>
            setSelectedIds((prev) => {
              const all = pageRows.every((r) => prev.has(r.userId));
              if (all) return new Set();
              return new Set(pageRows.map((r) => r.userId));
            })
          }
          topBar={
            selectedIds.size > 0 ? (
              <BulkActionBar
                count={selectedIds.size}
                onClear={() => setSelectedIds(new Set())}
              />
            ) : (
              <TopBar />
            )
          }
          footerTotals={[
            { label: "Guest Users", value: filteredTotal.toLocaleString() },
            {
              label: "Guest Memberships",
              value: totalMemberships.toLocaleString(),
            },
            { label: "Referred", value: referredCount.toLocaleString() },
            ...(total > rows.length
              ? [{ label: "Total (unpaged)", value: total.toLocaleString() }]
              : []),
          ]}
          pagination={{
            page,
            totalPages,
            rangeLabel,
            recordsPerPage: pageSize,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
            onRecordsPerPageChange: (n) => {
              setPageSize(n);
              setPage(1);
            },
          }}
        />
      )}
    </div>
  );
}

/* ── Top bars ── */

function BulkActionBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <div className="text-[13px] text-zinc-400">
        Bulk graduate isn&apos;t available yet — clear the selection to use
        the row actions.
      </div>
      <button
        type="button"
        onClick={onClear}
        className="flex h-8 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] pl-3 pr-2 text-[13px] text-zinc-200 hover:bg-white/[0.06]"
        title="Clear selection"
      >
        {count} Selected
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.1]">
          <X className="h-3 w-3" />
        </span>
      </button>
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="Filters"
          title="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Columns ── */

function buildColumns({
  graduating,
  onGraduate,
  canGraduate,
}: {
  graduating: Set<string>;
  onGraduate: (userId: string, orgId: string, label: string) => void;
  canGraduate: boolean;
}): ColumnDef<GuestRow>[] {
  return [
    {
      id: "user",
      header: "User",
      width: 260,
      minWidth: 220,
      filterable: true,
      filterAccessor: (r) =>
        `${r.name || ""} ${r.email || ""} ${r.phone || ""}`,
      frozen: true,
      cell: (r) => (
        <UserCell
          name={r.name}
          email={r.email}
          phone={r.phone}
          profilePicture={r.profilePicture}
        />
      ),
    },
    {
      id: "referred",
      header: "Referred",
      width: 120,
      minWidth: 100,
      filterable: true,
      filterAccessor: (r) => (r.referredBy ? "referred" : "direct"),
      cell: (r) => <ReferredPill referred={!!r.referredBy} />,
    },
    {
      id: "memberships",
      header: "Guest Memberships",
      width: 420,
      minWidth: 340,
      filterable: true,
      filterAccessor: (r) =>
        r.guestMemberships
          .map((m) => `${m.orgName} ${m.role}`)
          .join(" "),
      cell: (r) => (
        <MembershipsCell
          row={r}
          graduating={graduating}
          onGraduate={onGraduate}
          canGraduate={canGraduate}
        />
      ),
    },
    {
      id: "joined",
      header: "Joined",
      width: 140,
      minWidth: 120,
      filterable: true,
      filterAccessor: (r) => new Date(r.createdAt).toLocaleDateString(),
      cell: (r) => (
        <span className="text-[13px] text-zinc-200">
          {formatShortDate(r.createdAt)}
        </span>
      ),
    },
  ];
}

/* ── Cells ── */

function UserCell({
  name,
  email,
  phone,
  profilePicture,
}: {
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Avatar name={name || email || "?"} src={profilePicture} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-medium text-white">
          {name || "Unnamed user"}
        </div>
        <div className="truncate text-[11px] text-zinc-400">
          {email || "—"}
        </div>
        {phone && (
          <div className="mt-1 truncate text-[11px] text-zinc-500">
            {phone}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({
  name,
  src,
}: {
  name: string;
  src: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-white/[0.08] object-cover"
      />
    );
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}

function ReferredPill({ referred }: { referred: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        referred
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          : "border-white/10 bg-white/[0.04] text-zinc-400"
      }`}
    >
      {referred ? "Referred" : "Direct"}
    </span>
  );
}

function MembershipsCell({
  row,
  graduating,
  onGraduate,
  canGraduate,
}: {
  row: GuestRow;
  graduating: Set<string>;
  onGraduate: (userId: string, orgId: string, label: string) => void;
  canGraduate: boolean;
}) {
  if (row.guestMemberships.length === 0) {
    return <span className="text-zinc-600">—</span>;
  }
  return (
    <div className="flex flex-col gap-1.5 py-1">
      {row.guestMemberships.map((m) => {
        const key = `${row.userId}::${m.orgId}`;
        const busy = graduating.has(key);
        const label = `${row.name || row.email || row.userId} · ${m.orgName}`;
        return (
          <div
            key={m.orgId}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-zinc-400">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] text-zinc-100">
                {m.orgName}
              </div>
              <div className="truncate text-[10.5px] text-zinc-500">
                {m.role}
                {m.joinedAt && ` · joined ${formatShortDate(m.joinedAt)}`}
              </div>
            </div>
            {canGraduate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGraduate(row.userId, m.orgId, label);
                }}
                disabled={busy}
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#FBD10D] px-3 text-[11px] font-medium text-black transition hover:bg-[#f5c800] disabled:cursor-not-allowed disabled:opacity-50"
                title={`Graduate ${label} to full member`}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Graduate
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── helpers ── */

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

