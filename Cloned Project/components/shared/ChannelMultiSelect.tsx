"use client";

/**
 * ChannelMultiSelect — a founder-facing picker for restricting an item
 * (course / product / workshop / etc.) to members of specific channels.
 *
 * When the item's `channelIds` array is empty, the item is unrestricted
 * (visible to every stakeholder in the org). When non-empty, the BE
 * filter (see services/channelMembership.ts::getUserChannelIds) shows the
 * item only to members of at least one of the selected channels.
 *
 * Extracted from the inline picker in WorkshopsPage.tsx (audience block).
 * All Workshops-page behaviours preserved: individual per-row toggle
 * switches, a header "Select All / Deselect All" affordance, per-channel
 * avatar + member count, and an empty state when the org has no channels.
 */
import * as React from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export interface ChannelOption {
  _id: string;
  title: string;
  logo?: string;
  memberCount?: number;
  isFree?: boolean;
  price?: number;
  currency?: string;
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
}

interface Props {
  channels: ChannelOption[];
  selectedIds: string[];
  onChange: (nextSelectedIds: string[]) => void;
  /** Label text; defaults to "Select Communities". */
  label?: string;
  /** When true, appends a red asterisk to the label — purely visual. */
  required?: boolean;
  /**
   * Optional hint shown under the picker. Kept as prop so item-specific
   * copy (e.g. "Members of these communities will see this course.") can
   * differ per surface.
   */
  hint?: string;
}

export function ChannelMultiSelect({
  channels,
  selectedIds,
  onChange,
  label = "Select Communities",
  required = false,
  hint,
}: Props) {
  const allIds = React.useMemo(() => channels.map((c) => c._id), [channels]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((existing) => existing !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#9fa0b8]">
          {label}
          {required && <span className="text-red-400"> *</span>}
        </label>
        {channels.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : allIds)}
            className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>
      <div className="rounded-xl border border-[#2a2a35] overflow-hidden">
        {channels.length === 0 ? (
          <p className="text-sm text-[#9fa0b8] text-center py-6">
            No communities available
          </p>
        ) : (
          channels.map((ch) => (
            <label
              key={ch._id}
              className={cn(
                "flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-[#2a2a35] last:border-b-0 transition-colors",
                selectedIds.includes(ch._id)
                  ? "bg-brand/5"
                  : "bg-[#131316] hover:bg-[#222228]",
              )}
            >
              {ch.logo ? (
                <img
                  src={ch.logo}
                  alt={ch.title}
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#2a2a35] flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-[#9fa0b8]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {ch.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#9fa0b8]">
                  <span>
                    {ch.memberCount ?? 0}{" "}
                    {ch.memberCount === 1 ? "member" : "members"}
                  </span>
                  <span>&bull;</span>
                  {(ch.isFree || !ch.price || ch.price === 0) ? (
                    <span>Free</span>
                  ) : (
                    <span>
                      {ch.currency === "INR" ? "₹" : "$"}{(ch.price || 0).toFixed(2)}
                      {ch.isSubscription && `/${ch.subscriptionPeriod?.slice(0, 2) || "mo"}`}
                    </span>
                  )}
                </div>
              </div>
              <Switch
                checked={selectedIds.includes(ch._id)}
                onCheckedChange={() => toggle(ch._id)}
              />
            </label>
          ))
        )}
      </div>
      {hint && <p className="text-[11px] text-[#6b6b80] leading-relaxed">{hint}</p>}
    </div>
  );
}
