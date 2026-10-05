"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Check, Upload } from "lucide-react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One exportable column: a stable key, a display label, an optional visual
 *  indent (sub-item under the row above it), and a CSV value accessor. */
export interface ExportField<T> {
  key: string;
  label: string;
  indent?: boolean;
  value: (row: T) => string | number;
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv<T>(filename: string, fields: ExportField<T>[], rows: T[]): void {
  const header = fields.map((f) => csvEscape(f.label)).join(",");
  const body = rows.map((r) => fields.map((f) => csvEscape(f.value(r))).join(",")).join("\n");
  const csv = "﻿" + header + "\n" + body; // BOM so Excel reads UTF-8
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The shared Export side panel used across every table (Rolodex, Downline, and
 * the admin tables). Step 1 offers "All Fields" or "Choose Fields"; step 2 is
 * the field picker. On export it pulls the whole current view via `fetchAll`
 * and downloads a CSV of the selected fields.
 *
 * `fetchAll` returns every row that should be exported — for server-paginated
 * tables it loops pages with the current filters; for fully client-loaded
 * tables it just returns the in-memory (filtered/sorted) array.
 */
export function ExportPanel<T>({
  open,
  onOpenChange,
  fields,
  fetchAll,
  filenameBase,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fields: ExportField<T>[];
  fetchAll: () => Promise<T[]>;
  /** File name stem, e.g. "admin-users" → downloads "admin-users.csv". */
  filenameBase: string;
}) {
  const [step, setStep] = useState<"mode" | "fields">("mode");
  const [selected, setSelected] = useState<Set<string>>(new Set(fields.map((f) => f.key)));
  const [busy, setBusy] = useState(false);

  // Always reopen on the mode step, and resync the selection if the field set
  // changes between opens.
  useEffect(() => {
    if (open) {
      setStep("mode");
      setSelected(new Set(fields.map((f) => f.key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runExport = async (cols: ExportField<T>[]): Promise<void> => {
    if (busy || cols.length === 0) return;
    setBusy(true);
    try {
      const rows = await fetchAll();
      const slug = filenameBase.toLowerCase().replace(/\s+/g, "-");
      downloadCsv(`${slug}.csv`, cols, rows);
      onOpenChange(false);
    } catch {
      // best-effort; the drawer stays open so the user can retry
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string): void =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const chosen = fields.filter((f) => selected.has(f.key));

  return (
    <FormDrawer
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onOpenChange(false);
      }}
      title="Export"
      footer={
        step === "fields" ? (
          <Button
            onClick={() => runExport(chosen)}
            disabled={busy || chosen.length === 0}
            className="w-full gap-2 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Exporting…" : `Export${chosen.length ? ` (${chosen.length})` : ""}`}
          </Button>
        ) : undefined
      }
    >
      {step === "mode" ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => runExport(fields)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04] disabled:opacity-60"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/rolodex/export-all-fields.png" alt="" className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white">All Fields</div>
              <div className="text-xs text-zinc-500">Your spreadsheet will include all fields.</div>
            </div>
            {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />}
          </button>

          <button
            type="button"
            onClick={() => setStep("fields")}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/rolodex/export-choose-fields.png" alt="" className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white">Choose Fields</div>
              <div className="text-xs text-zinc-500">You can choose the fields you want to export.</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setStep("mode")}
            className="mb-2 inline-flex items-center text-xs text-zinc-400 transition hover:text-white"
          >
            ‹ Back
          </button>
          {fields.map((f) => {
            const on = selected.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggle(f.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.04]",
                  f.indent && "pl-9",
                )}
              >
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded border transition",
                    on ? "border-brand bg-brand text-brand-foreground" : "border-white/20",
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="text-sm text-zinc-200">{f.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </FormDrawer>
  );
}

/** Small shared trigger for the top bar's `actions` slot — an Upload icon that
 *  opens the Export panel (mirrors the Rolodex export button). */
export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Export"
      title="Export"
      className="grid h-9 w-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
    >
      <Upload className="h-4 w-4" />
    </button>
  );
}
