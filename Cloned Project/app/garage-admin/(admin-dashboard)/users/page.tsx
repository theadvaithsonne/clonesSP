"use client";

// Users — Admin → Users.
//
// Every Garage user, rendered through the same reusable Bigin-style
// DataTable (components/data-table/*) as One Time Affiliates / NetworkChain
// Subs, so column resize, reorder, and layout persistence come for free.
// Row click opens the user's detail page.
//
// Backend: GET /garage-admin/users (garagenew-backend controller
// listAllUsers). Defaults to a prospecting view (hides users who already
// activated the $25 UP sub); the "Show activated" toggle here passes
// `includeActivated=true` to widen it to everyone.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  Check as CheckIcon,
  Copy,
  Building2,
  MoreVertical,
  MoreHorizontal,
  X,
  Trash2,
  UserCheck,
  PhoneOff,
  PhoneCall,
  MailCheck,
} from "lucide-react";
import {
  listUsers,
  extendUserOffer,
  type AdminUserListItem,
  type AdminUserUpline,
} from "@/lib/admin-api/users";
import {
  getUserDeletePreview,
  deleteAdminUser,
  removeUserPhone,
  setUserEmailVerified,
  setUserPhoneVerified,
  type UserDeletePreview,
} from "@/lib/admin-api/danger-zone";
import DangerConfirmDialog from "@/components/garage-admin/DangerConfirmDialog";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { isDemoAdmin, demoUsers } from "@/lib/admin-api/demo";
import CompleteProfileDialog from "@/components/garage-admin/CompleteProfileDialog";
import { AffiliateMemberDrawer } from "@/components/garage-admin/AffiliateMemberDrawer";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { getCountryFlag } from "@/lib/country-flag";
import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef } from "@/components/data-table/types";

const RPP_OPTIONS = [10, 20, 30, 50, 100];

