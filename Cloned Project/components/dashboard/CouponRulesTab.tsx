"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Loader2,
  Sparkles,
  Trash2,
  Edit2,
  Repeat,
  Zap,
  Tv,
  GraduationCap,
  BookOpen,
  ShoppingBag,
  Phone,
  Info,
  Building2,
  Layers,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { CouponRuleEditor } from "./CouponRuleEditor";

export type CouponRuleProductType =
  // Founder-scope items
  | "channel"
  | "course"
  | "workshop"
  | "product"
  | "service"
  | "call"
  // Admin-scope items
  | "office_plan"
  | "unilevel_plus"
  | "third_party_subscription";

export type CouponRuleScope = "platform" | "organization";

export interface CouponRule {
  _id: string;
  scope?: CouponRuleScope;
  orgId?: string;
  name: string;
  type: "purchase_based";
  triggerProductType: CouponRuleProductType;
  /** Missing → wildcard rule (fires on any item of triggerProductType). */
  triggerItemId?: string;
  /** True when this is a wildcard rule. Convenience flag from the backend. */
  isWildcard?: boolean;
  triggerItemTitle: string;
  triggerItemImage?: string;
  triggerQuantity: number;
  rewardCouponId: string;
  rewardCoupon: {
    _id: string;
    code: string;
    name: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    currency?: "USD" | "INR";
  } | null;
  rewardQuantity: number;
  recurrence: "once" | "every";
  isActive: boolean;
  effectiveFrom: string;
  createdAt: string;
}

const PRODUCT_ICON: Record<CouponRuleProductType, React.ReactNode> = {
  channel: <Tv className="h-3.5 w-3.5" />,
  course: <GraduationCap className="h-3.5 w-3.5" />,
  workshop: <BookOpen className="h-3.5 w-3.5" />,
  product: <ShoppingBag className="h-3.5 w-3.5" />,
  service: <Sparkles className="h-3.5 w-3.5" />,
  call: <Phone className="h-3.5 w-3.5" />,
  office_plan: <Building2 className="h-3.5 w-3.5" />,
  unilevel_plus: <Layers className="h-3.5 w-3.5" />,
  third_party_subscription: <Network className="h-3.5 w-3.5" />,
};

interface Props {
  /** Where the rules CRUD lives — e.g. "/org/{orgId}/coupon-rules" or "/garage-admin/coupon-rules". */
  rulesEndpoint: string;
  /** Where the unified items picker lives (returns all sellables for this scope). */
  itemsEndpoint: string;
  /** Where the reward-coupon list lives (only this scope's coupons). */
  couponsEndpoint: string;
  authToken: string;
  scope: CouponRuleScope;
}

