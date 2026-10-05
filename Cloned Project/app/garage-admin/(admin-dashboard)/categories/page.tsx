"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { garageAdminApi } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  orgCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Admin CRUD for the organization-category taxonomy ─────────────────
// Backs the picker on office creation + ManageOrg. Every category shown
// here is what a founder can pick from — free-text was removed as part
// of this rollout. Delete requires merging into another category (no
// orphaning); the modal enforces target selection.
export default function OrgCategoriesAdminPage() {
  // Categories are a grantable page, so a "view" role lands here with no
  // right to change the taxonomy. Hide the writes rather than let every
  // click end in a 403.
  const { canDoAction } = useAdminAccess();
  const canEdit = canDoAction("categories", "edit-categories");
  const canDelete = canDoAction("categories", "delete-category");
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  // Rename modal
  const [editRow, setEditRow] = useState<CategoryRow | null>(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete-with-merge modal
  const [deleteRow, setDeleteRow] = useState<CategoryRow | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await garageAdminApi<{ data: CategoryRow[] }>(
        "/garage-admin/categories",
      );
      setRows(res.data || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load categories");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, q]);

  const totals = useMemo(() => {
    const total = rows?.length || 0;
    const inUse = (rows || []).filter((r) => r.orgCount > 0).length;
    const orgs = (rows || []).reduce((sum, r) => sum + r.orgCount, 0);
    return { total, inUse, orgs };
  }, [rows]);

  const openCreate = () => {
    setCreateName("");
    setShowCreate(true);
  };
  const openEdit = (row: CategoryRow) => {
    setEditRow(row);
    setEditName(row.name);
  };
  const openDelete = (row: CategoryRow) => {
    setDeleteRow(row);
    setMergeTargetId("");
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error("Name required");
      return;
    }
    setCreating(true);
    try {
      await garageAdminApi("/garage-admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      toast.success(`Created "${name}"`);
      setShowCreate(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  const submitRename = async () => {
    if (!editRow) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Name required");
      return;
    }
    if (name === editRow.name) {
      setEditRow(null);
      return;
    }
    setRenaming(true);
    try {
      const res = await garageAdminApi<{
        data: { orgsUpdated: number };
      }>(`/garage-admin/categories/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const n = res.data?.orgsUpdated ?? 0;
      toast.success(
        n > 0
          ? `Renamed to "${name}" — ${n} office${n === 1 ? "" : "s"} updated`
          : `Renamed to "${name}"`,
      );
      setEditRow(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to rename category");
    } finally {
      setRenaming(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteRow) return;
    if (!mergeTargetId) {
      toast.error("Pick a category to merge into");
      return;
    }
    setDeleting(true);
    try {
      const res = await garageAdminApi<{
        data: {
          deleted: boolean;
          orgsReassigned: number;
          mergedInto: { id: string; name: string };
        };
      }>(`/garage-admin/categories/${deleteRow.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCategoryId: mergeTargetId }),
      });
      const n = res.data?.orgsReassigned ?? 0;
      toast.success(
        n > 0
          ? `Deleted — ${n} office${n === 1 ? "" : "s"} reassigned to "${res.data.mergedInto.name}"`
          : `Deleted "${deleteRow.name}"`,
      );
      setDeleteRow(null);
      setMergeTargetId("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Tag className="h-6 w-6 text-[#FBA70A]" />
            Categories
          </h1>
          <p className="text-sm text-[#9fa0b8] mt-1">
            Manage the category list founders pick from during office
            creation + edit. Renames cascade to every office; deletes
            require picking a merge target.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={openCreate}
            className="bg-[#FBA70A] hover:bg-[#e59609] text-black font-medium"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Category
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Categories" value={totals.total} />
        <StatCard label="In Use" value={totals.inUse} />
        <StatCard label="Offices Tagged" value={totals.orgs} />
      </div>

      {/* Search + table */}
      <Card className="bg-[#0e0e12] border-[#2a2a35]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white text-base">All categories</CardTitle>
              <CardDescription className="text-[#9fa0b8]">
                Sorted A→Z. Office count updates live from Organization.
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#6a6a7a]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by name"
                className="pl-8 h-9 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && rows === null ? (
            <div className="flex items-center justify-center py-12 text-[#9fa0b8]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#6a6a7a] text-sm">
              {q ? "No matches." : "No categories yet. Click New Category to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6a6a7a] border-b border-white/[0.06]">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Slug</th>
                    <th className="py-2 pr-4 font-medium">Offices</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 pr-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/[0.06] hover:bg-[#15151b] transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-white">{row.name}</td>
                      <td className="py-2.5 pr-4 text-[#9fa0b8] font-mono text-xs">
                        {row.slug}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                            row.orgCount > 0
                              ? "bg-[#FBA70A]/15 text-[#FBA70A] border border-[#FBA70A]/30"
                              : "bg-[#1a1a22] text-[#6a6a7a] border border-[#2a2a35]",
                          )}
                        >
                          {row.orgCount}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-[#9fa0b8] text-xs">
                        {new Date(row.createdAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(row)}
                              className="h-8 px-2 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Rename
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDelete(row)}
                              className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
            <DialogDescription className="text-[#9fa0b8]">
              Founders will see this immediately in the office-creation and
              ManageOrg pickers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-cat-name" className="text-[#c7c7da]">
              Name
            </Label>
            <Input
              id="new-cat-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
              }}
              placeholder="e.g. Blockchain"
              className="bg-[#1a1a22] border-[#2a2a35] text-white"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            <Button
              onClick={submitCreate}
              disabled={creating}
              className="bg-[#FBA70A] hover:bg-[#e59609] text-black"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename modal */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
            <DialogDescription className="text-[#9fa0b8]">
              {editRow && editRow.orgCount > 0
                ? `${editRow.orgCount} office${editRow.orgCount === 1 ? " is" : "s are"} tagged with "${editRow.name}" — all will be updated to the new name.`
                : "This category isn't used by any office yet."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-cat-name" className="text-[#c7c7da]">
              New name
            </Label>
            <Input
              id="edit-cat-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
              }}
              className="bg-[#1a1a22] border-[#2a2a35] text-white"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              className="bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            <Button
              onClick={submitRename}
              disabled={renaming}
              className="bg-[#FBA70A] hover:bg-[#e59609] text-black"
            >
              {renaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-with-merge modal */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete Category
            </DialogTitle>
            <DialogDescription className="text-[#9fa0b8]">
              {deleteRow && deleteRow.orgCount > 0 ? (
                <>
                  <strong className="text-white">{deleteRow.orgCount}</strong>{" "}
                  office{deleteRow.orgCount === 1 ? " is" : "s are"} tagged
                  with <strong className="text-white">"{deleteRow.name}"</strong>.
                  Pick another category to move them into — orphaning isn't
                  allowed.
                </>
              ) : (
                <>
                  "{deleteRow?.name}" isn't used by any office. Merge target
                  is still required so the taxonomy stays consistent.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="merge-target" className="text-[#c7c7da]">
              Move offices into
            </Label>
            <select
              id="merge-target"
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="w-full h-10 bg-[#1a1a22] border border-[#2a2a35] rounded-md px-3 text-white text-sm focus:border-[#FBA70A]/50 focus:ring-[#FBA70A]/20"
            >
              <option value="">— Select target category —</option>
              {(rows || [])
                .filter((r) => r.id !== deleteRow?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.orgCount})
                  </option>
                ))}
            </select>
            {mergeTargetId && deleteRow && (
              <div className="mt-3 p-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center gap-2 text-sm">
                <span className="text-[#9fa0b8]">"{deleteRow.name}"</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#6a6a7a]" />
                <span className="text-white font-medium">
                  {rows?.find((r) => r.id === mergeTargetId)?.name}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              className="bg-transparent border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            <Button
              onClick={submitDelete}
              disabled={deleting || !mergeTargetId}
              className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete + Merge"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#0e0e12] border border-[#2a2a35] p-4">
      <p className="text-xs uppercase tracking-wider text-[#6a6a7a] mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-white tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