export default function AdminUsersListPage() {
  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(30);
  const [page, setPage] = useState(1);
  // Default to the full list (everyone) so this stays the general admin
  // users table; toggle off to get the founder's prospecting view.
  const [includeActivated, setIncludeActivated] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Column filters. Sent to the server, not applied here: this table pages
  // ~30 rows at a time out of ~1,900 users, so a client-side match would
  // search only what's on screen.
  const [filters, setFilters] = useState<Record<string, string>>({});
  // User id whose offer is mid-extend (shows a spinner on that row's button).
  const [extendingId, setExtendingId] = useState<string | null>(null);
  // Extending a 24h offer is a write on the "users" page. A view-only role
  // reads the table; it doesn't get a button that reopens someone's offer.
  const { canDoAction } = useAdminAccess();
  const canExtendOffers = canDoAction("users", "extend-offer");
  // Person side panel (Open View / View Profile), opened from the Name or
  // Upline Details cell.
  const [panelPerson, setPanelPerson] = useState<{ _id: string; name: string | null } | null>(null);
  // "Open View" — view the table from a specific user's perspective (their
  // downline). Sent to the backend as ?rootUserId.
  const [viewAsUser, setViewAsUser] = useState<{ _id: string; name: string | null } | null>(null);
  const router = useRouter();

  // ── Destructive / profile actions on the selected row ──────────────────
  // Single-row only. These are irreversible and each one needs its own typed
  // confirmation, so a bulk delete would either skip that check or ask N
  // times — neither is something to hand an operator.
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListItem | null>(null);
  const [deletePreview, setDeletePreview] = useState<UserDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [profileTarget, setProfileTarget] = useState<AdminUserListItem | null>(null);

  const selectedRow = useMemo(
    () => (selectedIds.size === 1 ? rows.find((r) => selectedIds.has(r.id)) || null : null),
    [selectedIds, rows]
  );

  // Broken signups can have NO email (the app let them in without recording
  // one), and those used to be undeletable because the confirmation demanded
  // the email. The server now accepts the email when present, else the name,
  // else the literal "DELETE" — this mirrors that so the dialog asks for, and
  // sends, whatever the server will actually check.
  const deleteConfirmValue = (row: {
    email?: string | null;
    name?: string | null;
  }) => (row.email || "").trim() || (row.name || "").trim() || "DELETE";
  const deleteConfirmLabel = (row: {
    email?: string | null;
    name?: string | null;
  } | null) =>
    !row
      ? "Type the user's email to confirm"
      : (row.email || "").trim()
        ? "Type the user's email to confirm"
        : (row.name || "").trim()
          ? "This user has no email — type their name to confirm"
          : 'This user has no email or name — type DELETE to confirm';

  const openDelete = async (row: AdminUserListItem) => {
    setDeleteTarget(row);
    setDeletePreview(null);
    setDeleteError(null);
    setPreviewLoading(true);
    try {
      setDeletePreview(await getUserDeletePreview(row.id));
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
      await deleteAdminUser(deleteTarget.id, deleteConfirmValue(deleteTarget));
      toast.success(
        `Deleted ${deleteTarget.email || deleteTarget.name || "user"}`,
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
  // No combined delete-preview (that would be N lookups); instead one typed
  // "DELETE" confirmation, then the same per-user danger-zone endpoint is run
  // for each. Each account's own email (or name, or "DELETE" when it has
  // neither) is sent as its confirmation — the server still re-checks it — so
  // no per-user typing is needed.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // The selected rows on the current page. Selection lives per loaded page, so
  // this is exactly what the bar's count reflects; every one is deletable,
  // including accounts with no email.
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  /**
   * Clear the selected user's phone number and un-verify them.
   *
   * Recoverable — they can verify a number again — so this asks for a plain
   * confirm rather than the typed-email dialog the deletes use. The number is
   * named in the prompt so a mis-selected row is visible before it's cleared.
   */
  const [phoneBusy, setPhoneBusy] = useState(false);
  const removePhone = async (row: AdminUserListItem) => {
    if (!row.phone) return;
    if (
      !confirm(
        `Remove ${row.phone} from ${row.email || row.name || "this user"}?\n\n` +
          `Their number will be cleared and they'll be marked unverified. ` +
          `They can verify a number again themselves.`,
      )
    )
      return;
    setPhoneBusy(true);
    try {
      const res = await removeUserPhone(row.id);
      toast.success(`Removed ${res.removed || "phone number"}`);
      // Patch the row in place — a full reload would drop the selection and
      // the operator's scroll position for a one-field change.
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, phone: null, phoneVerified: false } : r,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove phone number");
    } finally {
      setPhoneBusy(false);
    }
  };

  /**
   * Mark the selected user's email verified, or take it back.
   *
   * Reversible in both directions, so the confirm only guards against acting on
   * a mis-selected row — the address is named in the prompt for that reason.
   */
  const [emailVerifyBusy, setEmailVerifyBusy] = useState(false);
  const toggleEmailVerified = async (row: AdminUserListItem) => {
    const next = !row.isVerified;
    if (next && !row.email) return;
    if (
      !confirm(
        next
          ? `Mark ${row.email} as verified?\n\nThis only records the address as confirmed — they still get an OTP every time they log in.`
          : `Mark ${row.email || "this user"} as unverified?\n\nThey'll be prompted to verify their email again.`,
      )
    )
      return;
    setEmailVerifyBusy(true);
    try {
      await setUserEmailVerified(row.id, next);
      toast.success(next ? "Email marked verified" : "Email marked unverified");
      // Patch in place so the selection and scroll position survive, same as
      // the phone action above.
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isVerified: next } : r)),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to update email verification",
      );
    } finally {
      setEmailVerifyBusy(false);
    }
  };

  /**
   * Mark the selected user's phone verified, or take it back.
   *
   * Reversible in both directions.
   */
  const [phoneVerifyBusy, setPhoneVerifyBusy] = useState(false);
  const togglePhoneVerified = async (row: AdminUserListItem) => {
    const next = !row.phoneVerified;
    if (next && !row.phone) return;
    if (
      !confirm(
        next
          ? `Mark ${row.phone} as verified?\n\nThis only records the phone as confirmed — they won't be nagged by phone verification prompts.`
          : `Mark ${row.phone || "this user"} as unverified?\n\nThey'll be prompted to verify their phone again.`,
      )
    )
      return;
    setPhoneVerifyBusy(true);
    try {
      await setUserPhoneVerified(row.id, next);
      toast.success(next ? "Phone marked verified" : "Phone marked unverified");
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, phoneVerified: next } : r)),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to update phone verification",
      );
    } finally {
      setPhoneVerifyBusy(false);
    }
  };

  const runBulkDelete = async () => {
    // No rows are skipped for lacking an email any more — each is confirmed
    // against its email, else its name, else "DELETE", the same as the server.
    const targets = selectedRows;
    if (targets.length === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkProgress({ done: 0, total: targets.length });
    let ok = 0;
    const failed: string[] = [];
    for (const t of targets) {
      try {
        await deleteAdminUser(t.id, deleteConfirmValue(t));
        ok++;
      } catch {
        failed.push(t.email || t.name || t.id);
      }
      setBulkProgress({ done: ok + failed.length, total: targets.length });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    setBulkOpen(false);
    setSelectedIds(new Set());
    if (failed.length === 0) {
      toast.success(`Deleted ${ok} user${ok === 1 ? "" : "s"}`);
    } else {
      toast.error(
        `Deleted ${ok}, failed ${failed.length}: ${failed
          .slice(0, 3)
          .join(", ")}${failed.length > 3 ? "…" : ""}`,
      );
    }
    load();
  };

  // Shared header search — server-side, debounced.
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, page, debouncedSearch, includeActivated, filters, viewAsUser]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, includeActivated, filters, viewAsUser]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    // Apple review account: render dummy data and never call the real API, so
    // no real user record is fetched or shown.
    if (isDemoAdmin()) {
      const items = demoUsers();
      setRows(items);
      setTotal(items.length);
      setLoading(false);
      return;
    }
    try {
      const skip = (page - 1) * pageSize;
      const res = await listUsers({
        limit: pageSize,
        skip,
        search: debouncedSearch || undefined,
        includeActivated: includeActivated ? true : undefined,
        fName: filters.name || undefined,
        fLocation: filters.location || undefined,
        fActivated: filters.activated || undefined,
        // Open View: show the table from the selected user's perspective
        // (their downline).
        rootUserId: viewAsUser?._id || undefined,
      });
      setRows(res?.items || []);
      setTotal(res?.total || 0);
    } catch (error: any) {
      const msg = error?.message || "Failed to load users";
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

  // Extend a user's 24h offer by `hours` from now, then patch the row in
  // place from the recomputed window the API returns (no full refetch).
  async function handleExtend(userId: string, hours = 24) {
    setExtendingId(userId);
    try {
      const updated = await extendUserOffer(userId, hours);
      setRows((prev) =>
        prev.map((r) =>
          r.id === userId
            ? {
                ...r,
                twentyFourHourOffer: {
                  ...r.twentyFourHourOffer,
                  ...updated,
                  status: updated.windowOpen
                    ? "pending"
                    : r.twentyFourHourOffer.status,
                },
              }
            : r,
        ),
      );
      toast.success(`Offer extended by ${hours}h`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to extend offer");
    } finally {
      setExtendingId(null);
    }
  }

  const columns = useMemo<ColumnDef<AdminUserListItem>[]>(
    () =>
      buildColumns(
        handleExtend,
        extendingId,
        (p) => setPanelPerson(p),
        canExtendOffers
      ),
    // canExtendOffers resolves in an effect, so it flips on the second
    // render — omitting it here would freeze the columns without the pill.
    [extendingId, canExtendOffers],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to}`;
  }, [page, pageSize, total]);

  return (
    // Edge-to-edge: cancel the admin layout's px-8/pt-7/pb-8 gutter so the table
    // sits flush against the sidebar/header like the Figma (no outer spacing).
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#181818]">
      {/* Person side panel — opens from the Name / Upline Details cells. */}
      <AffiliateMemberDrawer
        profileBasePath="/garage-admin/users"
        person={panelPerson}
        onClose={() => setPanelPerson(null)}
        onOpenView={(p) => {
          setViewAsUser({ _id: p._id, name: p.name });
          setPanelPerson(null);
        }}
      />
      {/* Open View banner — the table is scoped to a user's downline. */}
      {viewAsUser && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#FFC200]/25 bg-[#FFC200]/[0.06] px-4 py-2.5">
          <div className="min-w-0 text-[13px] text-zinc-200">
            Viewing the downline of{" "}
            <span className="font-semibold text-white">
              {viewAsUser.name || "this user"}
            </span>
          </div>
          <button
            onClick={() => setViewAsUser(null)}
            className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[12px] text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Exit view
          </button>
        </div>
      )}
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm font-medium text-white">
            Couldn&apos;t load users
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
        <DataTable<AdminUserListItem>
          tableId="garage-admin-users-v1"
          stickyBg="#181818"
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          loading={loading}
          emptyLabel="No users match this search."
          filters={filters}
          onFiltersChange={setFilters}
          selectable
          selectedIds={selectedIds}
          allSelected={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
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
              const all = rows.every((r) => prev.has(r.id));
              if (all) return new Set();
              return new Set(rows.map((r) => r.id));
            })
          }
          topBar={
            selectedIds.size > 0 ? (
              <BulkActionBar
                count={selectedIds.size}
                selectedRow={selectedRow}
                onClear={() => setSelectedIds(new Set())}
                onCompleteProfile={() =>
                  selectedRow && setProfileTarget(selectedRow)
                }
                phoneBusy={phoneBusy}
                onRemovePhone={() => selectedRow && removePhone(selectedRow)}
                phoneVerifyBusy={phoneVerifyBusy}
                onTogglePhoneVerified={() =>
                  selectedRow && togglePhoneVerified(selectedRow)
                }
                emailVerifyBusy={emailVerifyBusy}
                onToggleEmailVerified={() =>
                  selectedRow && toggleEmailVerified(selectedRow)
                }
                onDelete={() =>
                  selectedRow ? openDelete(selectedRow) : setBulkOpen(true)
                }
              />
            ) : (
              <TopBar
                includeActivated={includeActivated}
                onToggleActivated={() => setIncludeActivated((v) => !v)}
              />
            )
          }
          footerTotals={[{ label: "Total Users", value: total.toLocaleString() }]}
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
        title={
          deletePreview?.user.isVerified === false
            ? "Delete unverified user"
            : "Delete user"
        }
        subject={deleteTarget?.email || deleteTarget?.name || ""}
        confirmValue={deleteTarget ? deleteConfirmValue(deleteTarget) : ""}
        confirmLabel={deleteConfirmLabel(deleteTarget)}
        dependents={deletePreview?.dependents || []}
        totalDependents={deletePreview?.totalDependents || 0}
        countsCapped={deletePreview?.countsCapped || false}
        // One row, same treatment as the bulk dialog — the operator sees the
        // face and address of whoever they're about to delete, not just an
        // email echoed in the confirm box.
        affected={deleteTarget ? [deleteTarget] : []}
        extraNote={
          deletePreview && deletePreview.user.organizations > 0
            ? `They are a member of ${deletePreview.user.organizations} workspace${
                deletePreview.user.organizations === 1 ? "" : "s"
              }.`
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

      {/* Bulk delete — 2+ selected. One "DELETE" confirmation, then each user
          is removed via the same danger-zone endpoint. */}
      <DangerConfirmDialog
        open={bulkOpen}
        title={`Delete ${selectedRows.length} users`}
        subject={`${selectedRows.length} selected users`}
        confirmValue="DELETE"
        confirmLabel='Type DELETE to confirm'
        dependents={[]}
        totalDependents={0}
        // The full roster, not a truncated preview. This used to be six
        // comma-joined emails plus "+N more", which hid the rows most likely
        // to be selected by mistake.
        affected={selectedRows}
        extraNote={
          (bulkProgress
            ? `Deleting ${bulkProgress.done} of ${bulkProgress.total}… `
            : "") +
          `This permanently deletes each account and its data — this can't be undone.`
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

      <CompleteProfileDialog
        open={!!profileTarget}
        user={
          profileTarget
            ? {
                id: profileTarget.id,
                name: profileTarget.name,
                email: profileTarget.email,
                phone: profileTarget.phone,
                country: profileTarget.location.country,
                state: profileTarget.location.state,
                city: profileTarget.location.city,
              }
            : null
        }
        onCancel={() => setProfileTarget(null)}
        onDone={() => {
          setProfileTarget(null);
          setSelectedIds(new Set());
          toast.success("Profile completed");
          load();
        }}
      />
    </div>
  );
}

