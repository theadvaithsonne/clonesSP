"use client";

// Companies — Admin → Citizens → Companies.
//
// Every organization on Garage with its subscription lifecycle, member /
// customer counts, and GaragePay revenue. Same reusable Bigin-style
// DataTable as One Time Affiliates / Users.
//
// Backend: GET /garage-admin/organizations (controller getAllOrganizations)
// returns the whole list — no server pagination — so paging is client-side.
// "Assign"/"Change" posts to /garage-admin/organizations/:id/assign-admin,
// which is SUPER-ADMIN only; regular admins see the assignment read-only.

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  SlidersHorizontal,
  Pencil,
  MoreHorizontal,
  MoreVertical,
  X,
  Loader2,
  Check,
  Trash2,
} from "lucide-react";
import { garageAdminApi } from "@/lib/api";
import {
  getOrgDeletePreview,
  deleteAdminOrganization,
  type OrgDeletePreview,
} from "@/lib/admin-api/danger-zone";
import DangerConfirmDialog from "@/components/garage-admin/DangerConfirmDialog";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { DataTable } from "@/components/data-table/DataTable";
import { applyColumnFilters } from "@/components/data-table/filter";
import type { ColumnDef } from "@/components/data-table/types";
import { getCountryFlag } from "@/lib/country-flag";
import { InvoiceDetailDrawer } from "@/components/garage-admin/InvoiceDetailDrawer";
import { isSuperAdminClient } from "@/lib/admin-api/permissions";

type Founder = {
  id: string;
  name: string;
  email: string;
  profilePicture: string | null;
  /** Who referred this founder. Null for the root of the tree, and for
   *  accounts created before referral attribution existed. */
  upline: {
    id: string;
    name: string;
    email: string | null;
    profilePicture: string | null;
    affiliateId: string | null;
  } | null;
};

type AssignedAdmin = {
  id: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  assignedAt: string | null;
};

type InvoiceRef = { invoiceNumber: string; paidAt: string | null } | null;

type Row = {
  id: string;
  name: string;
  icon: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  founders: Founder[];
  createdAt: string;
  status: "paid" | "active" | "registered";
  assignedTo: AssignedAdmin | null;
  subscription: {
    planSlug: string | null;
    startedAt: string | null;
    startInvoice: InvoiceRef;
    lastPayment: InvoiceRef;
    nextPaymentDate: string | null;
    paymentsCount: number;
    cycle: number;
    totalCollectedUsd: number;
  };
  counts: {
    members: number;
    customers: number;
    affiliates: number;
    totalOrders: number;
  };
  revenue: {
    totalSoldUsd: number;
    platformFeePercentage: number | null;
    totalCollectedFromFeesUsd: number;
    commissionsPaidUsd: number;
    franchisePayoutsUsd: number;
  };
};

type AdminOption = {
  id: string;
  name: string | null;
  email: string;
  profilePicture: string | null;
  isSuperAdmin?: boolean;
  isMe?: boolean;
  isActive?: boolean;
};

const RPP_OPTIONS = [10, 20, 30, 50, 100];

/**
 * Which slice of companies this table shows. The same page backs three routes:
 * /companies (all), /companies/paid and /companies/free — the last two simply
 * re-export this component. Read from the path rather than a query string so
 * each gets its own sidebar entry and its own highlighted state.
 */
type PlanScope = "all" | "paid" | "free";

function planFromPath(pathname: string | null): PlanScope {
  if (pathname?.endsWith("/companies/paid")) return "paid";
  if (pathname?.endsWith("/companies/free")) return "free";
  return "all";
}

const PLAN_LABEL: Record<PlanScope, string> = {
  all: "Companies",
  paid: "Paid companies",
  free: "Free companies",
};

