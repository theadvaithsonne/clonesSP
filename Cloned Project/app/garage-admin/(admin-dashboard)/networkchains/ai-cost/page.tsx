"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, DollarSign, ChevronRight } from "lucide-react";
import {
  AdminUnauthorizedError,
  ADMIN_PRODUCTS,
  PRODUCT_LABELS,
  formatCents,
  type AdminProduct,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import {
  useUsageSummary,
  useUsageUser,
  useUsageUsers,
} from "@/lib/hooks/use-admin-usage";

// ── Date helpers ──────────────────────────────────────────────────────────────

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDay(from), to: isoDay(to) };
}

// Convert a YYYY-MM-DD input value into an ISO timestamp for the API.
const toIso = (day: string, endOfDay = false) =>
  new Date(`${day}T${endOfDay ? "23:59:59" : "00:00:00"}.000Z`).toISOString();

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiCostPage() {
  const [{ from, to }, setRange] = useState(defaultRange());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const fromIso = toIso(from);
  const toIsoStr = toIso(to, true);

  const summary = useUsageSummary(fromIso, toIsoStr);
  const users = useUsageUsers(fromIso, toIsoStr);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once the data loads again.
  const recoveryAttempted = useRef(false);

  useEffect(() => {
    const unauth =
      summary.error instanceof AdminUnauthorizedError ||
      users.error instanceof AdminUnauthorizedError;
    if (!unauth) {
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      return;
    }
    if (recoveryAttempted.current) return; // one attempt per failure episode
    recoveryAttempted.current = true;
    ensureNcAdminToken().then((result) => {
      if (result.ok === true) {
        summary.refetch();
        users.refetch();
      }
    });
  }, [summary.error, users.error]);

  const sortedUsers = useMemo(() => {
    const list = users.data?.users ?? [];
    return [...list].sort((a, b) => b.totalCostCents - a.totalCostCents);
  }, [users.data]);

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] px-8 pb-8 pt-7 text-white">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFC200] to-[#FFA800]">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AI Cost</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Per-user spend by product, model and tokens
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="bg-transparent text-xs text-zinc-300 outline-none [color-scheme:dark]"
            />
            <span className="text-xs text-zinc-600">→</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="bg-transparent text-xs text-zinc-300 outline-none [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        {summary.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
          </div>
        ) : summary.isError ? (
          <p className="py-4 text-center text-sm text-red-400">
            {(summary.error as Error)?.message || "Failed to load summary"}
          </p>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                Total spend
              </p>
              <p className="mt-1 text-3xl font-semibold text-white">
                {formatCents(summary.data?.totalCostCents, 2)}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {from} → {to}
              </p>
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              {ADMIN_PRODUCTS.map((p) => (
                <div
                  key={p}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {PRODUCT_LABELS[p]}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-white">
                    {formatCents(summary.data?.byProduct?.[p], 4)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold">Users by spend</h2>
        {users.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
          </div>
        ) : users.isError ? (
          <p className="py-6 text-center text-sm text-red-400">
            {(users.error as Error)?.message || "Failed to load users"}
          </p>
        ) : sortedUsers.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">
            No usage in this period
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 text-right font-medium">Total</th>
                  {ADMIN_PRODUCTS.map((p) => (
                    <th key={p} className="pb-3 text-right font-medium">
                      {PRODUCT_LABELS[p]}
                    </th>
                  ))}
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => (
                  <tr
                    key={u.userId}
                    onClick={() => setSelectedUser(u.userId)}
                    className="group cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                  >
                    <td className="py-3.5">
                      <div className="font-medium text-white">
                        {u.name || "—"}
                      </div>
                      <div className="text-[10px] text-zinc-500">{u.email}</div>
                    </td>
                    <td className="py-3.5 text-right font-mono text-[#FFD24D]">
                      {formatCents(u.totalCostCents, 4)}
                    </td>
                    {ADMIN_PRODUCTS.map((p) => (
                      <td
                        key={p}
                        className="py-3.5 text-right font-mono text-xs text-zinc-400"
                      >
                        {u.byProduct?.[p] != null
                          ? formatCents(u.byProduct[p], 4)
                          : "—"}
                      </td>
                    ))}
                    <td className="py-3.5 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-zinc-600 transition group-hover:text-[#FFC200]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down sheet */}
      {selectedUser && (
        <DrillDown
          userId={selectedUser}
          from={fromIso}
          to={toIsoStr}
          name={
            sortedUsers.find((u) => u.userId === selectedUser)?.name ||
            sortedUsers.find((u) => u.userId === selectedUser)?.email
          }
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

// ── Drill-down side panel ─────────────────────────────────────────────────────

function DrillDown({
  userId,
  from,
  to,
  name,
  onClose,
}: {
  userId: string;
  from: string;
  to: string;
  name?: string;
  onClose: () => void;
}) {
  const detail = useUsageUser(userId, from, to);

  const trackedProducts = new Set(
    (detail.data?.products ?? []).map((p) => p.product),
  );
  const untracked = ADMIN_PRODUCTS.filter(
    (p) => !trackedProducts.has(p),
  ) as AdminProduct[];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.1] bg-[#0a0a0a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {name || "User"}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              {userId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {detail.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFC200]" />
          </div>
        ) : detail.isError ? (
          <p className="py-8 text-center text-sm text-red-400">
            {(detail.error as Error)?.message || "Failed to load detail"}
          </p>
        ) : (
          <div className="space-y-4">
            {(detail.data?.products ?? []).map((block) => (
              <div
                key={block.product}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    {PRODUCT_LABELS[block.product] ?? block.product}
                  </h4>
                  <span className="font-mono text-sm text-[#FFD24D]">
                    {formatCents(block.costCents, 4)}
                  </span>
                </div>
                <div className="space-y-2">
                  {block.models.map((m, i) => (
                    <div
                      key={`${m.provider}-${m.model}-${i}`}
                      className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-white">
                            {m.model}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {m.provider} · {m.kind} · {m.requests} req
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-zinc-300">
                          {formatCents(m.costCents, 4)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                        {(m.promptTokens > 0 || m.completionTokens > 0) && (
                          <span>
                            tokens:{" "}
                            <span className="text-zinc-300">
                              {m.promptTokens.toLocaleString()}
                            </span>{" "}
                            in /{" "}
                            <span className="text-zinc-300">
                              {m.completionTokens.toLocaleString()}
                            </span>{" "}
                            out
                          </span>
                        )}
                        {m.audioSeconds > 0 && (
                          <span>
                            audio:{" "}
                            <span className="text-zinc-300">
                              {(m.audioSeconds / 60).toFixed(1)}m
                            </span>
                          </span>
                        )}
                        {m.characters > 0 && (
                          <span>
                            chars:{" "}
                            <span className="text-zinc-300">
                              {m.characters.toLocaleString()}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {untracked.length > 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-4">
                <p className="text-[11px] text-zinc-600">
                  Not yet tracked:{" "}
                  {untracked.map((p) => PRODUCT_LABELS[p]).join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