/* ── Top bars ── */

function BulkActionBar({
  count,
  selectedRow,
  onClear,
  onCompleteProfile,
  onDelete,
  onRemovePhone,
  phoneBusy,
  onTogglePhoneVerified,
  phoneVerifyBusy,
  onToggleEmailVerified,
  emailVerifyBusy,
}: {
  count: number;
  /**
   * The row to act on — null when more than one is selected. The actions here
   * are per-user and irreversible, so they stay disabled on a multi-select
   * rather than looping over the selection.
   */
  selectedRow: AdminUserListItem | null;
  onClear: () => void;
  onCompleteProfile: () => void;
  onDelete: () => void;
  onRemovePhone: () => void;
  phoneBusy: boolean;
  onTogglePhoneVerified: () => void;
  phoneVerifyBusy: boolean;
  onToggleEmailVerified: () => void;
  emailVerifyBusy: boolean;
}) {
  const single = !!selectedRow;
  // Both actions here hit super-admin-only endpoints (danger-zone delete
  // and complete-profile). A "users: view" role can reach this page, so
  // don't show them buttons whose only possible answer is 403.
  const { isSuperAdmin } = useAdminAccess();
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {isSuperAdmin && (
          <button
            type="button"
            disabled={!single}
            onClick={onCompleteProfile}
            title={single ? undefined : "Select a single user"}
            className="flex h-9 items-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Complete Profile
          </button>
        )}
        {/* Remove phone — single selection only, and only when there's a
            number to remove. Deliberately not a bulk action: clearing numbers
            across a selection is a mistake nobody can undo in one click. */}
        {isSuperAdmin && (
          <button
            type="button"
            disabled={!single || !selectedRow?.phone || phoneBusy}
            onClick={onRemovePhone}
            title={
              !single
                ? "Select a single user"
                : !selectedRow?.phone
                  ? "This user has no phone number"
                  : `Remove ${selectedRow.phone} and mark unverified`
            }
            className="flex h-9 items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 text-sm text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            {phoneBusy ? "Removing…" : "Remove phone"}
          </button>
        )}
        {/* Phone verification — single selection only, and the label follows
            the selected user's current state so one button covers both
            directions without pretending to be a toggle switch. */}
        {isSuperAdmin && (
          <button
            type="button"
            disabled={
              !single ||
              phoneVerifyBusy ||
              (!selectedRow?.phoneVerified && !selectedRow?.phone)
            }
            onClick={onTogglePhoneVerified}
            title={
              !single
                ? "Select a single user"
                : !selectedRow?.phoneVerified && !selectedRow?.phone
                  ? "This user has no phone number"
                  : selectedRow?.phoneVerified
                    ? `Mark ${selectedRow.phone} unverified`
                    : `Mark ${selectedRow?.phone} verified`
            }
            className="flex h-9 items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-4 text-sm text-teal-300 hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            {phoneVerifyBusy
              ? "Saving…"
              : selectedRow?.phoneVerified
                ? "Unverify phone"
                : "Verify phone"}
          </button>
        )}
        {/* Email verification — single selection only, and the label follows
            the selected user's current state so one button covers both
            directions without pretending to be a toggle switch. */}
        {isSuperAdmin && (
          <button
            type="button"
            disabled={
              !single ||
              emailVerifyBusy ||
              (!selectedRow?.isVerified && !selectedRow?.email)
            }
            onClick={onToggleEmailVerified}
            title={
              !single
                ? "Select a single user"
                : !selectedRow?.isVerified && !selectedRow?.email
                  ? "This user has no email address"
                  : selectedRow?.isVerified
                    ? `Mark ${selectedRow.email} unverified`
                    : `Mark ${selectedRow?.email} verified`
            }
            className="flex h-9 items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-4 text-sm text-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MailCheck className="h-3.5 w-3.5" />
            {emailVerifyBusy
              ? "Saving…"
              : selectedRow?.isVerified
                ? "Unverify email"
                : "Verify email"}
          </button>
        )}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-4 text-sm text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {single
              ? selectedRow && selectedRow.isVerified === false
                ? "Delete unverified user"
                : "Delete user"
              : `Delete ${count} users`}
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