export function CouponRulesTab({
  rulesEndpoint,
  itemsEndpoint,
  couponsEndpoint,
  authToken,
  scope,
}: Props) {
  const [rules, setRules] = useState<CouponRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CouponRule | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${rulesEndpoint}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
      } else {
        toast.error(data.error || "Failed to load rules");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [rulesEndpoint, authToken]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleActive = async (rule: CouponRule) => {
    try {
      const res = await fetch(`${API_URL}${rulesEndpoint}/${rule._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to toggle");
        return;
      }
      setRules((prev) =>
        prev.map((r) => (r._id === rule._id ? { ...r, isActive: !r.isActive } : r))
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle");
    }
  };

  const deleteRule = async (rule: CouponRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}${rulesEndpoint}/${rule._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to delete");
        return;
      }
      setRules((prev) => prev.filter((r) => r._id !== rule._id));
      toast.success("Rule deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  const formatDiscount = (
    c: NonNullable<CouponRule["rewardCoupon"]>
  ): string => {
    const sym = c.currency === "INR" ? "₹" : "$";
    if (c.discountType === "fixed") {
      return `${sym}${(c.discountValue / 100).toFixed(2)} off`;
    }
    return `${c.discountValue}% off`;
  };

  const activeCount = rules.filter((r) => r.isActive).length;

  // Scope-specific copy
  const heroCopy =
    scope === "platform"
      ? "Reward customers automatically based on platform-level purchases."
      : "Reward customers automatically based on what they buy.";
  const emptyCopy =
    scope === "platform"
      ? "Set up your first automation to reward customers when they subscribe to office plans, buy unilevel plus, or sign up for third-party subscriptions."
      : "Set up your first automation to reward customers automatically when they buy from your office.";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0e0e12] via-[#0e0e12] to-brand/[0.03] border border-[#2a2a35] overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-brand/10 flex items-center justify-center ring-1 ring-brand/20">
              <Zap className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Automation Rules
                {rules.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-semibold">
                    {activeCount}/{rules.length} active
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#9fa0b8] mt-0.5">{heroCopy}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingRule(null);
              setEditorOpen(true);
            }}
            className="bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-all duration-200 active:scale-95 hover:shadow-[0_0_24px_color-mix(in_srgb,_var(--brand)_30%,_transparent)] px-4 h-9 rounded-lg text-sm font-semibold flex items-center gap-1.5 group"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            New Rule
          </button>
        </div>
        <div className="border-t border-[#2a2a35] px-5 py-2.5 bg-[#0a0a0e]/40 flex items-start gap-2 text-[11px] text-[#9fa0b8]">
          <Info className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
          <span>
            Rules apply only to purchases made{" "}
            <span className="text-white font-medium">after</span> the rule is
            created. Existing customers won&apos;t be retroactively rewarded.
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[#6b6b80]" />
        </div>
      ) : rules.length === 0 ? (
        <div className="relative flex flex-col items-center py-16 animate-in fade-in duration-500 rounded-2xl bg-gradient-to-br from-[#0e0e12] to-[#0a0a0e] border border-[#2a2a35] overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--brand) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="relative h-14 w-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-4 ring-1 ring-brand/20">
            <Zap className="h-6 w-6 text-brand" />
            <div className="absolute inset-0 rounded-2xl bg-brand/20 blur-xl -z-10" />
          </div>
          <p className="text-base font-semibold text-white">No rules yet</p>
          <p className="text-xs text-[#6b6b80] mt-1.5 max-w-sm text-center px-4 leading-relaxed">
            {emptyCopy}
          </p>
          <button
            onClick={() => {
              setEditingRule(null);
              setEditorOpen(true);
            }}
            className="mt-5 bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:shadow-[0_0_24px_color-mix(in_srgb,_var(--brand)_30%,_transparent)] active:scale-95 transition-all duration-200 px-4 h-9 rounded-lg text-sm font-semibold flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((rule, idx) => (
            <div
              key={rule._id}
              className={cn(
                "group relative rounded-2xl border overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
                rule.isActive
                  ? "bg-[#0e0e12] border-[#2a2a35] hover:border-brand/40 hover:shadow-[0_8px_30px_-12px_color-mix(in_srgb,_var(--brand)_20%,_transparent)]"
                  : "bg-[#0a0a0e] border-[#1a1a22] opacity-60 hover:opacity-80"
              )}
              style={{
                animationDelay: `${Math.min(idx, 12) * 40}ms`,
                animationFillMode: "both",
              }}
            >
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-0.5 transition-all duration-300",
                  rule.isActive
                    ? "bg-gradient-to-b from-brand via-brand/40 to-transparent"
                    : "bg-[#2a2a35]"
                )}
              />
              <div className="p-4 pl-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#9fa0b8] leading-relaxed">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80]">
                        When
                      </span>
                      <span className="px-2 py-1 rounded-md bg-[#1a1a22] text-white font-mono font-semibold text-sm tabular-nums">
                        {rule.triggerQuantity}
                      </span>
                      <span className="text-[#6b6b80]">×</span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1a1a22] ring-1 ring-[#2a2a35] group-hover:ring-brand/20 transition">
                        {rule.triggerItemImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rule.triggerItemImage}
                            alt=""
                            className="h-4 w-4 rounded object-cover"
                          />
                        ) : (
                          <span className="text-brand">
                            {PRODUCT_ICON[rule.triggerProductType]}
                          </span>
                        )}
                        <span className="text-white text-xs font-medium truncate max-w-[200px]">
                          {rule.triggerItemTitle}
                        </span>
                      </span>
                      <span className="text-brand text-base mx-0.5">→</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b80]">
                        Get
                      </span>
                      <span className="px-2 py-1 rounded-md bg-brand/10 text-brand font-mono font-semibold text-sm tabular-nums">
                        {rule.rewardQuantity}
                      </span>
                      <span className="text-[#9fa0b8]">
                        {rule.rewardQuantity === 1 ? "use of" : "uses of"}
                      </span>
                      {rule.rewardCoupon ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand/10 ring-1 ring-brand/20 text-brand">
                          <code className="text-xs font-mono font-semibold">
                            {rule.rewardCoupon.code}
                          </code>
                          <span className="text-[10px] opacity-80">
                            · {formatDiscount(rule.rewardCoupon)}
                          </span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-xs">
                          coupon deleted
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold",
                          rule.recurrence === "every"
                            ? "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20"
                            : "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                        )}
                      >
                        <Repeat className="h-2.5 w-2.5" />
                        {rule.recurrence === "every" ? "Every time" : "One time"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium",
                          rule.isActive
                            ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            rule.isActive ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"
                          )}
                        />
                        {rule.isActive ? "Live" : "Paused"}
                      </span>
                      <span className="text-[10px] text-[#6b6b80]">
                        Active since{" "}
                        {new Date(rule.effectiveFrom).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        rule.isActive
                          ? "bg-brand shadow-[0_0_12px_color-mix(in_srgb,_var(--brand)_40%,_transparent)]"
                          : "bg-[#2a2a35]"
                      )}
                      title={rule.isActive ? "Pause rule" : "Activate rule"}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 ease-out shadow-md",
                          rule.isActive ? "left-[22px]" : "left-0.5"
                        )}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setEditorOpen(true);
                      }}
                      title="Edit"
                      className="h-8 w-8 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22] rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule)}
                      title="Delete"
                      className="h-8 w-8 p-0 text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CouponRuleEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingRule(null);
        }}
        rulesEndpoint={rulesEndpoint}
        itemsEndpoint={itemsEndpoint}
        couponsEndpoint={couponsEndpoint}
        authToken={authToken}
        scope={scope}
        editingRule={editingRule}
        onSaved={fetchRules}
      />
    </div>
  );
}
