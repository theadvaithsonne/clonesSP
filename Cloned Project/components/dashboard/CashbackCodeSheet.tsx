"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  TicketPercent,
  X,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CashbackCodeItemPicker } from "./CashbackCodeItemPicker";
import { CashbackBuyerPicker } from "./CashbackBuyerPicker";
import {
  createCashbackCode,
  updateCashbackCode,
  fetchDistributionsForCode,
  type CashbackCode,
  type CashbackDistribution,
  type CashbackProductType,
  type EligibleBuyer,
  type EligibleItem,
} from "@/lib/hooks/useCashbackCodes";

type SheetMode = "create" | "edit" | "distributions";

interface Props {
  open: boolean;
  mode: SheetMode;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  /** Provided in edit + distributions mode. */
  existing?: CashbackCode | null;
  onSaved?: (code: CashbackCode) => void;
}

const PRODUCT_TYPES: { value: CashbackProductType; label: string }[] = [
  { value: "channel", label: "Channel" },
  { value: "course", label: "Course" },
  { value: "workshop", label: "Workshop" },
  { value: "service", label: "Service" },
  { value: "call", label: "Call" },
  { value: "product", label: "Product" },
  { value: "ecommerce", label: "Ecommerce Product" },
];

const CYCLE_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "1 cycle (one-time)" },
  { value: "2", label: "2 cycles" },
  { value: "3", label: "3 cycles" },
  { value: "6", label: "6 cycles" },
  { value: "12", label: "12 cycles" },
];

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white text-sm focus:outline-none focus:border-brand/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed placeholder-[#6b6b80]";

function formatDateLabel(iso: string | undefined) {
  if (!iso) return "Pick a date";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Pick a date";
  }
}

function FieldLabel({
  children,
  hint,
  optional,
}: {
  children: React.ReactNode;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-xs font-medium text-[#9fa0b8]">
        {children}
        {optional && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#6b6b80]">
            optional
          </span>
        )}
      </label>
      {hint && <span className="text-[11px] text-[#6b6b80]">{hint}</span>}
    </div>
  );
}

