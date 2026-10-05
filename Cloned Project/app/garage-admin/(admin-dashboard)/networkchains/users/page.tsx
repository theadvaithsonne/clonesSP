"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/DataTable";
import { TableTopBar } from "@/components/data-table/TableTopBar";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import { ExportPanel, ExportButton, type ExportField } from "@/components/data-table/ExportPanel";
import {
  getAdminUsers,
  AdminUnauthorizedError,
  type AdminUserRow,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const RPP_OPTIONS = [10, 20, 50, 100];

/** CSV columns for the admin users table (export order). */
const USER_EXPORT_FIELDS: ExportField<AdminUserRow>[] = [
  { key: "name", label: "Name", value: (u) => u.name ?? "" },
  { key: "email", label: "Email", value: (u) => u.email ?? "" },
  { key: "username", label: "Username", value: (u) => u.username ?? "" },
  { key: "createdAt", label: "Joined", value: (u) => u.createdAt ?? "" },
  { key: "updatedAt", label: "Last Active", value: (u) => u.updatedAt ?? "" },
  { key: "userId", label: "User ID", value: (u) => u._id ?? "" },
];

/** Column id → server sort field. */
const USER_SORT: Record<string, string> = {
  user: "name",
  username: "username",
  lastActive: "updatedAt",
};

/** Avatar with an initials-on-gradient fallback when there's no usable
 *  profile picture (or it fails to load) — avoids the blank-gap look. */
function Avatar({ src, name }: { src?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImg = !!src && !failed;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-xs font-semibold text-black">
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>({ by: "lastActive", order: "desc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  // Pull every user matching the current search/sort, page by page.
  const fetchAllUsers = useCallback(async (): Promise<AdminUserRow[]> => {
    const out: AdminUserRow[] = [];
    const pageSize = 200;
    for (let p = 1; ; p++) {
      const data = await getAdminUsers({
        search: debouncedSearch,
        page: p,
        limit: pageSize,
        sortBy: USER_SORT[sort?.by ?? ""] ?? "updatedAt",
        sortOrder: sort?.order ?? "desc",
      });
      out.push(...data.users);
      if (data.users.length === 0 || out.length >= data.total) break;
    }
    return out;
  }, [debouncedSearch, sort]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [limit, sort]);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once data loads again.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers({
        search: debouncedSearch,
        page,
        limit,
        sortBy: USER_SORT[sort?.by ?? ""] ?? "updatedAt",
        sortOrder: sort?.order ?? "desc",
      });
      setUsers(data.users);
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
            fetchUsers();
          }
        });
        return;
      }
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, limit, sort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        id: "user",
        header: "User",
        frozen: true,
        sortable: true,
        width: 300,
        minWidth: 220,
        cell: (u) => (
          <div className="flex items-center gap-3">
            <Avatar src={u.profilePicture} name={u.name} />
            <div className="min-w-0">
              <div className="truncate text-white">{u.name || "—"}</div>
              <div className="truncate text-[12px] text-zinc-500">{u.email || "—"}</div>
            </div>
          </div>
        ),
      },
      {
        id: "username",
        header: "Username",
        sortable: true,
        width: 200,
        cell: (u) => <span className="text-zinc-300">{u.username || "—"}</span>,
      },
      {
        id: "lastActive",
        header: "Last active",
        sortable: true,
        width: 160,
        align: "right",
        cell: (u) => (
          <span className="text-zinc-400">
            {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      <div className="flex-none px-4 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Everyone with a NetworkChains account — click a row to view their activity (read-only)
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <DataTable<AdminUserRow>
          tableId="admin-users"
          columns={columns}
          rows={users}
          getRowId={(u) => u._id}
          loading={loading}
          emptyLabel="No users found."
          rowHeight="auto"
          headerHeight={48}
          stickyBg="#181818"
          sort={sort}
          onSortChange={setSort}
          onRowClick={(u) => router.push(`/garage-admin/networkchains/users/${u._id}`)}
          topBar={
            <TableTopBar actions={<ExportButton onClick={() => setExportOpen(true)} />} />
          }
          footerTotals={[{ label: "Total Users", value: total }]}
          pagination={{
            page,
            totalPages: Math.max(1, totalPages),
            rangeLabel: rangeLabel(page, limit, total),
            recordsPerPage: limit,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
            onRecordsPerPageChange: setLimit,
          }}
        />
      </div>

      <ExportPanel<AdminUserRow>
        open={exportOpen}
        onOpenChange={setExportOpen}
        fields={USER_EXPORT_FIELDS}
        fetchAll={fetchAllUsers}
        filenameBase="admin-users"
      />
    </div>
  );
}

function rangeLabel(page: number, limit: number, total: number): string {
  if (total === 0) return "0";
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return `${from} to ${to}`;
}
