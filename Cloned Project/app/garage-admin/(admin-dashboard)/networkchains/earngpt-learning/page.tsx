"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { TableTopBar, type TopBarView } from "@/components/data-table/TableTopBar";
import {
  AppliedFilterChips,
  type FilterChip,
} from "@/components/data-table/AppliedFilterChips";
import type { ColumnDef } from "@/components/data-table/types";
import { ExportPanel, ExportButton, type ExportField } from "@/components/data-table/ExportPanel";
import {
  getSuggestionFeedback,
  AdminUnauthorizedError,
  type AdminSuggestionFeedbackItem,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

type OptionFilter = "" | "wrong" | "close" | "chosen";

const OUTCOME_LABEL: Record<AdminSuggestionFeedbackItem["option"], string> = {
  wrong: "Completely wrong",
  close: "Close",
  chosen: "Chosen",
};

/** CSV columns for the EarnGPT learning feedback table (export order). */
const FEEDBACK_EXPORT_FIELDS: ExportField<AdminSuggestionFeedbackItem>[] = [
  { key: "when", label: "When", value: (r) => r.createdAt ?? "" },
  { key: "direction", label: "Direction", value: (r) => (r.direction === "product" ? "Product → for contact" : "Contact → for product") },
  { key: "suggested", label: "Suggested", value: (r) => r.suggestedName || r.suggestedId || "" },
  { key: "outcome", label: "Outcome", value: (r) => OUTCOME_LABEL[r.option] ?? r.option },
  { key: "reasoning", label: "Reasoning Shown", value: (r) => r.reasoning ?? "" },
  { key: "note", label: "User Note", value: (r) => r.freeText ?? "" },
  { key: "userId", label: "User ID", value: (r) => r.userId ?? "" },
  { key: "anchorId", label: "Anchor ID", value: (r) => r.anchorId ?? "" },
  { key: "suggestedId", label: "Suggested ID", value: (r) => r.suggestedId ?? "" },
];

const OPTION_META: Record<
  AdminSuggestionFeedbackItem["option"],
  { label: string; className: string }
> = {
  wrong: { label: "Completely wrong", className: "bg-red-500/15 text-red-300 border-red-500/25" },
  close: { label: "Close", className: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  chosen: { label: "Chosen", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
};

const VIEWS: TopBarView[] = [
  { id: "", label: "All Outcomes" },
  { id: "chosen", label: "Chosen" },
  { id: "close", label: "Close" },
  { id: "wrong", label: "Wrong" },
];
const VIEW_LABEL: Record<string, string> = {
  chosen: "Chosen",
  close: "Close",
  wrong: "Wrong",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function EarnGPTLearningPage() {
  const [rows, setRows] = useState<AdminSuggestionFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [option, setOption] = useState<OptionFilter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  // Caps the auth-recovery retry to one attempt per failure episode — see
  // reload below. Without this, an operator de-allowlisted at the endpoint
  // level but still elevatable would loop forever hammering the backend.
  // Re-arms on the next successful fetch.
  const recoveryAttempted = useRef(false);

  // Pull every feedback row for the current outcome filter, page by page.
  const fetchAllFeedback = useCallback(async (): Promise<AdminSuggestionFeedbackItem[]> => {
    const out: AdminSuggestionFeedbackItem[] = [];
    for (let p = 1; ; p++) {
      const d = await getSuggestionFeedback(p, option || undefined);
      out.push(...d.feedback);
      if (d.feedback.length === 0 || out.length >= d.pagination.total || p >= (d.pagination.totalPages || 1)) break;
    }
    return out;
  }, [option]);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    getSuggestionFeedback(page, option || undefined)
      .then((d) => {
        setRows(d.feedback);
        setTotal(d.pagination.total);
        setTotalPages(d.pagination.totalPages || 1);
        if (d.pagination.limit) setLimit(d.pagination.limit);
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      })
      .catch((e) => {
        if (e instanceof AdminUnauthorizedError) {
          // Recover by silently re-elevating from the Garage session rather
          // than reloading, which would drop the operator out of the Garage
          // shell. lib/nc-admin-api/auth.ts already clears the stale NC token
          // on every path that throws this error, so no page-level clear is
          // needed here.
          if (recoveryAttempted.current) return; // one attempt per failure episode
          recoveryAttempted.current = true;
          ensureNcAdminToken().then((result) => {
            if (result.ok === true) {
              reload();
            }
          });
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load feedback");
      })
      .finally(() => setLoading(false));
  }, [page, option]);

  useEffect(() => {
    reload();
  }, [reload]);

  const chips: FilterChip[] = [];
  if (option) {
    chips.push({
      id: "outcome",
      label: `Outcome: ${VIEW_LABEL[option]}`,
      onClear: () => {
        setOption("");
        setPage(1);
      },
    });
  }

  const columns = useMemo<ColumnDef<AdminSuggestionFeedbackItem>[]>(
    () => [
      {
        id: "when",
        header: "When",
        frozen: true,
        width: 150,
        cell: (r) => (
          <span className="whitespace-nowrap text-zinc-400">{formatDateTime(r.createdAt)}</span>
        ),
      },
      {
        id: "suggested",
        header: "Suggested",
        width: 240,
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-white">
              {r.suggestedName || r.suggestedId}
            </div>
            <div className="mt-0.5 text-[12px] text-zinc-500">
              {r.direction === "product" ? "Product → for contact" : "Contact → for product"}
            </div>
          </div>
        ),
      },
      {
        id: "outcome",
        header: "Outcome",
        width: 160,
        cell: (r) => {
          const meta = OPTION_META[r.option];
          return (
            <span
              className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] ${meta.className}`}
            >
              {meta.label}
            </span>
          );
        },
      },
      {
        id: "reasoning",
        header: "Reasoning shown",
        width: 300,
        cell: (r) =>
          r.reasoning ? (
            <span className="line-clamp-3 text-zinc-400">{r.reasoning}</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      },
      {
        id: "note",
        header: "User note",
        width: 300,
        cell: (r) =>
          r.freeText ? (
            <span className="line-clamp-3 italic text-zinc-300">“{r.freeText}”</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      <div className="flex-none px-4 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">EarnGPT Learning</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Every suggestion outcome users teach EarnGPT
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <DataTable<AdminSuggestionFeedbackItem>
          tableId="admin-earngpt-learning"
          columns={columns}
          rows={rows}
          getRowId={(r) => r._id}
          loading={loading}
          emptyLabel="No feedback recorded yet."
          rowHeight="auto"
          headerHeight={48}
          stickyBg="#181818"
          topBar={
            <>
              <TableTopBar
                views={VIEWS}
                activeView={option}
                onViewChange={(v) => {
                  setOption(v as OptionFilter);
                  setPage(1);
                }}
                actions={<ExportButton onClick={() => setExportOpen(true)} />}
              />
              <AppliedFilterChips
                chips={chips}
                onClearAll={() => {
                  setOption("");
                  setPage(1);
                }}
              />
            </>
          }
          footerTotals={[{ label: "Total Feedback", value: total }]}
          pagination={{
            page,
            totalPages: Math.max(1, totalPages),
            rangeLabel: rangeLabel(page, limit, total),
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
          }}
        />
      </div>

      <ExportPanel<AdminSuggestionFeedbackItem>
        open={exportOpen}
        onOpenChange={setExportOpen}
        fields={FEEDBACK_EXPORT_FIELDS}
        fetchAll={fetchAllFeedback}
        filenameBase="admin-earngpt-learning"
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
