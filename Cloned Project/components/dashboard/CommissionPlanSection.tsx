"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Percent,
  Lock,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CombPlanLevel,
  CombPlan,
  CombPlanKind,
  createCombPlan,
  updateCombPlan,
  getCombPlanForItem,
  getCombPlanForItemPublic,
} from "@/lib/feed-api";
import { toast } from "sonner";

interface CommissionPlanSectionProps {
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId?: string; // undefined for new items
  itemName: string;
  isPaid?: boolean; // defaults to true for calls
  onPlanCreated?: (plan: CombPlan) => void;
  className?: string;
}

export function CommissionPlanSection({
  itemType,
  itemId,
  itemName,
  isPaid,
  onPlanCreated,
  className,
}: CommissionPlanSectionProps) {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingPlan, setExistingPlan] = useState<CombPlan | null>(null);
  const [levels, setLevels] = useState<CombPlanLevel[]>([
    { level: 1, percentage: 10, description: "Level 1" },
  ]);
  // Which comp engine this plan drives. "levels" is the historical behaviour
  // and stays the default, so an existing item's editor looks unchanged.
  const [planKind, setPlanKind] = useState<CombPlanKind>("levels");
  const [upPercentage, setUpPercentage] = useState<number>(10);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newLevels = [...levels];
    const temp = newLevels[draggedIndex];
    newLevels.splice(draggedIndex, 1);
    newLevels.splice(targetIndex, 0, temp);

    const updated = newLevels.map((l, idx) => ({
      ...l,
      level: idx + 1,
    }));
    setLevels(updated);
    setDraggedIndex(null);
  };

  const PLATFORM_FEE = 5;
  // Max 90% — leaves 5% for the platform AND a 5% seller floor. Kept in
  // sync with backend (combPlan.model.ts + commission.ts COMB_PLAN_MAX_PERCENTAGE).
  const MAX_COMMISSION = 90;

  // Load existing plan if editing
  useEffect(() => {
    if (itemId) {
      loadExistingPlan();
    }
  }, [itemId]);

  const loadExistingPlan = async () => {
    if (!itemId) return;
    try {
      const result = await getCombPlanForItem(itemType, itemId);
      if (result.plan) {
        setExistingPlan(result.plan);
        // A unilevel_plus plan stores levels: []. Keep the editor's default
        // row so switching back to "Levels" isn't an empty, unusable list.
        if (result.plan.levels && result.plan.levels.length > 0) {
          setLevels(result.plan.levels);
        }
        // Legacy plans carry no planKind — they are levels plans.
        setPlanKind(result.plan.planKind || "levels");
        if (typeof result.plan.unilevelPlusPercentage === "number") {
          setUpPercentage(result.plan.unilevelPlusPercentage);
        }
        setEnabled(true);
        setExpanded(true);
      }
    } catch (err) {
      console.error("Error loading comb plan:", err);
    }
  };

  const totalCommission = levels.reduce((sum, l) => sum + l.percentage, 0);
  // What the founder is actually committing, whichever engine is selected.
  // For Unilevel Plus this is a CEILING — unearned pools return to the seller —
  // which is why the UI qualifies it with "or more" wherever it's shown.
  const activeCommission =
    planKind === "unilevel_plus" ? upPercentage : totalCommission;
  const remainingPercentage = MAX_COMMISSION - totalCommission;
  const sellerPercentage = 100 - PLATFORM_FEE - totalCommission;

  const addLevel = () => {
    if (levels.length >= 10) {
      toast.error("Maximum 10 levels allowed");
      return;
    }
    const nextLevel = levels.length + 1;
    const defaultPercentage = Math.min(5, remainingPercentage);
    if (defaultPercentage <= 0) {
      toast.error("No more commission percentage available");
      return;
    }
    setLevels([
      ...levels,
      {
        level: nextLevel,
        percentage: defaultPercentage,
        description: `Level ${nextLevel}`,
      },
    ]);
  };

  const removeLevel = (index: number) => {
    if (levels.length <= 1) {
      toast.error("At least one level is required");
      return;
    }
    const newLevels = levels.filter((_, i) => i !== index);
    setLevels(newLevels.map((l, i) => ({ ...l, level: i + 1 })));
  };

  const updateLevel = (
    index: number,
    field: keyof CombPlanLevel,
    value: number | string
  ) => {
    const newLevels = [...levels];
    if (field === "percentage") {
      const newPercentage = Number(value);
      const otherTotal = levels.reduce(
        (sum, l, i) => (i === index ? sum : sum + l.percentage),
        0
      );
      if (otherTotal + newPercentage > MAX_COMMISSION) {
        toast.error(`Total commission cannot exceed ${MAX_COMMISSION}%`);
        return;
      }
      newLevels[index] = { ...newLevels[index], percentage: newPercentage };
    } else {
      newLevels[index] = { ...newLevels[index], [field]: value };
    }
    setLevels(newLevels);
  };

  const savePlan = async (newItemId: string) => {
    // A unilevel_plus plan carries no levels, so the levels.length guard
    // would reject it outright.
    if (!enabled) return null;
    if (planKind === "levels" && levels.length === 0) return null;
    if (planKind === "unilevel_plus" && !(upPercentage > 0)) {
      toast.error("Enter a percentage greater than 0");
      return null;
    }

    // Every plan is perpetual: commission is paid on every purchase, with no
    // per-customer ceiling. The backend still accepts `per_pair_capped` for the
    // plans that were capped before this became a single behaviour — saving one
    // of those from here converts it to perpetual, which is the point.
    const capPayload = { capType: "perpetual" as const };

    setLoading(true);
    try {
      // The two engines are mutually exclusive — the backend rejects a plan
      // carrying both, so send only the shape that matches the choice.
      const kindPayload =
        planKind === "unilevel_plus"
          ? {
              planKind: "unilevel_plus" as const,
              unilevelPlusPercentage: upPercentage,
              levels: [],
            }
          : { planKind: "levels" as const, levels };

      if (existingPlan) {
        const result = await updateCombPlan(existingPlan._id, {
          ...kindPayload,
          ...capPayload,
        });
        toast.success("Commission plan updated");
        onPlanCreated?.(result.plan);
        return result.plan;
      } else {
        const result = await createCombPlan({
          name: `${itemName} Commission Plan`,
          itemType,
          itemId: newItemId,
          ...kindPayload,
          ...capPayload,
        });
        toast.success("Commission plan created");
        onPlanCreated?.(result.plan);
        return result.plan;
      }
    } catch (err) {
      console.error("Error saving commission plan:", err);
      toast.error("Failed to save commission plan");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Expose savePlan method via ref or callback
  useEffect(() => {
    (window as any).__commissionPlanSave = savePlan;
    (window as any).__commissionPlanInfo = {
      enabled,
      levels,
      planKind,
      unilevelPlusPercentage: upPercentage,
      // For a unilevel_plus plan the founder's single percentage IS the
      // total, so callers reading this for a summary get the right number
      // either way.
      totalCommission:
        planKind === "unilevel_plus"
          ? upPercentage
          : levels.reduce((sum, l) => sum + l.percentage, 0),
    };
    return () => {
      delete (window as any).__commissionPlanSave;
      delete (window as any).__commissionPlanInfo;
    };
  }, [enabled, levels, planKind, upPercentage, existingPlan, itemName]);

  // For calls, isPaid defaults to true since we show commission for paid calls
  if (isPaid === false) {
    return null;
  }

  const sellerFloor = Math.max(0, 100 - PLATFORM_FEE - activeCommission);

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden border border-[#262626] bg-gradient-to-b from-[#1C1C1C] to-[#161616]",
        className
      )}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
        onClick={() => enabled && setExpanded(!expanded)}
      >
        <div className="h-9 w-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 text-brand" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white leading-tight">
            Affiliate commission
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
            {enabled
              ? planKind === "unilevel_plus"
                ? `Unilevel Plus · up to ${upPercentage}% to your network`
                : `${levels.length} level${levels.length === 1 ? "" : "s"} · ${totalCommission}% to your network`
              : "Reward affiliates who bring you sales"}
          </p>
        </div>

        {enabled && (
          <span className="hidden sm:inline-flex items-center rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand tabular-nums">
            You keep {sellerFloor}%
            {planKind === "unilevel_plus" ? "+" : ""}
          </span>
        )}

        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            if (checked) setExpanded(true);
          }}
          onClick={(e) => e.stopPropagation()}
          className="data-[state=checked]:bg-brand"
        />

        {enabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-zinc-500 hover:text-white transition-colors shrink-0"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {enabled && expanded && (
        <div className="border-t border-[#262626] px-5 py-5 space-y-6">
          {/* Allocation bar — where each sale actually goes. Derived only from
              numbers we know for certain, so it can never drift from the
              backend's own split. */}
          <div className="space-y-2.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#0F0F0F] ring-1 ring-inset ring-white/5">
              <div
                className="bg-zinc-600 transition-all duration-300"
                style={{ width: `${PLATFORM_FEE}%` }}
              />
              <div
                className="bg-brand transition-all duration-300"
                style={{ width: `${activeCommission}%` }}
              />
              <div
                className="bg-emerald-500/70 transition-all duration-300"
                style={{ width: `${sellerFloor}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <i className="h-2 w-2 rounded-full bg-zinc-600" />
                Platform{" "}
                <b className="text-zinc-200 font-semibold tabular-nums">
                  {PLATFORM_FEE}%
                </b>
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <i className="h-2 w-2 rounded-full bg-brand" />
                {planKind === "unilevel_plus" ? "Network (max)" : "Affiliates"}{" "}
                <b className="text-zinc-200 font-semibold tabular-nums">
                  {activeCommission}%
                </b>
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <i className="h-2 w-2 rounded-full bg-emerald-500/70" />
                You keep{" "}
                <b className="text-zinc-200 font-semibold tabular-nums">
                  {sellerFloor}%
                  {planKind === "unilevel_plus" ? " or more" : ""}
                </b>
              </span>
            </div>
          </div>

          {/* Structure picker */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Structure
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    kind: "levels" as const,
                    title: "Levels",
                    blurb: "You set a % for each level — L1, L2, L3…",
                  },
                  {
                    kind: "unilevel_plus" as const,
                    title: "Unilevel Plus",
                    blurb: "One % flows into the Unilevel Plus tree",
                  },
                ]
              ).map((opt) => {
                const active = planKind === opt.kind;
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => setPlanKind(opt.kind)}
                    className={cn(
                      "group relative text-left rounded-xl border p-3.5 transition-all duration-150",
                      active
                        ? "border-brand/50 bg-brand/[0.07] shadow-[0_0_0_1px_color-mix(in_srgb,_var(--brand)_15%,_transparent)]"
                        : "border-[#282828] bg-[#141414] hover:border-[#3a3a3a] hover:bg-[#181818]"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          active
                            ? "border-brand"
                            : "border-zinc-600 group-hover:border-zinc-500"
                        )}
                      >
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[13px] font-semibold leading-tight",
                            active ? "text-white" : "text-zinc-300"
                          )}
                        >
                          {opt.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                          {opt.blurb}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Unilevel Plus ── */}
          {planKind === "unilevel_plus" && (
            <div className="space-y-4">
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Network share
              </h4>

              <div className="rounded-xl border border-[#282828] bg-[#141414] p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-[110px] shrink-0">
                    <Input
                      type="number"
                      min={0}
                      max={MAX_COMMISSION}
                      value={upPercentage}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setUpPercentage(
                          Math.max(0, Math.min(MAX_COMMISSION, v))
                        );
                      }}
                      className="h-11 bg-[#0F0F0F] border-[#2a2a2a] text-white text-lg font-semibold tabular-nums pr-9 focus:border-brand/50 focus:ring-brand/20"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    of every sale flows into the{" "}
                    <span className="text-white font-medium">
                      Unilevel Plus
                    </span>{" "}
                    tree.
                  </p>
                </div>

                <input
                  type="range"
                  min={0}
                  max={MAX_COMMISSION}
                  step={1}
                  value={upPercentage}
                  onChange={(e) => setUpPercentage(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#262626] accent-brand"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 tabular-nums -mt-1.5">
                  <span>0%</span>
                  <span>{MAX_COMMISSION}%</span>
                </div>
              </div>

              {/* The honest bit — a ceiling, not a fee. Historically only about
                  half of what enters the tree is actually earned; the rest
                  returns to the seller, not the platform. Saying so here is
                  cheaper than the support ticket it prevents. */}
              <div className="flex gap-3 rounded-xl border border-[#282828] bg-[#141414] p-3.5">
                <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-[12px] text-zinc-300 font-medium leading-snug">
                    Your network earns up to {upPercentage}% — not a flat fee.
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Unilevel Plus pays the buyer&apos;s direct referrer first,
                    then spreads what&apos;s left across 15 levels and its
                    infinity tiers. How much is actually earned depends on how
                    deep and how active that upline is.{" "}
                    <span className="text-zinc-300">
                      Anything unearned stays with you.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Levels ── */}
          {planKind === "levels" && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Levels
                </h4>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {remainingPercentage}% left
                </span>
              </div>

              <div className="space-y-2">
                {levels.map((level, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl border border-[#282828] bg-[#141414] p-2.5 transition-all",
                      draggedIndex === index
                        ? "opacity-40 scale-[0.99]"
                        : "hover:border-[#3a3a3a]"
                    )}
                  >
                    <span className="h-8 w-8 shrink-0 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-[11px] font-bold text-brand tabular-nums cursor-grab active:cursor-grabbing">
                      L{level.level}
                    </span>

                    <Input
                      type="text"
                      value={level.description || ""}
                      onChange={(e) =>
                        updateLevel(index, "description", e.target.value)
                      }
                      placeholder={`Level ${level.level}`}
                      className="h-9 flex-1 min-w-0 bg-[#0F0F0F] border-[#2a2a2a] text-white text-[13px] focus:border-brand/40 focus:ring-brand/20"
                    />

                    <div className="relative w-[88px] shrink-0">
                      <Input
                        type="number"
                        min="1"
                        max={level.percentage + remainingPercentage}
                        value={level.percentage}
                        onChange={(e) =>
                          updateLevel(index, "percentage", e.target.value)
                        }
                        className="h-9 bg-[#0F0F0F] border-[#2a2a2a] text-white text-[13px] font-semibold tabular-nums pr-7 focus:border-brand/40 focus:ring-brand/20"
                      />
                      <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLevel(index)}
                      disabled={levels.length <= 1}
                      className="h-9 w-9 shrink-0 rounded-lg border border-[#282828] bg-[#0F0F0F] text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLevel}
                disabled={levels.length >= 10 || remainingPercentage <= 0}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2f2f2f] py-2.5 text-[12px] font-semibold text-zinc-400 transition-colors hover:border-brand/40 hover:text-brand hover:bg-brand/[0.04] disabled:opacity-40 disabled:pointer-events-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Add level
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function for parent components to save the commission plan
export async function saveCommissionPlan(
  itemId: string
): Promise<CombPlan | null> {
  const saveFn = (window as any).__commissionPlanSave;
  if (saveFn) {
    return saveFn(itemId);
  }
  return null;
}

// ============= Read-Only Display Component for Edit Page =============

interface CompPlanDisplayProps {
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: string;
  className?: string;
}

export function CompPlanDisplay({
  itemType,
  itemId,
  className,
}: CompPlanDisplayProps) {
  const [plan, setPlan] = useState<CombPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const PLATFORM_FEE = 5;

  useEffect(() => {
    loadPlan();
  }, [itemId, itemType]);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const result = await getCombPlanForItem(itemType, itemId);
      setPlan(result.plan);
    } catch (err) {
      console.error("Error loading comp plan:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("border border-[#262626] rounded-lg p-4", className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-[#262626] animate-pulse" />
          <div className="h-4 w-32 bg-[#262626] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Don't render if no plan exists
  if (!plan) {
    return null;
  }

  // A unilevel_plus plan carries NO levels — reading them would render
  // "0 levels · 0%" for a perfectly valid plan.
  const isUp = plan.planKind === "unilevel_plus";
  const totalCommission = isUp
    ? plan.unilevelPlusPercentage || 0
    : plan.levels.reduce((sum, l) => sum + l.percentage, 0);
  const sellerPercentage = 100 - PLATFORM_FEE - totalCommission;

  return (
    <div
      className={cn(
        "border border-[#262626] rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#1A1A1A] cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/10">
            <Users className="h-4 w-4 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">
                Affiliate Commission Plan
              </p>
              <Lock className="h-3 w-3 text-zinc-400" />
            </div>
            <p className="text-xs text-zinc-400">
              {isUp
                ? `Unilevel Plus · up to ${totalCommission}% to the network`
                : `${plan.levels.length} level${plan.levels.length > 1 ? "s" : ""} · ${totalCommission.toFixed(2)}% total commission`}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 py-4 space-y-4 border-t border-[#262626]">
          {/* Info Notice */}
          <div className="flex items-start gap-2 p-3 bg-brand/5 rounded-lg border border-brand/20">
            <Info className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-400">
              Commission plans cannot be modified after creation. This ensures
              consistency for affiliates who promote your course.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#141414] rounded-lg p-3 text-center">
              <p className="text-lg font-semibold text-white">
                {PLATFORM_FEE.toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-400">Platform Fee</p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3 text-center">
              <p className="text-lg font-semibold text-brand">
                {totalCommission.toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-400">Affiliate Commission</p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3 text-center">
              <p className="text-lg font-semibold text-green-400">
                {sellerPercentage.toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-400">You Keep</p>
            </div>
          </div>

          {/* Commission Levels */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Commission Breakdown
            </p>
            {isUp && (
              <div className="flex items-start gap-3 p-3 bg-[#141414] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3 w-3 text-brand" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">Unilevel Plus tree</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                    Pays the direct referrer first, then 15 levels and infinity
                    tiers. Anything unearned returns to the seller.
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Percent className="h-3 w-3 text-zinc-400" />
                  <span className="text-sm font-medium text-brand">
                    up to {totalCommission}
                  </span>
                </div>
              </div>
            )}
            {plan.levels.map((level) => (
              <div
                key={level.level}
                className="flex items-center gap-3 p-3 bg-[#141414] rounded-lg"
              >
                <span className="w-6 h-6 rounded-full bg-[#262626] flex items-center justify-center text-zinc-400 text-xs font-medium flex-shrink-0">
                  {level.level}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-white">
                    {level.description || `Level ${level.level} Referrer`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Percent className="h-3 w-3 text-zinc-400" />
                  <span className="text-sm font-medium text-brand">
                    {level.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Cap-type disclosure — surface only when the founder
              explicitly capped the plan. Silent for perpetual (which
              matches what buyers have always seen). */}
          {plan.capType === "per_pair_capped" &&
            typeof plan.capCount === "number" && (
              <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
                <p className="text-xs text-zinc-300">
                  <span className="font-semibold text-brand">
                    Capped per customer:
                  </span>{" "}
                  Each affiliate earns commission on the first{" "}
                  {plan.capCount} purchase{plan.capCount === 1 ? "" : "s"}{" "}
                  a customer makes of this item.
                </p>
              </div>
            )}

          {/* Plan Details */}
          <div className="pt-2 border-t border-[#262626]">
            <p className="text-xs text-zinc-400">
              Plan created on{" "}
              {new Date(plan.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= Small Badge Component for Course Cards =============

interface CompPlanBadgeProps {
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: string;
  /** Item price for calculating earnings */
  price?: number;
  /** Currency symbol (defaults to $) */
  currency?: string;
  /** Whether the current user is a founder - shows full details if true */
  isFounder?: boolean;
  /** Use public API (no auth required) - for guest pages */
  usePublicApi?: boolean;
  className?: string;
}

export function CompPlanBadge({
  itemType,
  itemId,
  price,
  currency = "$",
  isFounder = false,
  usePublicApi = false,
  className,
}: CompPlanBadgeProps) {
  const [plan, setPlan] = useState<CombPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const PLATFORM_FEE = 5;

  // Helper to calculate amount from percentage
  const calculateAmount = (percentage: number): number => {
    if (!price || price <= 0) return 0;
    // Commission is calculated on the FULL sale price — matches the
    // backend in services/commission.ts where `commissionAmount =
    // saleAmount * percentage / 100`. Do NOT apply the platform fee
    // first; the platform fee and the affiliate split both come out of
    // the 100% price, in parallel.
    return Math.round((price * percentage) / 100 * 100) / 100;
  };

  // Format currency amount
  const formatAmount = (amount: number): string => {
    return `${currency}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (itemId) {
      loadPlan();
    }
  }, [itemId, itemType]);

  // Calculate panel position when expanded
  const updatePanelPosition = useCallback(() => {
    if (badgeRef.current && expanded) {
      const rect = badgeRef.current.getBoundingClientRect();
      const panelWidth = 288; // w-72 = 18rem = 288px

      // Position below the badge, aligned to the right
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = rect.right - panelWidth;
      let top = rect.bottom + 8;

      // Make sure it doesn't go off-screen to the left
      if (left < 8) {
        left = 8;
      }

      // Make sure it doesn't go off-screen to the right
      if (left + panelWidth > viewportWidth - 8) {
        left = viewportWidth - panelWidth - 8;
      }

      // If panel would go off bottom, show it above the badge instead
      const panelHeight = 300; // approximate panel height
      if (top + panelHeight > viewportHeight) {
        top = rect.top - panelHeight - 8;
        // If still off screen, just position at top with some margin
        if (top < 8) {
          top = 8;
        }
      }

      setPanelPosition({ top, left });
    }
  }, [expanded]);

  useEffect(() => {
    updatePanelPosition();

    if (expanded) {
      window.addEventListener("scroll", updatePanelPosition, true);
      window.addEventListener("resize", updatePanelPosition);
      return () => {
        window.removeEventListener("scroll", updatePanelPosition, true);
        window.removeEventListener("resize", updatePanelPosition);
      };
    }
  }, [expanded, updatePanelPosition]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        badgeRef.current &&
        !badgeRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setExpanded(false);
      }
    };

    if (expanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [expanded]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };

    if (expanded) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [expanded]);

  const loadPlan = async () => {
    try {
      const fetchFn = usePublicApi ? getCombPlanForItemPublic : getCombPlanForItem;
      const result = await fetchFn(itemType, itemId);
      if (result?.plan) {
        setPlan(result.plan);
      }
    } catch (err) {
      console.error(
        `[CompPlanBadge] Error loading plan for ${itemType}/${itemId}:`,
        err
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading || !plan) {
    return null;
  }

  const isUp = plan.planKind === "unilevel_plus";
  const totalCommission = isUp
    ? plan.unilevelPlusPercentage || 0
    : plan.levels.reduce((sum, l) => sum + l.percentage, 0);
  const sellerPercentage = 100 - PLATFORM_FEE - totalCommission;

  // Badge styling based on user type
  const badgeColor = isFounder ? "#FBD10D" : "#22c55e"; // Yellow for founders, green for affiliates

  // Full expandable badge for both founders and affiliates
  return (
    <>
      {/* Badge Button */}
      <button
        ref={badgeRef}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setExpanded(!expanded);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200",
          isFounder
            ? "bg-brand/20 border border-brand/40 hover:bg-brand/30 hover:border-brand/60"
            : "bg-green-500/20 border border-green-500/40 hover:bg-green-500/30 hover:border-green-500/60",
          "backdrop-blur-sm",
          expanded && (isFounder ? "bg-brand/30 border-brand/60" : "bg-green-500/30 border-green-500/60"),
          className
        )}
      >
        <Users className="h-3 w-3" style={{ color: badgeColor }} />
        <span className="text-[10px] font-medium" style={{ color: badgeColor }}>
          {isUp ? "Unilevel+" : `${plan.levels.length}L Affiliate`}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            expanded && "rotate-180"
          )}
          style={{ color: badgeColor }}
        />
      </button>

      {/* Expanded Panel - Rendered via Portal */}
      {expanded &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed w-72 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div
                className="px-4 py-3 border-b border-[#262626]"
                style={{ background: `linear-gradient(to right, ${badgeColor}1A, transparent)` }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${badgeColor}33` }}
                  >
                    <Users className="h-4 w-4" style={{ color: badgeColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isFounder ? "Affiliate Commission" : "Your Earnings"}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {isUp
                        ? "Unilevel Plus Structure"
                        : `${plan.levels.length}-Level MLM Structure`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-px bg-[#262626]">
                <div className="bg-[#1A1A1A] px-3 py-2.5 text-center">
                  <p className="text-base font-bold text-white">
                    {PLATFORM_FEE.toFixed(2)}%
                  </p>
                  {price && price > 0 && (
                    <p className="text-[10px] text-zinc-400">
                      {formatAmount(
                        Math.round(price * 0.05 * 100) / 100
                      )}
                    </p>
                  )}
                  <p className="text-[9px] text-zinc-400 uppercase tracking-wider">
                    Platform
                  </p>
                </div>
                <div className="bg-[#1A1A1A] px-3 py-2.5 text-center">
                  <p className="text-base font-bold" style={{ color: badgeColor }}>
                    {totalCommission.toFixed(2)}%
                  </p>
                  {price && price > 0 && (
                    <p className="text-[10px]" style={{ color: `${badgeColor}B3` }}>
                      {formatAmount(calculateAmount(totalCommission))}
                    </p>
                  )}
                  <p className="text-[9px] text-zinc-400 uppercase tracking-wider">
                    {isFounder ? "Affiliates" : "Total Pool"}
                  </p>
                </div>
                <div className="bg-[#1A1A1A] px-3 py-2.5 text-center">
                  <p className="text-base font-bold text-green-400">
                    {(isFounder ? sellerPercentage : totalCommission).toFixed(2)}%
                  </p>
                  {price && price > 0 && (
                    <p className="text-[10px] text-green-400/70">
                      {formatAmount(calculateAmount(isFounder ? sellerPercentage : totalCommission))}
                    </p>
                  )}
                  <p className="text-[9px] text-zinc-400 uppercase tracking-wider">
                    {isFounder ? "You Keep" : "You Earn"}
                  </p>
                </div>
              </div>

              {/* Levels */}
              <div className="p-3 space-y-1.5">
                {isUp && (
                  <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[#141414]">
                    <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center">
                      <Users className="h-2.5 w-2.5 text-brand" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-white font-medium">
                        Unilevel Plus tree
                      </p>
                      <p className="text-[9px] text-zinc-500 leading-relaxed mt-0.5">
                        Direct referrer first, then 15 levels and infinity
                        tiers
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-semibold shrink-0 tabular-nums"
                      style={{ color: badgeColor }}
                    >
                      up to {totalCommission}%
                    </span>
                  </div>
                )}
                {plan.levels.map((level, idx) => {
                  const levelAmount = calculateAmount(level.percentage);
                  return (
                    <div
                      key={level.level}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#141414] hover:bg-[#141414]/80 transition-colors"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${
                            idx === 0
                              ? "#FBD10D"
                              : idx === 1
                              ? "#a855f7"
                              : "#3b82f6"
                          } 0%, ${
                            idx === 0
                              ? "#f59e0b"
                              : idx === 1
                              ? "#7c3aed"
                              : "#1d4ed8"
                          } 100%)`,
                          color: "white",
                        }}
                      >
                        {level.level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">
                          {level.description || `Level ${level.level} Referrer`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-[#262626] px-2 py-0.5 rounded-full">
                          <Percent className="h-2.5 w-2.5" style={{ color: badgeColor }} />
                          <span className="text-xs font-semibold" style={{ color: badgeColor }}>
                            {level.percentage.toFixed(2)}%
                          </span>
                        </div>
                        {price && price > 0 && levelAmount > 0 && (
                          <span className="text-[10px] font-medium text-green-400">
                            {formatAmount(levelAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-[#141414] border-t border-[#262626]">
                <p className="text-[9px] text-zinc-400 text-center">
                  {isFounder
                    ? "Affiliates earn commissions when customers they refer make a purchase"
                    : "Earn commissions from your referrals and their downstream network"}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