// Toolbar per the Figma: a yellow funnel filter + an "All Users" scope pill on
// the left; a "User" type pill and an overflow (⋮) menu on the right. The scope
// pill toggles the include-activated view (All Users ⇄ Prospects).
function TopBar({
  includeActivated,
  onToggleActivated,
}: {
  includeActivated: boolean;
  onToggleActivated: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FBD10D]/40 bg-[#FBD10D]/10 text-[#FBD10D] transition-colors hover:bg-[#FBD10D]/20"
          aria-label="Filters"
          title="Filters"
        >
          <Filter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleActivated}
          title={
            includeActivated
              ? "Showing everyone. Click to show only prospects (not yet activated)."
              : "Showing prospects only. Click to show everyone."
          }
          className="flex h-9 items-center gap-2 rounded-full bg-white/[0.05] px-4 text-[14px] font-medium text-white/60 transition-colors hover:bg-white/[0.08]"
        >
          {includeActivated ? "All Users" : "Prospects"}
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-white/[0.05] px-4 text-[14px] font-medium text-white/60 transition-colors hover:bg-white/[0.08]"
        >
          <UserCheck className="h-4 w-4" />
          User
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.08]"
          aria-label="More"
          title="More"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Column definitions ── */

// Column set + order mirror the Garage Dashboard Figma (node 14:672):
// Name · Upline Details · Location · Joining Date (date + office chips) ·
// Profile Status · 24 Hour Offer Status · Purchase Volume · Commissions
// Generated · Directs · Downline. All data comes from GET /garage-admin/users.
function buildColumns(
  onExtend: (userId: string, hours?: number) => void,
  extendingId: string | null,
  onOpenPerson: (p: { _id: string; name: string | null }) => void,
  canExtendOffers: boolean,
): ColumnDef<AdminUserListItem>[] {
  return [
    {
      id: "name",
      header: "Name",
      width: 233,
      minWidth: 200,
      filterable: true,
      serverFiltered: true,
      frozen: true,
      cell: (r) => (
        <div
          className="cursor-pointer"
          onClick={() => onOpenPerson({ _id: r.id, name: r.name })}
        >
          <UserCell
            name={r.name}
            email={r.email}
            phone={r.phone}
            profilePicture={r.profilePicture}
            country={r.location?.country ?? null}
          />
        </div>
      ),
    },
    {
      id: "upline",
      header: "Upline Details",
      width: 233,
      minWidth: 200,
      // Opens the panel for the UPLINE person, not the row's user.
      cell: (r) =>
        r.upline ? (
          <div
            className="cursor-pointer"
            onClick={() =>
              onOpenPerson({ _id: r.upline!.userId, name: r.upline!.name })
            }
          >
            <UplineCell u={r.upline} />
          </div>
        ) : (
          <UplineCell u={r.upline} />
        ),
    },
    {
      id: "location",
      header: "Location",
      width: 172,
      minWidth: 150,
      filterable: true,
      serverFiltered: true,
      cell: (r) => <LocationCell loc={r.location} />,
    },
    {
      id: "joining",
      header: "Joining Date",
      width: 150,
      minWidth: 130,
      cell: (r) => <JoiningCell date={r.createdAt} offices={r.offices} />,
    },
    {
      id: "profileStatus",
      header: "Profile Status",
      width: 130,
      minWidth: 110,
      cell: (r) => <ProfileStatusCell complete={!!r.profileComplete} />,
    },
    {
      id: "offer",
      header: "24 Hour Offer Status",
      width: 175,
      minWidth: 150,
      cell: (r) => (
        <OfferCell
          offer={r.twentyFourHourOffer}
          onExtend={() => onExtend(r.id)}
          canExtend={canExtendOffers}
          extending={extendingId === r.id}
        />
      ),
    },
    {
      id: "purchaseVolume",
      header: "Purchase Volume",
      width: 160,
      minWidth: 130,
      cell: (r) => (
        <PurchaseVolumeCell
          volumeUsd={r.purchases?.volumeUsd ?? 0}
          purchaseCount={r.purchases?.purchaseCount ?? 0}
          productCount={r.purchases?.productCount ?? 0}
        />
      ),
    },
    {
      id: "commissions",
      header: "Commissions Generated",
      width: 155,
      minWidth: 130,
      cell: (r) => (
        <CommissionsCell
          totalUsd={r.commissionsGenerated?.totalUsd ?? 0}
          count={r.commissionsGenerated?.count ?? 0}
        />
      ),
    },
    {
      id: "directs",
      header: "Directs",
      width: 100,
      minWidth: 80,
      align: "center",
      cell: (r) => (
        <span className="text-[14px] font-semibold text-white/70">
          {r.directsCount ?? 0}
        </span>
      ),
    },
    {
      id: "downline",
      header: "Downline",
      width: 100,
      minWidth: 80,
      align: "center",
      cell: (r) => (
        <span className="text-[14px] font-semibold text-white/70">
          {r.downlineCount ?? 0}
        </span>
      ),
    },
  ];
}