export default function CompaniesPage() {
  const plan = planFromPath(usePathname());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  // Org whose assign-admin picker is open (null = closed).
  const [assignFor, setAssignFor] = useState<Row | null>(null);
  // Assigning an account owner is super-admin only.
  const { isSuperAdmin: canAssignOwner } = useAdminAccess();
  const router = useRouter();

  // ── Delete a company ────────────────────────────────────────────────────
  // Permanent, and nothing cascades: the company's invoices, products and
  // files stay in the database. The preview runs first so the confirmation
  // can show how much will be left pointing at a company that's gone.
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deletePreview, setDeletePreview] = useState<OrgDeletePreview | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedRow = useMemo(
    () =>
      selectedIds.size === 1
        ? rows.find((r) => selectedIds.has(r.id)) || null
        : null,
    [selectedIds, rows],
  );

  const openDelete = async (row: Row) => {
    setDeleteTarget(row);
    setDeletePreview(null);
    setDeleteError(null);
    setPreviewLoading(true);
    try {
      setDeletePreview(await getOrgDeletePreview(row.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await deleteAdminOrganization(
        deleteTarget.id,
        deleteTarget.name,
      );
      toast.success(
        res.membersDetached > 0
          ? `Deleted ${deleteTarget.name} — ${res.membersDetached} member${
              res.membersDetached === 1 ? "" : "s"
            } detached`
          : `Deleted ${deleteTarget.name}`,
      );
      setDeleteTarget(null);
      setSelectedIds(new Set());
      load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Bulk delete (2+ selected) ──────────────────────────────────────────
  // No combined preview (that would be N lookups); one typed "DELETE"
  // confirmation, then the same per-company danger-zone endpoint runs for
  // each. Each company's own name is sent as its confirmName — the server
  // still re-checks it — so no per-company typing is needed.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const runBulkDelete = async () => {
    const targets = selectedRows.filter((r) => r.name);
    if (targets.length === 0) {
      setBulkError("None of the selected companies have a name to confirm against.");
      return;
    }
    setBulkBusy(true);
    setBulkError(null);
    setBulkProgress({ done: 0, total: targets.length });
    let ok = 0;
    let detached = 0;
    const failed: string[] = [];
    for (const t of targets) {
      try {
        const res = await deleteAdminOrganization(t.id, t.name);
        ok++;
        detached += res?.membersDetached || 0;
      } catch {
        failed.push(t.name);
      }
      setBulkProgress({ done: ok + failed.length, total: targets.length });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    setBulkOpen(false);
    setSelectedIds(new Set());
    if (failed.length === 0) {
      toast.success(
        `Deleted ${ok} compan${ok === 1 ? "y" : "ies"}` +
          (detached ? ` — ${detached} member${detached === 1 ? "" : "s"} detached` : ""),
      );
    } else {
      toast.error(
        `Deleted ${ok}, failed ${failed.length}: ${failed
          .slice(0, 3)
          .join(", ")}${failed.length > 3 ? "…" : ""}`,
      );
    }
    load();
  };

  useEffect(() => {
    // Refetch when the table changes. The paid/free routes usually remount this
    // component anyway, but depending on `plan` means a reused instance can
    // never keep showing the previous table's rows under the new heading.
    setSelectedIds(new Set());
    setPage(1);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // A narrower result set can be shorter than the page you're on, which would
  // show an empty table with rows sitting on page 1.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      // Filtered server-side: "paid" is decided by paid-plan invoices, which
      // the row does not carry in full, so the browser cannot split it.
      const res = await garageAdminApi<{ data: Row[] }>(
        plan === "all"
          ? "/garage-admin/organizations"
          : `/garage-admin/organizations?plan=${plan}`,
        { method: "GET" },
      );
      setRows(res?.data || []);
    } catch (error: any) {
      const msg = error?.message || "Failed to load companies";
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

  // Patch one row in place after an assignment so the table doesn't refetch.
  function applyAssignment(orgId: string, admin: AssignedAdmin | null) {
    setRows((prev) =>
      prev.map((r) => (r.id === orgId ? { ...r, assignedTo: admin } : r)),
    );
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      buildColumns(
        (n) => setOpenInvoice(n),
        (row) => setAssignFor(row),
        canAssignOwner,
      ),
    // canAssignOwner resolves in an effect, so it flips on the second
    // render; without it in the deps the pills never appear for a super
    // admin.
    [canAssignOwner],
  );

  // Filter the whole dataset, then page it — filtering `pageRows` would only
  // ever search the page you're looking at.
  const filteredRows = useMemo(
    () => applyColumnFilters(rows, columns, filters),
    [rows, columns, filters],
  );

  // Everything downstream counts the FILTERED set: a footer reading "146
  // Companies" under 3 visible rows, or a pager offering page 8 of a 3-row
  // result, is the filter looking broken.
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to}`;
  }, [page, pageSize, total]);

  const totalCollected = useMemo(
    () =>
      filteredRows.reduce(
        (n, r) => n + (r.subscription?.totalCollectedUsd || 0),
        0,
      ),
    [filteredRows],
  );

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] flex-col">
      <InvoiceDetailDrawer
        invoiceNumber={openInvoice}
        onClose={() => setOpenInvoice(null)}
      />
      <AssignAdminDialog
        org={assignFor}
        onClose={() => setAssignFor(null)}
        onAssigned={applyAssignment}
      />
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm font-medium text-white">
            Couldn&apos;t load companies
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
        <DataTable<Row>
          tableId="garage-admin-companies-v1"
          stickyBg="#181818"
          columns={columns}
          rows={pageRows}
          getRowId={(r) => r.id}
          loading={loading}
          emptyLabel="No companies yet."
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
                selectedRow={selectedRow}
                onClear={() => setSelectedIds(new Set())}
                onDelete={() =>
                  selectedRow ? openDelete(selectedRow) : setBulkOpen(true)
                }
              />
            ) : (
              <TopBar />
            )
          }
          footerTotals={[
            { label: PLAN_LABEL[plan], value: total.toLocaleString() },
            { label: "Total Collected", value: formatMoney(totalCollected) },
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

      <DangerConfirmDialog
        open={!!deleteTarget}
        title="Delete company"
        subject={deleteTarget?.name || ""}
        confirmValue={deleteTarget?.name || ""}
        confirmLabel="Type the company name to confirm"
        dependents={deletePreview?.dependents || []}
        totalDependents={deletePreview?.totalDependents || 0}
        countsCapped={deletePreview?.countsCapped || false}
        extraNote={
          deletePreview && deletePreview.members > 0
            ? `${deletePreview.members} member${
                deletePreview.members === 1 ? "" : "s"
              } will be removed from this workspace.`
            : null
        }
        loading={previewLoading}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
      />

      {/* Bulk delete — 2+ selected. One "DELETE" confirmation, then each
          company is removed via the same danger-zone endpoint. */}
      <DangerConfirmDialog
        open={bulkOpen}
        title={`Delete ${selectedRows.length} companies`}
        subject={`${selectedRows.length} selected companies`}
        confirmValue="DELETE"
        confirmLabel='Type DELETE to confirm'
        dependents={[]}
        totalDependents={0}
        extraNote={
          (bulkProgress
            ? `Deleting ${bulkProgress.done} of ${bulkProgress.total}… `
            : "") +
          `Each company is permanently removed and its members detached — this can't be undone. ` +
          selectedRows
            .slice(0, 6)
            .map((r) => r.name)
            .join(", ") +
          (selectedRows.length > 6 ? `, +${selectedRows.length - 6} more` : "")
        }
        busy={bulkBusy}
        error={bulkError}
        onCancel={() => {
          if (bulkBusy) return;
          setBulkOpen(false);
          setBulkError(null);
        }}
        onConfirm={runBulkDelete}
      />
    </div>
  );
}

/* ── Assign admin ── */

function AssignAdminDialog({
  org,
  onClose,
  onAssigned,
}: {
  org: Row | null;
  onClose: () => void;
  onAssigned: (orgId: string, admin: AssignedAdmin | null) => void;
}) {
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Both the admin list and the assign itself are super-admin only. A
  // delegated admin can hold "organizations: view" and reach this page, so
  // don't fire a request that will only ever 403 them.
  const canAssign = isSuperAdminClient();

  useEffect(() => {
    if (!org || !canAssign) return;
    let cancelled = false;
    setLoading(true);
    garageAdminApi<{ data: AdminOption[] }>("/garage-admin/admins", {
      method: "GET",
    })
      .then((res) => {
        if (!cancelled) setAdmins(res?.data || []);
      })
      .catch((e: any) => {
        if (!cancelled) toast.error(e?.message || "Failed to load admins");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org, canAssign]);

  useEffect(() => {
    if (!org) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [org, onClose]);

  if (!org) return null;

  // adminId null clears the assignment (backend treats null as unassign).
  async function submit(adminId: string | null, admin: AdminOption | null) {
    if (!org) return;
    setSaving(adminId ?? "__clear__");
    try {
      await garageAdminApi(
        `/garage-admin/organizations/${org.id}/assign-admin`,
        { method: "POST", body: JSON.stringify({ adminId }) },
      );
      onAssigned(
        org.id,
        admin
          ? {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              profilePicture: admin.profilePicture,
              assignedAt: new Date().toISOString(),
            }
          : null,
      );
      toast.success(admin ? `Assigned to ${admin.name || admin.email}` : "Unassigned");
      onClose();
    } catch (e: any) {
      // Only the super admin may assign; surface the server's reason.
      toast.error(e?.message || "Failed to assign");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-[420px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Assign account owner
            </p>
            <p className="truncate text-base font-bold text-white">{org.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-2">
          {!canAssign ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-400">
              Assigning an account owner is super-admin only.
            </div>
          ) : loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : admins.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">
              No admins found.
            </p>
          ) : (
            admins.map((a) => {
              const isCurrent = org.assignedTo?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => submit(a.id, a)}
                  disabled={!!saving}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <Avatar src={a.profilePicture} name={a.name || a.email} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-medium text-white">
                      {a.name || "Unnamed"}
                      {a.isSuperAdmin && (
                        <span className="ml-1.5 rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#FBD10D]">
                          SUPER
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {a.email}
                    </div>
                  </div>
                  {saving === a.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                  ) : isCurrent ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {org.assignedTo && (
          <div className="border-t border-white/[0.06] p-3">
            <button
              onClick={() => submit(null, null)}
              disabled={!!saving}
              className="w-full rounded-lg border border-red-500/25 bg-red-500/10 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {saving === "__clear__" ? "Removing…" : "Remove assignment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Top bars ── */

function BulkActionBar({
  count,
  selectedRow,
  onClear,
  onDelete,
}: {
  count: number;
  /**
   * The company to act on — null unless exactly one row is selected. Deleting
   * is permanent and needs its own typed confirmation, so a multi-select would
   * either skip that check or ask once per row.
   */
  selectedRow: Row | null;
  onClear: () => void;
  onDelete: () => void;
}) {
  // Deleting a company is danger-zone, super-admin only; "Update Field"
  // writes too. A role with "organizations: view" reaches this page, so
  // neither should be on screen for them.
  const { isSuperAdmin, canManage } = useAdminAccess();
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2">
        {canManage("organizations") && (
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400"
          >
            <Pencil className="h-3.5 w-3.5" />
            Update Field
          </button>
        )}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-4 text-sm text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {selectedRow ? "Delete company" : `Delete ${count} companies`}
          </button>
        )}
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
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FBD10D] text-black hover:bg-[#e5be0c]"
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
          All Users
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 hover:bg-white/[0.06]"
        >
          <BrandDot className="h-4 w-4" />
          User
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="More"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Column definitions ── */

function buildColumns(
  onInvoiceClick: (invoiceNumber: string) => void,
  onAssign: (row: Row) => void,
  canAssign: boolean,
): ColumnDef<Row>[] {
  return [
    {
      id: "company",
      header: "Company Name",
      width: 190,
      minWidth: 160,
      filterable: true,
      filterAccessor: (r) => `${r.name} ${r.status}`,
      frozen: true,
      cell: (r) => (
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <OrgIcon src={r.icon} name={r.name} />
            <span className="truncate text-[13px] font-medium text-white">
              {r.name}
            </span>
          </div>
          <div className="mt-2 text-[12px] capitalize text-zinc-400">
            {r.status}
          </div>
        </div>
      ),
    },
    {
      id: "founder",
      header: "Founder Details",
      width: 230,
      minWidth: 190,
      filterable: true,
      filterAccessor: (r) =>
        r.founders.map((f) => `${f.name || ""} ${f.email || ""}`).join(" "),
      cell: (r) => <FounderCell founders={r.founders} />,
    },
    {
      id: "founderUpline",
      header: "Founder's Upline",
      width: 230,
      minWidth: 190,
      filterable: true,
      // Searchable by the upline's affiliate code too — that's the value an
      // admin usually has in hand when checking who a company sits under.
      filterAccessor: (r) =>
        r.founders
          .map((f) =>
            f.upline
              ? `${f.upline.name || ""} ${f.upline.email || ""} ${f.upline.affiliateId || ""}`
              : "",
          )
          .join(" "),
      cell: (r) => <UplineCell founders={r.founders} />,
    },
    {
      id: "assignedTo",
      header: "Assigned To",
      width: 230,
      minWidth: 190,
      filterable: true,
      filterAccessor: (r) =>
        r.assignedTo
          ? `${r.assignedTo.name || ""} ${r.assignedTo.email || ""}`
          : "Unassigned",
      cell: (r) =>
        r.assignedTo ? (
          <div className="leading-tight">
            <div className="flex items-start gap-2.5 py-1">
              <Avatar
                src={r.assignedTo.profilePicture}
                name={r.assignedTo.name || r.assignedTo.email || "?"}
              />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-medium text-white">
                  {r.assignedTo.name || "Unnamed"}
                </div>
                <div className="truncate text-[11px] text-zinc-400">
                  {r.assignedTo.email}
                </div>
              </div>
            </div>
            {canAssign && (
              <PillButton label="Change" onClick={() => onAssign(r)} />
            )}
          </div>
        ) : (
          <div className="flex h-full items-center">
            {canAssign ? (
              <PillButton label="Assign" onClick={() => onAssign(r)} />
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </div>
        ),
    },
    {
      id: "location",
      header: "Location",
      width: 180,
      minWidth: 150,
      filterable: true,
      filterAccessor: (r) =>
        [r.city, r.state, r.country].filter(Boolean).join(" "),
      cell: (r) => (
        <LocationCell
          loc={{ city: r.city, state: r.state, country: r.country }}
        />
      ),
    },
    {
      id: "creation",
      header: "Creation Date",
      width: 150,
      minWidth: 130,
      filterable: true,
      filterAccessor: (r) => new Date(r.createdAt).toLocaleDateString(),
      cell: (r) => (
        <div className="leading-tight">
          <div className="text-[13px] text-zinc-200">
            {formatShortDate(r.createdAt)}
          </div>
          <div className="mt-1 text-[12px] text-zinc-400">
            {daysAgo(r.createdAt)}
          </div>
        </div>
      ),
    },
    {
      id: "subscriptionStart",
      header: "Subscription Start Details",
      width: 165,
      minWidth: 140,
      filterable: true,
      filterAccessor: (r) =>
        `${r.subscription.planSlug || ""} ${r.subscription.startInvoice?.invoiceNumber || ""}`,
      cell: (r) => (
        <DateInvoiceCell
          date={r.subscription?.startedAt}
          invoice={r.subscription?.startInvoice}
          onInvoiceClick={onInvoiceClick}
        />
      ),
    },
    {
      id: "lastPayment",
      header: "Last Payment Details",
      width: 160,
      minWidth: 140,
      filterable: true,
      filterAccessor: (r) => r.subscription.lastPayment?.invoiceNumber || "",
      cell: (r) => (
        <DateInvoiceCell
          date={r.subscription?.lastPayment?.paidAt ?? null}
          invoice={r.subscription?.lastPayment}
          onInvoiceClick={onInvoiceClick}
        />
      ),
    },
    {
      id: "nextPayment",
      header: "Next Payment Date",
      width: 160,
      minWidth: 140,
      filterable: true,
      filterAccessor: (r) =>
        r.subscription.nextPaymentDate
          ? new Date(r.subscription.nextPaymentDate).toLocaleDateString()
          : "",
      cell: (r) => (
        <span className="text-[13px] text-zinc-200">
          {r.subscription?.nextPaymentDate
            ? formatShortDate(r.subscription.nextPaymentDate)
            : "—"}
        </span>
      ),
    },
    {
      id: "payments",
      header: "Payments",
      width: 100,
      minWidth: 80,
      cell: (r) => (
        <span className="text-zinc-200">
          {r.subscription?.paymentsCount ?? 0}
        </span>
      ),
    },
    {
      id: "cycle",
      header: "Cycle",
      width: 90,
      minWidth: 70,
      cell: (r) => (
        <span className="text-zinc-200">{ordinal(r.subscription?.cycle ?? 0)}</span>
      ),
    },
    {
      id: "totalCollected",
      header: "Total Collected",
      width: 130,
      minWidth: 110,
      cell: (r) => <Money value={r.subscription?.totalCollectedUsd ?? 0} />,
    },
    {
      id: "members",
      header: "Members",
      width: 110,
      minWidth: 90,
      cell: (r) => <span className="text-zinc-200">{r.counts?.members ?? 0}</span>,
    },
    {
      id: "customers",
      header: "Customers",
      width: 110,
      minWidth: 90,
      cell: (r) => (
        <span className="text-zinc-200">{r.counts?.customers ?? 0}</span>
      ),
    },
    {
      id: "affiliates",
      header: "Affiliates",
      width: 110,
      minWidth: 90,
      cell: (r) => (
        <span className="text-zinc-200">{r.counts?.affiliates ?? 0}</span>
      ),
    },
    {
      id: "totalSold",
      header: "Total Sold",
      width: 120,
      minWidth: 100,
      cell: (r) => <Money value={r.revenue?.totalSoldUsd ?? 0} />,
    },
    {
      id: "garagePayFees",
      header: "GaragePay Fees",
      width: 140,
      minWidth: 120,
      cell: (r) => (
        <div className="leading-tight">
          <div className="text-[13px] text-zinc-200">
            {r.revenue?.platformFeePercentage != null
              ? `${r.revenue.platformFeePercentage.toFixed(2)}%`
              : "—"}
          </div>
          <PillButton
            label="Change"
            onClick={() => toast.message("Fee editing not wired up yet")}
          />
        </div>
      ),
    },
    {
      id: "totalCollectedFromFees",
      header: "Total Collected From Fees",
      width: 165,
      minWidth: 140,
      cell: (r) => <Money value={r.revenue?.totalCollectedFromFeesUsd ?? 0} />,
    },
    {
      id: "franchisePayouts",
      header: "GaragePay Franchise Payouts",
      width: 180,
      minWidth: 150,
      // Backend reports 0 until seller-org attribution exists on the
      // territory transaction rows.
      cell: (r) => <Money value={r.revenue?.franchisePayoutsUsd ?? 0} />,
    },
    {
      id: "totalOrders",
      header: "Total Orders",
      width: 120,
      minWidth: 100,
      cell: (r) => (
        <span className="text-zinc-200">{r.counts?.totalOrders ?? 0}</span>
      ),
    },
    {
      id: "commissionsPaid",
      header: "Commissions Paid",
      width: 140,
      minWidth: 120,
      cell: (r) => <Money value={r.revenue?.commissionsPaidUsd ?? 0} />,
    },
  ];
}

/* ── Cells ── */

function FounderCell({ founders }: { founders: Founder[] }) {
  const f = founders?.[0];
  if (!f) return <span className="text-zinc-600">—</span>;
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Avatar src={f.profilePicture} name={f.name || f.email} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-medium text-white">
          {f.name || "Unnamed"}
        </div>
        <div className="truncate text-[11px] text-zinc-400">{f.email}</div>
        {founders.length > 1 && (
          <div className="mt-1 text-[10px] text-zinc-500">
            +{founders.length - 1} more
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Who referred the founder. Mirrors FounderCell so the two columns read as a
 * pair — same avatar, same two lines — with the upline's affiliate code
 * underneath, since that is what an admin usually needs to copy.
 *
 * Follows the founder column's convention of showing the FIRST founder, so the
 * two columns always describe the same person on a multi-founder company.
 */
function UplineCell({ founders }: { founders: Founder[] }) {
  const f = founders?.[0];
  const up = f?.upline;
  if (!f) return <span className="text-zinc-600">—</span>;
  if (!up) {
    return (
      <span className="text-[12px] text-zinc-600" title="This founder has no referrer">
        No upline
      </span>
    );
  }
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Avatar src={up.profilePicture} name={up.name || up.email || "?"} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-medium text-white">
          {up.name || "Unnamed"}
        </div>
        <div className="truncate text-[11px] text-zinc-400">{up.email || "—"}</div>
        {up.affiliateId && (
          <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
            {up.affiliateId}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
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
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}

function OrgIcon({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-[11px] font-semibold text-black">
      {(name || "?").trim().charAt(0).toUpperCase()}
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
      {loc.state && <div className="text-[12px] text-zinc-400">{loc.state}</div>}
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

function DateInvoiceCell({
  date,
  invoice,
  onInvoiceClick,
}: {
  date: string | null | undefined;
  invoice: InvoiceRef;
  onInvoiceClick: (invoiceNumber: string) => void;
}) {
  if (!date && !invoice) return <span className="text-zinc-600">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-[13px] text-zinc-200">
        {date ? formatShortDate(date) : "—"}
      </div>
      {invoice?.invoiceNumber && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInvoiceClick(invoice.invoiceNumber);
          }}
          className="mt-1 text-[12px] text-zinc-300 underline underline-offset-2 hover:text-[#FBD10D]"
        >
          {invoice.invoiceNumber}
        </button>
      )}
    </div>
  );
}

function PillButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="mt-2 inline-flex h-6 items-center rounded-full border border-white/[0.12] bg-white/[0.04] px-3 text-[11px] text-zinc-200 hover:bg-white/[0.08]"
    >
      {label}
    </button>
  );
}

function Money({ value }: { value: number }) {
  return (
    <span className="text-[13px] tabular-nums text-zinc-200">
      {formatMoney(value)}
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

function daysAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const days = Math.max(0, Math.floor((Date.now() - d) / 86400000));
  if (days === 0) return "Today";
  return `${days} Day${days === 1 ? "" : "s"} Ago`;
}

function ordinal(n: number): string {
  if (!n) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function formatMoney(amount: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
