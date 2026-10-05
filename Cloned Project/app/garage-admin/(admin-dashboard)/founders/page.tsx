"use client";

// Founders — Admin → Citizens → Founders.
//
// Every user who holds a founder membership on any org, rendered through the
// same reusable Bigin-style DataTable (components/data-table/*) as One Time
// Affiliates / Users, so column resize, reorder, and layout persistence come
// for free. The endpoint returns the full list (no server pagination), so
// paging + footer totals are computed client-side; search stays server-side.
//
// Backend: GET /garage-admin/founders (garagenew-backend controller
// getAllFounders) → { success, data: Founder[] }.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { getCountryFlag } from "@/lib/country-flag";
import { toast } from "sonner";
import {
  ChevronDown,
  SlidersHorizontal,
  Building2,
  Pencil,
  MoreHorizontal,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { applyColumnFilters } from "@/components/data-table/filter";
import type { ColumnDef } from "@/components/data-table/types";

interface Founder {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  department?: string;
  isVerified: boolean;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  phone?: string | null;
  profileComplete: boolean;
  organizations?: Array<{
    id: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
  legacyOrganization?: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

const RPP_OPTIONS = [10, 20, 30, 50, 100];

export default function FoundersPage() {
  const [founders, setFounders] = useState<Founder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(30);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const router = useRouter();

  // Shared header search — server-side, debounced.
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadFounders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  async function loadFounders() {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const res = await garageAdminApi<{ data: Founder[] }>(
        `/garage-admin/founders${qs.toString() ? `?${qs.toString()}` : ""}`,
        { method: "GET" },
      );
      setFounders(res?.data || []);
    } catch (error: any) {
      const msg = error?.message || "Failed to load founders";
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

  const columns = useMemo<ColumnDef<Founder>[]>(() => buildColumns(), []);

  // Client-side pagination — the endpoint returns the whole list.
  // Filter the full list, then page it — the other way round only ever
  // searches the page on screen.
  const filteredRows = useMemo(
    () => applyColumnFilters(founders, columns, filters),
    [founders, columns, filters],
  );

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );
  // A narrower result can be shorter than the page you're on, which would
  // show an empty table while rows sit on page 1.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to}`;
  }, [page, pageSize, total]);

  // Footer totals describe the filtered set, so they agree with the row count
  // above them rather than reporting the unfiltered table.
  const verifiedCount = useMemo(
    () => filteredRows.filter((f) => f.isVerified).length,
    [filteredRows],
  );
  const completeCount = useMemo(
    () => filteredRows.filter((f) => f.profileComplete).length,
    [filteredRows],
  );

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] flex-col">
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm font-medium text-white">
            Couldn&apos;t load founders
          </div>
          <div className="max-w-md text-xs text-zinc-500">{loadError}</div>
          <button
            onClick={loadFounders}
            className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
          >
            Retry
          </button>
        </div>
      ) : (
        <DataTable<Founder>
          tableId="garage-admin-founders-v1"
          stickyBg="#181818"
          columns={columns}
          rows={pageRows}
          getRowId={(r) => r.id}
          loading={loading}
          emptyLabel="No founders found."
          filters={filters}
          onFiltersChange={setFilters}
          onRowClick={(r) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(r.id)) next.delete(r.id);
              else next.add(r.id);
              return next;
            })
          }
          selectable
          selectedIds={selectedIds}
          allSelected={
            pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id))
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
              const all = pageRows.every((r) => prev.has(r.id));
              if (all) return new Set();
              return new Set(pageRows.map((r) => r.id));
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
            { label: "Founders", value: total.toLocaleString() },
            { label: "Verified", value: verifiedCount.toLocaleString() },
            { label: "Complete Profiles", value: completeCount.toLocaleString() },
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400"
        >
          <Pencil className="h-3.5 w-3.5" />
          Update Field
        </button>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-zinc-200 hover:bg-white/[0.06]"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
          More
        </button>
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
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 hover:bg-white/[0.06]"
        >
          <BrandDot className="h-4 w-4" />
          Entire Company
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>
    </div>
  );
}

/* ── Column definitions ── */

