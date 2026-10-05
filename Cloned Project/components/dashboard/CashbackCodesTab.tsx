"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  TicketPercent,
  Plus,
  Send,
  MoreHorizontal,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ListChecks,
  Package,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CashbackCodeSheet } from "./CashbackCodeSheet";
import {
  useCashbackCodes,
  useCashbackSummary,
  setCashbackCodeStatus,
  type CashbackCode,
} from "@/lib/hooks/useCashbackCodes";

interface Props {
  orgId: string | null;
}

function StatusPill({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        status === "active"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-[#1a1a22] text-[#6b6b80] border-[#2a2a35]"
      )}
    >
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function ProductTypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand/10 text-brand border border-brand/20 capitalize">
      {type}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: "gold" | "emerald";
}) {
  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "p-1.5 rounded-lg",
            accent === "emerald"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-brand/10 text-brand"
          )}
        >
          {icon}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-[#6b6b80]">
          {label}
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-[11px] text-[#6b6b80] mt-1">{hint}</div>}
    </div>
  );
}

function CodeRow({
  c,
  onEdit,
  onViewDistributions,
  onToggleStatus,
}: {
  c: CashbackCode;
  onEdit: (c: CashbackCode) => void;
  onViewDistributions: (c: CashbackCode) => void;
  onToggleStatus: (c: CashbackCode) => void;
}) {
  const usageText =
    c.maxUsageCount && c.maxUsageCount > 0
      ? `${c.currentUsageCount} / ${c.maxUsageCount}`
      : `${c.currentUsageCount}`;

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] hover:bg-[#10101a] transition-colors">
      <div className="p-3 sm:p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <TicketPercent className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-white">
              {c.code}
            </span>
            <StatusPill status={c.status} />
            <ProductTypePill type={c.productType} />
            {c.allowedBuyerIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35]">
                {c.allowedBuyerIds.length} buyer
                {c.allowedBuyerIds.length === 1 ? "" : "s"} only
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-[#9fa0b8] truncate">
            {c.name}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#6b6b80]">
            <span className="text-brand font-medium">{c.ratePct}%</span>
            <span>·</span>
            <span>Used {usageText}</span>
            {c.cycleCount > 1 && (
              <>
                <span>·</span>
                <span>{c.cycleCount} cycles</span>
              </>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors shrink-0"
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#0e0e12] border-[#2a2a35] text-white"
          >
            <DropdownMenuItem
              onClick={() => onEdit(c)}
              className="text-sm focus:bg-[#1a1a22]"
            >
              <Edit2 className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onViewDistributions(c)}
              className="text-sm focus:bg-[#1a1a22]"
            >
              <ListChecks className="w-3.5 h-3.5 mr-2" />
              View distributions
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onToggleStatus(c)}
              className="text-sm focus:bg-[#1a1a22]"
            >
              {c.status === "active" ? (
                <>
                  <ToggleLeft className="w-3.5 h-3.5 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <ToggleRight className="w-3.5 h-3.5 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function CashbackCodesTab({ orgId }: Props) {
  const { codes, loading, refresh } = useCashbackCodes();
  const { summary, refresh: refreshSummary } = useCashbackSummary();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<
    "create" | "edit" | "distributions"
  >("create");
  const [activeCode, setActiveCode] = useState<CashbackCode | null>(null);

  const handleCreate = () => {
    setSheetMode("create");
    setActiveCode(null);
    setSheetOpen(true);
  };

  const handleEdit = (c: CashbackCode) => {
    setSheetMode("edit");
    setActiveCode(c);
    setSheetOpen(true);
  };

  const handleViewDistributions = (c: CashbackCode) => {
    setSheetMode("distributions");
    setActiveCode(c);
    setSheetOpen(true);
  };

  const handleToggleStatus = async (c: CashbackCode) => {
    const next = c.status === "active" ? "inactive" : "active";
    try {
      await setCashbackCodeStatus(c._id, next);
      toast.success(`Code ${next === "active" ? "activated" : "deactivated"}`);
      refresh();
      refreshSummary();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    }
  };

  const sorted = useMemo(
    () =>
      [...codes].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [codes]
  );

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-brand/10 border border-brand/30 rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:space-x-3">
          <div className="p-1.5 sm:p-2 bg-brand/20 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-brand mb-1">
              Cashback Codes
            </h3>
            <p className="text-xs sm:text-sm text-brand/70">
              Allocate a slice of your level-1 commission to your direct
              downline. They buy at full price; you fund the rebate from your
              Affiliate Wallet earnings — it lands in their Store Wallet for
              the seller&apos;s org right after payment.
            </p>
          </div>
        </div>
      </div>

      {/* Summary strip — creator-side stats only. Cashback received AS A
          BUYER lands in the Store Wallet transactions list; no separate
          view needed here. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard
          icon={<Send className="w-3.5 h-3.5" />}
          label="Paid Out"
          value={`$${(summary?.totalPaidOutUsd || 0).toFixed(2)}`}
          hint="from your Affiliate Wallet"
        />
        <SummaryCard
          icon={<TicketPercent className="w-3.5 h-3.5" />}
          label="Active Codes"
          value={`${summary?.activeCodesCount || 0}`}
          hint={`${summary?.totalCodesCount || 0} total`}
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">My Codes</h3>
        <button
          type="button"
          onClick={handleCreate}
          className="h-9 px-3 rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:bg-brand/90 transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Cashback Code
        </button>
      </div>

      {/* List body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-[#0e0e12] border border-[#2a2a35] animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="p-4 rounded-full bg-[#1a1a22] mb-3">
            <TicketPercent className="w-7 h-7 text-[#6b6b80]" />
          </div>
          <h3 className="text-white font-medium mb-1">No codes yet</h3>
          <p className="text-sm text-[#6b6b80] text-center max-w-xs mb-4">
            Create your first cashback code to give your direct downline a
            rebate on a specific product.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="h-9 px-3 rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:bg-brand/90 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Cashback Code
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => (
            <CodeRow
              key={c._id}
              c={c}
              onEdit={handleEdit}
              onViewDistributions={handleViewDistributions}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      <CashbackCodeSheet
        open={sheetOpen}
        mode={sheetMode}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setActiveCode(null);
        }}
        orgId={orgId}
        existing={activeCode}
        onSaved={() => {
          refresh();
          refreshSummary();
        }}
      />
    </div>
  );
}