/* ── Cells ── */

/** Small inline copy-to-clipboard button. Stops propagation so clicking it in a
 *  clickable Name/Upline cell copies instead of opening the person panel. */
function CopyBtn({ value, label }: { value: string | null; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            toast.success(`Copied ${label}`);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => toast.error("Couldn't copy"));
      }}
      className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
    >
      {copied ? (
        <CheckIcon className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function UserCell({
  name,
  email,
  phone,
  profilePicture,
  country,
}: {
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  country: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <Avatar src={profilePicture} name={name || email || "?"} />
      <div className="min-w-0 space-y-1 leading-tight">
        <div className="flex items-center gap-1">
          <span className="truncate text-[14px] font-semibold text-white/80">
            {name || "Unnamed"}
          </span>
          <CopyBtn value={name} label="name" />
        </div>
        {/* Emails are long and have no spaces, so `truncate` hid most of them
            behind an ellipsis. Wrap to a second line instead — `break-all` is
            what lets a spaceless address break at all, and the 2-line clamp
            keeps rows from growing without bound on a very long address. */}
        <div className="flex min-w-0 items-start gap-1">
          <span className="line-clamp-2 break-all text-[14px] text-white/50">
            {email || "—"}
          </span>
          <CopyBtn value={email} label="email" />
        </div>
        {phone && (
          <div className="flex items-center gap-1.5">
            {country && (
              <span className="text-[14px] leading-none" aria-hidden>
                {getCountryFlag(country)}
              </span>
            )}
            <span className="text-[14px] font-semibold text-white/50">{phone}</span>
            <CopyBtn value={phone} label="phone" />
          </div>
        )}
      </div>
    </div>
  );
}

function UplineCell({ u }: { u: AdminUserUpline | null }) {
  if (!u) return <span className="text-zinc-600">—</span>;
  return (
    <UserCell
      name={u.name}
      email={u.email}
      phone={u.phone}
      profilePicture={u.profilePicture}
      country={null}
    />
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
        className="h-10 w-10 shrink-0 rounded-full border border-white/[0.08] object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}

function LocationCell({ loc }: { loc: AdminUserListItem["location"] }) {
  if (!loc || (!loc.city && !loc.state && !loc.country))
    return <span className="text-white/40">—</span>;
  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold text-white/50">{loc.city || "—"}</div>
      {loc.state && (
        <div className="text-[14px] font-semibold text-white/50">{loc.state}</div>
      )}
      {loc.country && (
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] leading-none" aria-hidden>
            {getCountryFlag(loc.country)}
          </span>
          <span className="text-[14px] font-semibold text-white/50">{loc.country}</span>
        </div>
      )}
    </div>
  );
}

/** Office chip logo: the org's actual icon, falling back to a generic building
 *  glyph when there's no logo or it fails to load. */
function OfficeLogo({ src }: { src: string | null | undefined }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <Building2 className="h-2.5 w-2.5 shrink-0 text-zinc-500" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Joining Date cell — the sign-up date, then the first office as a chip and a
 *  "+ N More" affordance for the rest (matches the Figma's date + Chamak / +4
 *  More layout). */
function JoiningCell({
  date,
  offices,
}: {
  date: string;
  offices: AdminUserListItem["offices"];
}) {
  const list = offices ?? [];
  const first = list[0];
  const more = Math.max(0, list.length - 1);
  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold text-white/50">
        {formatShortDate(date)}
      </div>
      {first && (
        <div className="flex items-center gap-1.5">
          <OfficeLogo src={first.logo} />
          <span className="max-w-[100px] truncate text-[14px] font-semibold text-white/50">
            {first.name}
          </span>
        </div>
      )}
      {more > 0 && (
        <div className="flex items-center gap-1 text-[14px] font-semibold text-white/50">
          + {more} More
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

/** Profile Status — a "Completed" pill (green check) when the user's profile is
 *  complete, otherwise a muted "Incomplete". */
function ProfileStatusCell({ complete }: { complete: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(114,114,114,0.32)] px-3 py-1 text-[10px] font-bold text-white">
      {complete ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Completed
        </>
      ) : (
        <span className="text-white/60">Incomplete</span>
      )}
    </span>
  );
}

/** Purchase Volume — total $ spent, then purchase and product counts, matching
 *  the Figma's "$100.00 / 20 Purchases / 25 Products" stack. */
function PurchaseVolumeCell({
  volumeUsd,
  purchaseCount,
  productCount,
}: {
  volumeUsd: number;
  purchaseCount: number;
  productCount: number;
}) {
  if (!volumeUsd && !purchaseCount && !productCount)
    return <span className="text-white/40">—</span>;
  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold tabular-nums text-white/60">
        {formatMoney(volumeUsd, "USD")}
      </div>
      <div className="text-[14px] font-semibold text-white/50">
        {purchaseCount} {purchaseCount === 1 ? "Purchase" : "Purchases"}
      </div>
      <div className="flex items-center gap-1 text-[14px] font-semibold text-white/50">
        {productCount} {productCount === 1 ? "Product" : "Products"}
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

/** Commissions Generated — total $ then the payout count, matching the Figma's
 *  "$100.00 / 40 Commissions" stack. */
function CommissionsCell({
  totalUsd,
  count,
}: {
  totalUsd: number;
  count: number;
}) {
  if (!count && !totalUsd) return <span className="text-white/40">—</span>;
  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold tabular-nums text-white/60">
        {formatMoney(totalUsd, "USD")}
      </div>
      <div className="flex items-center gap-1 text-[14px] font-semibold text-white/50">
        {count} {count === 1 ? "Commission" : "Commissions"}
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

/** 24 Hour Offer Status — the live countdown (red) while pending, "Expired"
 *  (red) or "Completed" (green) otherwise, plus an Extend pill the admin can use
 *  to (re)open the window. Matches the Figma's "5hrs 24m 23s left / Extend". */
function OfferCell({
  offer,
  onExtend,
  extending,
  canExtend: allowed,
}: {
  offer: AdminUserListItem["twentyFourHourOffer"];
  onExtend: () => void;
  extending: boolean;
  /** False for a view-only role — the pill is hidden entirely. */
  canExtend: boolean;
}) {
  if (!offer) return <span className="text-white/40">—</span>;
  const status = offer.status;
  let label: ReactNode = "Not started";
  let color = "text-white/40";
  if (status === "completed") {
    label = "Completed";
    color = "text-emerald-400";
  } else if (status === "expired") {
    label = "Expired";
    color = "text-[#ff3e61]";
  } else if (status === "pending") {
    color = "text-[#ff3e61]";
    label =
      offer.secondsRemaining > 0 ? (
        <OfferCountdown
          expiresAt={offer.windowExpiresAt}
          fallbackSeconds={offer.secondsRemaining}
        />
      ) : (
        "Open"
      );
  }
  // Admins can (re)open both a still-open and an expired window; a completed or
  // not-yet-started one has nothing to extend.
  const canExtend = allowed && (status === "pending" || status === "expired");
  return (
    <div className="flex flex-col items-start gap-2 leading-tight">
      <span className={`text-[14px] font-medium ${color}`}>{label}</span>
      {canExtend && (
        <button
          type="button"
          disabled={extending}
          onClick={(e) => {
            e.stopPropagation();
            onExtend();
          }}
          className="rounded-full bg-[rgba(68,68,68,0.28)] px-4 py-1 text-[10px] font-semibold text-white/60 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
        >
          {extending ? "Extending…" : "Extend"}
        </button>
      )}
      {offer.extendedByAdmin && (
        <span className="text-[10px] text-white/40">Extended by admin</span>
      )}
    </div>
  );
}

/** Live per-second countdown for a pending 24h offer ("5hrs 24m 23s left"),
 *  recomputed from windowExpiresAt so it stays accurate while the row sits. */
function OfferCountdown({
  expiresAt,
  fallbackSeconds,
}: {
  expiresAt?: string | null;
  fallbackSeconds: number;
}) {
  const compute = () => {
    if (expiresAt) {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (!Number.isNaN(ms)) return Math.max(0, Math.floor(ms / 1000));
    }
    return Math.max(0, fallbackSeconds);
  };
  const [secs, setSecs] = useState(compute);
  useEffect(() => {
    const t = setInterval(() => setSecs(compute()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return <>{`${h}hrs ${m}m ${s}s left`}</>;
}

/* ── helpers ── */

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