function buildColumns(): ColumnDef<Founder>[] {
  return [
    {
      id: "name",
      header: "Founder",
      width: 240,
      minWidth: 200,
      filterable: true,
      filterAccessor: (r) => `${r.name || ""} ${r.email || ""} ${r.phone || ""}`,
      frozen: true,
      cell: (r) => (
        <UserCell
          name={r.name}
          email={r.email}
          phone={r.phone ?? null}
          country={r.country ?? null}
        />
      ),
    },
    {
      id: "organizations",
      header: "Organization",
      width: 240,
      minWidth: 180,
      filterable: true,
      filterAccessor: (r) =>
        [
          ...(r.organizations || []).map((o) => o.name),
          r.legacyOrganization?.name || "",
        ].join(" "),
      cell: (r) => <OrgsCell founder={r} />,
    },
    {
      id: "location",
      header: "Location",
      width: 200,
      minWidth: 160,
      filterable: true,
      filterAccessor: (r) =>
        [r.city, r.state, r.country].filter(Boolean).join(" "),
      cell: (r) => (
        <LocationCell
          loc={{
            city: r.city ?? null,
            state: r.state ?? null,
            country: r.country ?? null,
          }}
        />
      ),
    },
    {
      id: "role",
      header: "Role",
      width: 130,
      minWidth: 100,
      filterable: true,
      filterAccessor: (r) => `${r.role || ""} ${r.department || ""}`,
      cell: (r) => (
        <span className="text-[13px] capitalize text-zinc-200">
          {r.role || "—"}
        </span>
      ),
    },
    {
      id: "verified",
      header: "Status",
      width: 140,
      minWidth: 110,
      filterable: true,
      filterAccessor: (r) => (r.isVerified ? "verified" : "unverified"),
      cell: (r) => (
        <StatusPill
          ok={r.isVerified}
          yes="Verified"
          no="Unverified"
        />
      ),
    },
    {
      id: "profile",
      header: "Profile",
      width: 150,
      minWidth: 110,
      filterable: true,
      filterAccessor: (r) =>
        r.profileComplete ? "complete" : "incomplete",
      cell: (r) => (
        <StatusPill
          ok={r.profileComplete}
          yes="Complete"
          no="Incomplete"
        />
      ),
    },
    {
      id: "joined",
      header: "Joined",
      width: 150,
      minWidth: 130,
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
  country,
}: {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Avatar name={name || email || "?"} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-medium text-white">
          {name || "Unnamed Founder"}
        </div>
        <div className="truncate text-[11px] text-zinc-400">{email || "—"}</div>
        {phone && (
          <div className="mt-1 flex items-center gap-1.5">
            {country && (
              <span className="text-[13px] leading-none" aria-hidden>
                {getCountryFlag(country)}
              </span>
            )}
            <span className="text-[11px] text-zinc-300">{phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}

function OrgsCell({ founder }: { founder: Founder }) {
  const orgs = [
    ...(founder.organizations || []).map((o) => o.name),
    ...(founder.legacyOrganization ? [founder.legacyOrganization.name] : []),
  ].filter(Boolean);
  if (!orgs.length) return <span className="text-zinc-600">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {orgs.slice(0, 3).map((name, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-300"
        >
          <Building2 className="h-2.5 w-2.5 text-blue-400" />
          <span className="max-w-[120px] truncate">{name}</span>
        </span>
      ))}
      {orgs.length > 3 && (
        <span className="text-[10px] text-zinc-500">+{orgs.length - 3}</span>
      )}
    </div>
  );
}

function LocationCell({
  loc,
}: {
  loc: { city: string | null; state: string | null; country: string | null };
}) {
  if (!loc || (!loc.city && !loc.state && !loc.country))
    return <span className="text-zinc-600">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-[13px] text-zinc-200">{loc.city || "—"}</div>
      {loc.state && (
        <div className="text-[12px] text-zinc-400">{loc.state}</div>
      )}
      {loc.country && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[13px] leading-none" aria-hidden>
            {getCountryFlag(loc.country)}
          </span>
          <span className="text-[12px] text-zinc-300">{loc.country}</span>
        </div>
      )}
    </div>
  );
}

function StatusPill({
  ok,
  yes,
  no,
}: {
  ok: boolean;
  yes: string;
  no: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          : "border-white/10 bg-white/[0.04] text-zinc-400"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {ok ? yes : no}
    </span>
  );
}

/* ── helpers ── */

function BrandDot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <rect x="11.2499" y="0" width="5.92097" height="23.6839" fill="#FBD10D" />
      <circle cx="4.49007" cy="19.1938" r="4.49007" fill="#FBD10D" />
      <circle cx="24.3472" cy="4.97071" r="4.97069" fill="#FBD10D" />
      <circle cx="24.3472" cy="18.7132" r="4.97069" fill="#FBD10D" />
    </svg>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
