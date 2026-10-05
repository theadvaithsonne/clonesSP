"use client";

import { AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/feed-api";

interface WorkshopCommunitySelectorProps {
  channels: Channel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Community picker for live streams, shared by the schedule form
 * (CreateWorkshopModal) and the instant "Go Live" form. Owns the one-paid
 * community rule so both entry points can't drift apart.
 *
 * Note this is deliberately NOT components/shared/ChannelMultiSelect — that
 * one has an unconditional Select All and no paid/free constraint.
 */
export function WorkshopCommunitySelector({
  channels,
  selectedIds,
  onChange,
}: WorkshopCommunitySelectorProps) {
  // A community counts as paid when it isn't flagged free AND carries a price.
  const isPaidChannel = (c?: { isFree?: boolean; price?: number }) =>
    !!c && !c.isFree && (c.price ?? 0) > 0;

  // Is there anything for the one-paid rule to bite on? Drives the standing
  // notice — no point warning about paid communities when none exist.
  const hasPaidChannel = channels.some(isPaidChannel);
  // The free set is everything "Select All" can reach, since a paid community
  // is an exclusive choice and never part of a bulk selection.
  const freeChannelIds = channels
    .filter((c) => !isPaidChannel(c))
    .map((c) => c._id);
  const allFreeSelected =
    freeChannelIds.length > 0 &&
    freeChannelIds.every((id) => selectedIds.includes(id)) &&
    selectedIds.length === freeChannelIds.length;

  /**
   * Linking rules (FE only — BE payloads from other clients still accepted):
   *
   *   • Free communities  — select as many as you like.
   *   • Paid communities  — at most ONE, and never alongside a free one.
   *
   * A paid selection is therefore exclusive. Rather than refusing the click,
   * we swap: picking a second paid community deselects the first, and mixing
   * paid with free drops whichever side conflicts. Blocking with an error
   * made the user go and manually untick the old one first, which is the
   * same outcome with extra steps.
   *
   * A toast still fires when something was auto-removed, so the change is
   * never silent — it just reports what happened instead of preventing it.
   */
  const handleChannelToggle = (channelId: string) => {
    if (selectedIds.includes(channelId)) {
      onChange(selectedIds.filter((id) => id !== channelId));
      return;
    }

    const toggling = channels.find((c) => c._id === channelId);
    const selected = selectedIds
      .map((id) => channels.find((c) => c._id === id))
      .filter(Boolean) as typeof channels;

    if (isPaidChannel(toggling)) {
      // Paid is exclusive — it replaces everything currently selected.
      if (selected.length > 0) {
        const paidBefore = selected.find(isPaidChannel);
        toast.info(
          paidBefore
            ? `Switched to "${toggling!.title}" — only one paid community can be linked.`
            : `Unlinked the free ${selected.length === 1 ? "community" : "communities"} — a paid community can't be combined with free ones.`,
        );
      }
      onChange([channelId]);
      return;
    }

    // Free: unlimited among themselves, but can't sit next to a paid one.
    const paidSelected = selected.find(isPaidChannel);
    if (paidSelected) {
      toast.info(
        `Unlinked "${paidSelected.title}" — a paid community can't be combined with free ones.`,
      );
      onChange([channelId]);
      return;
    }

    onChange([...selectedIds, channelId]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#9fa0b8]">
          Select Communities <span className="text-red-400">*</span>
        </label>
        {channels.length > 0 && (
          <button
            type="button"
            onClick={() => {
              // "Everything selectable" is the free set, not every
              // channel — a paid one can never be part of a bulk
              // selection under the one-paid rule, so testing against
              // all channels would leave this stuck on "Select All".
              if (selectedIds.length > 0 && allFreeSelected) {
                onChange([]);
                return;
              }
              // Bulk-select honours the same rule as the individual
              // toggles: only one paid community may be linked, and a
              // paid one can't be combined with free ones. "Select
              // all" therefore means all the FREE communities — a paid
              // one is an exclusive choice the founder makes on its
              // own, so it can't be part of a bulk selection.
              const freeIds = channels
                .filter((c) => c.isFree || (c.price ?? 0) === 0)
                .map((c) => c._id);
              const paidCount = channels.length - freeIds.length;
              onChange(freeIds);
              if (freeIds.length === 0) {
                toast.info(
                  "Only one paid community can be selected, so paid communities have to be picked individually.",
                );
              } else if (paidCount > 0) {
                toast.info(
                  `Selected all free communities. Only one paid community can be selected, and it can't be combined with free ones.`,
                );
              }
            }}
            className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors"
          >
            {selectedIds.length > 0 && allFreeSelected
              ? "Deselect All"
              : "Select All"}
          </button>
        )}
      </div>

      {/* Standing rule, shown before the founder clicks anything —
          the toasts only fire after a swap has already happened, so
          without this the constraint is invisible up front. Only
          rendered when there IS a paid community to conflict with. */}
      {hasPaidChannel && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-brand/[0.06] border border-brand/25">
          <AlertCircle className="h-3.5 w-3.5 text-brand shrink-0 mt-[1px]" />
          <p className="text-[11px] leading-relaxed text-[#d8d9e3]">
            <span className="font-semibold text-brand">
              Only one paid community can be selected
            </span>{" "}
            — and it can&apos;t be combined with free ones. Picking a
            different paid community swaps out the current one. Free
            communities can be selected in any number.
          </p>
        </div>
      )}
      <div className="rounded-xl border border-[#2a2a35] overflow-hidden">
        {channels.length === 0 ? (
          <p className="text-sm text-[#9fa0b8] text-center py-6">No communities available</p>
        ) : (
          channels.map((ch) => (
            <label
              key={ch._id}
              className={cn(
                "flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-[#2a2a35] last:border-b-0 transition-colors",
                selectedIds.includes(ch._id) ? "bg-brand/5" : "bg-[#131316] hover:bg-[#222228]"
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
                <p className="text-sm font-medium text-white truncate">{ch.title}</p>
                <div className="flex items-center gap-2 text-xs text-[#9fa0b8]">
                  <span>{ch.memberCount ?? 0} {ch.memberCount === 1 ? "member" : "members"}</span>
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
                onCheckedChange={() => handleChannelToggle(ch._id)}
              />
            </label>
          ))
        )}
      </div>
    </div>
  );
}