export function CashbackCodeSheet({
  open,
  mode,
  onOpenChange,
  orgId,
  existing,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const isView = mode === "distributions";
  const isCreate = mode === "create";

  // ── Form state ──
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState<CashbackProductType | "">("");
  const [item, setItem] = useState<EligibleItem | null>(null);
  const [ratePct, setRatePct] = useState<number>(5);
  const [buyers, setBuyers] = useState<EligibleBuyer[]>([]);
  const [cycleCount, setCycleCount] = useState<string>("1");
  const [validFrom, setValidFrom] = useState<string | undefined>();
  const [validUntil, setValidUntil] = useState<string | undefined>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxUsageCount, setMaxUsageCount] = useState<string>("");
  const [maxUsagePerUser, setMaxUsagePerUser] = useState<string>("");
  const [minOrderAmountUsd, setMinOrderAmountUsd] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Distributions mode state ──
  const [distributions, setDistributions] = useState<CashbackDistribution[]>(
    []
  );
  const [distLoading, setDistLoading] = useState(false);
  const [distTotals, setDistTotals] = useState<{
    completedCount: number;
    completedAmount: number;
    skippedCount: number;
    failedCount: number;
  } | null>(null);

  // Initialize when opening.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (isCreate) {
      setCode("");
      setName("");
      setDescription("");
      setProductType("");
      setItem(null);
      setRatePct(5);
      setBuyers([]);
      setCycleCount("1");
      setValidFrom(undefined);
      setValidUntil(undefined);
      setAdvancedOpen(false);
      setMaxUsageCount("");
      setMaxUsagePerUser("");
      setMinOrderAmountUsd("");
    }
    if ((isEdit || isView) && existing) {
      setCode(existing.code);
      setName(existing.name);
      setDescription(existing.description || "");
      setProductType(existing.productType);
      setItem(null); // Item is immutable on edit; we display read-only later.
      setRatePct(existing.ratePct);
      setBuyers([]); // For edit, downline isn't reloaded — keep empty unless picker opens (covered below).
      setCycleCount(String(existing.cycleCount || 1));
      setValidFrom(existing.validFrom);
      setValidUntil(existing.validUntil);
      setMaxUsageCount(
        existing.maxUsageCount ? String(existing.maxUsageCount) : ""
      );
      setMaxUsagePerUser(
        existing.maxUsagePerUser ? String(existing.maxUsagePerUser) : ""
      );
      setMinOrderAmountUsd(
        existing.minOrderAmountCents
          ? (existing.minOrderAmountCents / 100).toFixed(2)
          : ""
      );
    }
  }, [open, isCreate, isEdit, isView, existing]);

  // Distributions fetch when opening in view mode.
  useEffect(() => {
    if (!open || !isView || !existing) return;
    setDistLoading(true);
    fetchDistributionsForCode(existing._id)
      .then(({ distributions, totals }) => {
        setDistributions(distributions);
        setDistTotals(totals);
      })
      .finally(() => setDistLoading(false));
  }, [open, isView, existing]);

  // ── Live preview text ──
  const livePreview = useMemo(() => {
    const codeStr = code || "CODE";
    const rateStr = `${ratePct}%`;
    const itemTitle = isEdit
      ? existing?.name || "this product"
      : item?.title || "the selected product";
    const audience =
      buyers.length === 0
        ? "any direct downline"
        : `${buyers.length} selected buyer${buyers.length === 1 ? "" : "s"}`;
    return `${codeStr} — ${rateStr} cashback on “${itemTitle}” for ${audience}.`;
  }, [code, ratePct, item, isEdit, existing, buyers]);

  // ── Submit ──
  const handleSubmit = async () => {
    setError(null);

    // Client-side validation.
    if (isCreate) {
      if (!/^[A-Za-z0-9_-]{3,20}$/.test(code)) {
        setError("Code must be 3-20 chars (A-Z, 0-9, _, -).");
        return;
      }
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      if (!productType) {
        setError("Pick a product type.");
        return;
      }
      if (!item) {
        setError("Pick a product.");
        return;
      }
    }
    if (ratePct <= 0 || ratePct > 100) {
      setError("Rate must be greater than 0 and ≤ 100.");
      return;
    }
    if (validFrom && validUntil && new Date(validFrom) > new Date(validUntil)) {
      setError("Valid Until must be on or after Valid From.");
      return;
    }

    setSubmitting(true);
    try {
      if (isCreate) {
        const saved = await createCashbackCode({
          code: code.toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          productType: productType as CashbackProductType,
          itemId: item!.itemId,
          ratePct,
          allowedBuyerIds:
            buyers.length > 0 ? buyers.map((b) => b._id) : undefined,
          cycleCount: Number(cycleCount) || 1,
          validFrom: validFrom || undefined,
          validUntil: validUntil || undefined,
          maxUsageCount: maxUsageCount ? Number(maxUsageCount) : undefined,
          maxUsagePerUser: maxUsagePerUser
            ? Number(maxUsagePerUser)
            : undefined,
          minOrderAmountCents: minOrderAmountUsd
            ? Math.round(Number(minOrderAmountUsd) * 100)
            : undefined,
        });
        toast.success("Cashback code created");
        onSaved?.(saved);
        onOpenChange(false);
      } else if (isEdit && existing) {
        const saved = await updateCashbackCode(existing._id, {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          ratePct,
          allowedBuyerIds:
            buyers.length > 0 ? buyers.map((b) => b._id) : undefined,
          cycleCount: Number(cycleCount) || undefined,
          validFrom: validFrom || undefined,
          validUntil: validUntil || undefined,
          maxUsageCount: maxUsageCount ? Number(maxUsageCount) : undefined,
          maxUsagePerUser: maxUsagePerUser
            ? Number(maxUsagePerUser)
            : undefined,
          minOrderAmountCents: minOrderAmountUsd
            ? Math.round(Number(minOrderAmountUsd) * 100)
            : undefined,
        });
        toast.success("Cashback code updated");
        onSaved?.(saved);
        onOpenChange(false);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  const title = isCreate
    ? "New Cashback Code"
    : isEdit
    ? "Edit Cashback Code"
    : "Cashback Distributions";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-full sm:!max-w-md p-0 flex flex-col bg-[#0a0a0e] border-l border-[#2a2a35]"
      >
        {/* Sticky header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#2a2a35] bg-[#0a0a0e]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-brand/10 border border-brand/30 shrink-0">
                <TicketPercent className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base text-white">
                  {title}
                </SheetTitle>
                <SheetDescription className="text-xs text-[#9fa0b8] mt-0.5">
                  {isCreate
                    ? "Allocate a slice of your level-1 commission to a direct downline."
                    : isEdit
                    ? "Only mutable fields can change. Code and product are locked."
                    : `${distributions.length} payout${
                        distributions.length === 1 ? "" : "s"
                      } recorded.`}
                </SheetDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Live preview card (form modes only) */}
          {!isView && (
            <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <p className="text-xs text-brand/90 leading-relaxed">
                {livePreview}
              </p>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isView ? (
            <DistributionsView
              loading={distLoading}
              totals={distTotals}
              rows={distributions}
            />
          ) : (
            <div className="space-y-5">
              {/* Code */}
              <div>
                <FieldLabel hint="3-20 chars · A-Z 0-9 _ -">Code</FieldLabel>
                <input
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().slice(0, 20))
                  }
                  disabled={isEdit}
                  placeholder="SAVE5"
                  className={cn(INPUT_CLASS, "font-mono tracking-wide")}
                />
              </div>

              {/* Name */}
              <div>
                <FieldLabel>Name</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q3 cashback for early supporters"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Description */}
              <div>
                <FieldLabel optional>Description</FieldLabel>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal note — buyers won't see this."
                  rows={2}
                  className="bg-[#1a1a22] border-[#2a2a35] text-white text-sm placeholder-[#6b6b80] focus-visible:border-brand/40 focus-visible:ring-0"
                />
              </div>

              {/* Product Type */}
              <div>
                <FieldLabel>Product Type</FieldLabel>
                <Select
                  value={productType}
                  onValueChange={(v) => {
                    setProductType(v as CashbackProductType);
                    setItem(null);
                  }}
                  disabled={isEdit}
                >
                  <SelectTrigger
                    className={cn(
                      "!h-10 bg-[#1a1a22] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
                      "focus:border-brand/40 focus:ring-0 data-[size=default]:h-10"
                    )}
                  >
                    <SelectValue placeholder="Choose product type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                    {PRODUCT_TYPES.map((p) => (
                      <SelectItem
                        key={p.value}
                        value={p.value}
                        className="text-sm focus:bg-[#1a1a22] focus:text-white"
                      >
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product picker */}
              <div>
                <FieldLabel
                  hint={
                    productType
                      ? "Products in your active org"
                      : undefined
                  }
                >
                  Product
                </FieldLabel>
                {isEdit ? (
                  <div className="px-3 h-10 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center text-sm text-[#9fa0b8]">
                    Bound at creation — cannot be changed.
                  </div>
                ) : (
                  <CashbackCodeItemPicker
                    productType={productType}
                    orgId={orgId}
                    value={item}
                    onChange={setItem}
                  />
                )}
              </div>

              {/* Rate */}
              <div>
                <FieldLabel hint="Capped at the real level-1 rate at payout">
                  Cashback Rate
                </FieldLabel>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[ratePct]}
                    onValueChange={(v) => setRatePct(v[0] ?? 0)}
                    min={1}
                    max={100}
                    step={0.5}
                    className="flex-1"
                  />
                  <div className="relative w-20">
                    <input
                      type="number"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={ratePct}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setRatePct(n);
                      }}
                      className={cn(INPUT_CLASS, "pr-7 text-right")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6b6b80] pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Buyer Whitelist */}
              <div>
                <FieldLabel
                  optional
                  hint="Leave empty for any direct downline"
                >
                  Buyer Whitelist
                </FieldLabel>
                <CashbackBuyerPicker
                  selected={buyers}
                  onChange={setBuyers}
                />
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel optional>Valid From</FieldLabel>
                  <DatePickerField
                    value={validFrom}
                    onChange={setValidFrom}
                  />
                </div>
                <div>
                  <FieldLabel optional>Valid Until</FieldLabel>
                  <DatePickerField
                    value={validUntil}
                    onChange={setValidUntil}
                  />
                </div>
              </div>

              {/* Cycle count */}
              <div>
                <FieldLabel hint="For subscription products">
                  Cycle Count
                </FieldLabel>
                <Select value={cycleCount} onValueChange={setCycleCount}>
                  <SelectTrigger
                    className={cn(
                      "!h-10 bg-[#1a1a22] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
                      "focus:border-brand/40 focus:ring-0 data-[size=default]:h-10"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                    {CYCLE_OPTIONS.map((o) => (
                      <SelectItem
                        key={o.value}
                        value={o.value}
                        className="text-sm focus:bg-[#1a1a22] focus:text-white"
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced */}
              <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12]">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-medium text-[#9fa0b8] hover:text-white transition-colors"
                >
                  Advanced limits
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      advancedOpen && "rotate-180"
                    )}
                  />
                </button>
                {advancedOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-3">
                    <div>
                      <FieldLabel optional>Max Total Uses</FieldLabel>
                      <input
                        type="number"
                        min={1}
                        value={maxUsageCount}
                        onChange={(e) => setMaxUsageCount(e.target.value)}
                        placeholder="Unlimited"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <FieldLabel optional>Max Uses Per Buyer</FieldLabel>
                      <input
                        type="number"
                        min={1}
                        value={maxUsagePerUser}
                        onChange={(e) => setMaxUsagePerUser(e.target.value)}
                        placeholder="Unlimited"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <FieldLabel optional>Min Order Amount</FieldLabel>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6b6b80] pointer-events-none">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={minOrderAmountUsd}
                          onChange={(e) => setMinOrderAmountUsd(e.target.value)}
                          placeholder="0.00"
                          className={cn(INPUT_CLASS, "pl-6")}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        {!isView && (
          <div className="shrink-0 border-t border-[#2a2a35] bg-[#0a0a0e] px-5 py-3 space-y-2">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 px-4 rounded-lg text-sm text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  "h-10 px-4 rounded-lg text-sm font-medium bg-brand text-brand-foreground",
                  "hover:bg-brand/90 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                )}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCreate ? "Create Code" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Calendar date field
// ──────────────────────────────────────────────────────────────────────

function DatePickerField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
}) {
  const [openCal, setOpenCal] = useState(false);
  const dateObj = value ? new Date(value) : undefined;

  return (
    <Popover open={openCal} onOpenChange={setOpenCal}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white text-sm",
            "flex items-center gap-2 hover:border-[#3a3a45] transition-colors",
            "focus:outline-none focus:border-brand/40"
          )}
        >
          <CalendarDays className="w-4 h-4 text-[#6b6b80] shrink-0" />
          <span
            className={cn(
              "flex-1 text-left",
              !value && "text-[#6b6b80]"
            )}
          >
            {formatDateLabel(value)}
          </span>
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="text-[#6b6b80] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 bg-[#0e0e12] border-[#2a2a35]"
      >
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(d: Date | undefined) => {
            onChange(d ? d.toISOString() : undefined);
            setOpenCal(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Distributions list
// ──────────────────────────────────────────────────────────────────────

function StatusPill({
  status,
}: {
  status: "completed" | "skipped" | "failed";
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Paid
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle className="w-2.5 h-2.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-2.5 h-2.5" />
      Skipped
    </span>
  );
}

function DistributionsView({
  loading,
  totals,
  rows,
}: {
  loading: boolean;
  totals: {
    completedCount: number;
    completedAmount: number;
    skippedCount: number;
    failedCount: number;
  } | null;
  rows: CashbackDistribution[];
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg bg-[#1a1a22] animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {totals && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[#6b6b80]">
              Paid
            </div>
            <div className="text-sm font-semibold text-emerald-400 mt-0.5">
              ${totals.completedAmount.toFixed(2)}
            </div>
            <div className="text-[10px] text-[#6b6b80]">
              {totals.completedCount} payout
              {totals.completedCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[#6b6b80]">
              Skipped
            </div>
            <div className="text-sm font-semibold text-amber-400 mt-0.5">
              {totals.skippedCount}
            </div>
          </div>
          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[#6b6b80]">
              Failed
            </div>
            <div className="text-sm font-semibold text-red-400 mt-0.5">
              {totals.failedCount}
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <div className="p-3 rounded-full bg-[#1a1a22] mb-3">
            <TicketPercent className="w-5 h-5 text-[#6b6b80]" />
          </div>
          <p className="text-sm text-white font-medium">No payouts yet</p>
          <p className="text-xs text-[#6b6b80] text-center max-w-xs mt-1">
            When a whitelisted buyer applies this code and pays, the payout
            will land here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r._id}
              className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[#9fa0b8]">
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-[#6b6b80]">
                    Sale ${(r.saleAmountCents / 100).toFixed(2)} ·{" "}
                    {r.appliedRatePct}% applied
                  </div>
                  {r.failureReason && (
                    <div className="text-[11px] text-red-400 mt-0.5 truncate">
                      {r.failureReason}
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold shrink-0",
                    r.status === "completed"
                      ? "text-emerald-400"
                      : "text-[#6b6b80]"
                  )}
                >
                  {r.status === "completed" ? "+" : ""}$
                  {r.cashbackAmount.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
