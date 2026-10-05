"use client";

import { useEffect, useMemo, useState } from "react";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Search,
  Percent,
  Pencil,
  RotateCcw,
  Loader2,
  Info,
  TrendingUp,
  TrendingDown,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FeeRow {
  orgId: string;
  name: string;
  icon?: string | null;
  isHq: boolean;
  isOverride: boolean;
  feePercentage: number;
  defaultFeePercentage: number;
  updatedAt: string | null;
  updatedBy: { id: string; name?: string; email?: string } | null;
}

interface ApiResponse {
  data: { default: number; items: FeeRow[] };
}

type FilterMode = "all" | "custom" | "default";

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

export default function PlatformFeesPage() {
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [defaultPct, setDefaultPct] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const [editing, setEditing] = useState<FeeRow | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<FeeRow | null>(null);
  const [resetting, setResetting] = useState(false);

  // Shared header search — filters this table (debounced). Backend for
  // /platform-fee-overrides lives in garageAdmin.ts (owned elsewhere), so the
  // dataset is fetched whole and filtered client-side here rather than via ?q=.
  const { query: headerSearch } = useAdminSearch();
  const [debouncedHeaderSearch, setDebouncedHeaderSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHeaderSearch(headerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [headerSearch]);

  const fetchData = async () => {
    try {
      const res = await garageAdminApi<ApiResponse>(
        "/garage-admin/platform-fee-overrides",
        { method: "GET" }
      );
      setRows(res?.data?.items || []);
      setDefaultPct(res?.data?.default ?? 5);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load platform fee settings");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, []);

  // Sorting + grouping happens once, then we filter at render time
  const { custom, defaults } = useMemo(() => {
    const customRows = rows
      .filter((r) => r.isOverride)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
      );
    const defaultRows = rows
      .filter((r) => !r.isOverride)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { custom: customRows, defaults: defaultRows };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hq = debouncedHeaderSearch.toLowerCase();
    // Header search matches org name or the admin who set the override
    // (name / email). Local box search stays name-only as before; both are
    // ANDed so they compose.
    const matchesHeader = (r: FeeRow) =>
      !hq ||
      r.name.toLowerCase().includes(hq) ||
      (r.updatedBy?.name || "").toLowerCase().includes(hq) ||
      (r.updatedBy?.email || "").toLowerCase().includes(hq);
    const matchesQuery = (r: FeeRow) =>
      (!q || r.name.toLowerCase().includes(q)) && matchesHeader(r);
    return {
      custom:
        filter === "default"
          ? []
          : custom.filter(matchesQuery),
      defaults:
        filter === "custom"
          ? []
          : defaults.filter(matchesQuery),
    };
  }, [custom, defaults, query, filter, debouncedHeaderSearch]);

  const totalShown = filtered.custom.length + filtered.defaults.length;

  const openEdit = (row: FeeRow) => {
    setEditing(row);
    setEditValue(String(row.feePercentage));
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setEditValue("");
  };

  const save = async () => {
    if (!editing) return;
    const num = Number(editValue);
    if (!Number.isFinite(num) || num < 0 || num > 50) {
      toast.error("Fee must be a number between 0 and 50");
      return;
    }
    setSaving(true);
    try {
      await garageAdminApi(
        `/garage-admin/platform-fee-overrides/${editing.orgId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feePercentage: num }),
        }
      );
      toast.success(
        editing.isOverride
          ? `Updated ${editing.name} to ${num}%`
          : `Set ${editing.name} to ${num}%`
      );
      setEditing(null);
      setEditValue("");
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const performReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await garageAdminApi(
        `/garage-admin/platform-fee-overrides/${resetTarget.orgId}`,
        { method: "DELETE" }
      );
      toast.success(`${resetTarget.name} reverted to ${defaultPct}% default`);
      setResetTarget(null);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset";
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  };

  // Edit dialog math
  const editNum = Number(editValue);
  const editValid =
    Number.isFinite(editNum) && editNum >= 0 && editNum <= 50;
  const sellerFloor = editValid ? Math.max(0, 100 - editNum - 90) : 0;
  const editDelta = editValid ? editNum - defaultPct : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-[#111116] border border-gray-800 animate-pulse" />
        <div className="h-12 rounded-xl bg-[#111116] border border-gray-800 animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-[#0e0e12] border border-[#2a2a35] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero card — default fee front and center */}
      <Card className="bg-gradient-to-br from-[#1a1a22] via-[#111116] to-[#0e0e12] border-[#2a2a35] overflow-hidden relative">
        <div
          className="absolute inset-y-0 right-0 w-64 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at right, rgba(251,167,10,0.25), transparent 70%)",
          }}
        />
        <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#FBD10D] to-[#FBA70A] flex items-center justify-center shadow-lg shadow-[#FBA70A]/20">
              <Percent className="h-7 w-7 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#9fa0b8] mb-1">
                Default platform fee
              </div>
              <div className="text-4xl font-bold text-white tracking-tight">
                {defaultPct}%
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Applied to every organization unless overridden below
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center px-4">
              <div className="text-2xl font-semibold text-[#FBA70A]">
                {custom.length}
              </div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">
                Custom
              </div>
            </div>
            <div className="h-10 w-px bg-[#2a2a35]" />
            <div className="text-center px-4">
              <div className="text-2xl font-semibold text-gray-300">
                {defaults.length}
              </div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">
                Using default
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search + filter pills */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input
            placeholder="Search organizations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9 h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-gray-500 focus-visible:ring-[#FBD10D]/40 focus-visible:ring-[3px] focus-visible:border-[#FBD10D]/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="inline-flex items-center bg-[#1a1a22] border border-[#2a2a35] rounded-lg p-1 gap-1">
          {(["all", "custom", "default"] as FilterMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilter(m)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                filter === m
                  ? "bg-[#FBD10D] text-black"
                  : "text-gray-400 hover:text-white hover:bg-[#15151b]"
              )}
            >
              {m === "all"
                ? `All (${rows.length})`
                : m === "custom"
                  ? `Custom (${custom.length})`
                  : `Default (${defaults.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Custom overrides section */}
      {filtered.custom.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-3.5 w-3.5 text-[#FBA70A]" />
            <h2 className="text-[11px] uppercase tracking-wider text-[#9fa0b8] font-medium">
              Custom fees
            </h2>
            <span className="text-[11px] text-gray-500">
              ({filtered.custom.length})
            </span>
          </div>
          <div className="space-y-2">
            {filtered.custom.map((row) => (
              <FeeRowCard
                key={row.orgId}
                row={row}
                defaultPct={defaultPct}
                onEdit={() => openEdit(row)}
                onReset={() => setResetTarget(row)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Default-fee orgs section */}
      {filtered.defaults.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-[11px] uppercase tracking-wider text-[#9fa0b8] font-medium">
              Using default
            </h2>
            <span className="text-[11px] text-gray-500">
              ({filtered.defaults.length})
            </span>
          </div>
          <div className="space-y-2">
            {filtered.defaults.map((row) => (
              <FeeRowCard
                key={row.orgId}
                row={row}
                defaultPct={defaultPct}
                onEdit={() => openEdit(row)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty states */}
      {totalShown === 0 && (
        <div className="rounded-2xl border border-dashed border-[#2a2a35] bg-[#0e0e12] py-16 px-6 text-center">
          {query ? (
            <>
              <Search className="h-8 w-8 text-gray-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No matches for &ldquo;{query}&rdquo;
              </h3>
              <p className="text-sm text-gray-400">
                Try a different name or clear the search.
              </p>
            </>
          ) : filter === "custom" ? (
            <>
              <Sparkles className="h-8 w-8 text-[#FBA70A] mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No custom fees yet
              </h3>
              <p className="text-sm text-gray-400">
                Every organization is on the default {defaultPct}%. Switch to
                &ldquo;All&rdquo; and pick one to set a custom fee.
              </p>
            </>
          ) : (
            <>
              <Building2 className="h-8 w-8 text-gray-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No organizations
              </h3>
              <p className="text-sm text-gray-400">
                There are no organizations to manage yet.
              </p>
            </>
          )}
        </div>
      )}

      {/* Edit / Set dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent className="bg-[#111116] border-[#2a2a35] text-white sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-md bg-[#15151b] border border-[#2a2a35] overflow-hidden flex items-center justify-center shrink-0">
                {editing?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editing.icon}
                    alt={editing.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-4 w-4 text-[#FBD10D]" />
                )}
              </div>
              <div>
                <DialogTitle className="text-white text-base">
                  {editing?.isOverride ? "Update fee" : "Set custom fee"}
                </DialogTitle>
                <p className="text-xs text-gray-400">{editing?.name}</p>
              </div>
            </div>
            <DialogDescription className="text-gray-400">
              Future sales will use the new rate. Past distributions stay as
              recorded.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fee" className="text-xs text-gray-300">
                Platform fee
              </Label>
              <div className="relative">
                <Input
                  id="fee"
                  type="number"
                  min={0}
                  max={50}
                  step="0.1"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="bg-[#1a1a22] border-[#2a2a35] text-white text-lg font-semibold pr-10 h-12"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                  %
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Allowed range: 0% – 50%
              </p>
            </div>

            {/* Live impact preview */}
            {editValid ? (
              <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] divide-y divide-[#2a2a35]">
                <div className="flex items-center justify-between px-3 py-2.5 text-xs">
                  <span className="text-gray-400">Platform takes</span>
                  <span className="text-[#FBA70A] font-semibold">
                    {editNum}%
                    {editDelta !== 0 && (
                      <span
                        className={cn(
                          "ml-1.5 inline-flex items-center gap-0.5 text-[10px]",
                          editDelta > 0 ? "text-rose-300" : "text-emerald-300"
                        )}
                      >
                        {editDelta > 0 ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5" />
                        )}
                        {editDelta > 0 ? "+" : ""}
                        {editDelta.toFixed(1)} vs default
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 text-xs">
                  <span className="text-gray-400">Comb plans up to</span>
                  <span className="text-gray-300 font-medium">90%</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 text-xs">
                  <span className="text-gray-400">Seller floor</span>
                  <span
                    className={cn(
                      "font-semibold",
                      sellerFloor >= 5
                        ? "text-emerald-300"
                        : "text-rose-300"
                    )}
                  >
                    {sellerFloor}% of every sale
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-300 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Enter a number between 0 and 50 to preview the impact.
              </div>
            )}

            {editValid && editNum + 90 > 95 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Existing comb plans summing to {Math.max(0, 95 - editNum)}% or
                more will be refused at distribution time. Reduce affiliate
                percentages or this fee to keep them working.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeEdit}
              disabled={saving}
              className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#15151b] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || !editValid}
              className="bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] text-black font-semibold hover:opacity-95 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : editing?.isOverride ? (
                "Update fee"
              ) : (
                "Set custom fee"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <AlertDialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open && !resetting) setResetTarget(null);
        }}
      >
        <AlertDialogContent className="bg-[#111116] border-[#2a2a35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-gray-400" />
              Reset to default?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              {resetTarget?.name} will revert to the default{" "}
              <span className="text-[#FBD10D] font-semibold">
                {defaultPct}%
              </span>{" "}
              platform fee. Existing distribution records keep their original
              rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={resetting}
              className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#15151b]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performReset}
              disabled={resetting}
              className="bg-[#FBD10D] text-black hover:bg-[#FBD10D]/90 border-0"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting…
                </>
              ) : (
                "Reset"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ──────────────── Row card ──────────────── */

function FeeRowCard({
  row,
  defaultPct,
  onEdit,
  onReset,
}: {
  row: FeeRow;
  defaultPct: number;
  onEdit: () => void;
  onReset?: () => void;
}) {
  const delta = row.feePercentage - defaultPct;
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-[#0e0e12] p-3 transition-colors",
        row.isOverride
          ? "border-[#FBA70A]/30 hover:border-[#FBA70A]/50"
          : "border-[#2a2a35] hover:border-[#FBD10D]/30"
      )}
    >
      <div className="h-10 w-10 shrink-0 rounded-md bg-[#15151b] border border-[#2a2a35] overflow-hidden flex items-center justify-center">
        {row.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.icon}
            alt={row.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Building2 className="h-4 w-4 text-[#FBD10D]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{row.name}</div>
        {row.isOverride ? (
          <div className="text-[11px] text-gray-500 truncate">
            Updated {formatDate(row.updatedAt)}
            {row.updatedBy?.name ? ` · by ${row.updatedBy.name}` : ""}
          </div>
        ) : (
          <div className="text-[11px] text-gray-500">
            Default · {defaultPct}%
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {row.isOverride ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FBA70A]/15 border border-[#FBA70A]/30 px-2.5 py-1 text-xs font-semibold text-[#FBA70A]">
              {row.feePercentage}%
            </span>
            {delta !== 0 && (
              <span
                className={cn(
                  "hidden sm:inline-flex items-center gap-0.5 text-[11px] font-medium",
                  delta > 0 ? "text-rose-300" : "text-emerald-300"
                )}
                title={`${delta > 0 ? "+" : ""}${delta.toFixed(1)} vs ${defaultPct}% default`}
              >
                {delta > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}
              </span>
            )}
          </div>
        ) : (
          <span className="hidden sm:inline-flex items-center rounded-md bg-[#15151b] border border-[#2a2a35] px-2.5 py-1 text-xs font-medium text-gray-300">
            {row.feePercentage}%
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#15151b] hover:text-white"
        >
          {row.isOverride ? (
            <>
              <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 sm:mr-1.5 text-[#FBA70A]" />
              <span className="hidden sm:inline">Set custom</span>
            </>
          )}
        </Button>
        {row.isOverride && onReset && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="text-gray-400 hover:bg-[#15151b] hover:text-white"
            title="Reset to default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
