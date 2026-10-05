"use client";

/**
 * FounderMembersPanel
 *
 * Rebuilt version of the "Members" page inside Founder:Communities.
 * The prior implementation used raw <select> + <table>, filtered
 * client-side (so search only saw the current page), and never
 * surfaced the new subscription state fields (cancelling batch, LTV,
 * cancelledAt). This one:
 *
 *   - Uses UI-kit primitives across the board (Card / Select / Table /
 *     Badge / Input).
 *   - Server-side search + bucket filter + pagination — so the numbers
 *     always agree with the counts and the founder can page through
 *     large channel rosters.
 *   - Filter chips wire to the BE's new `counts` bucket rollup, so
 *     "Active 42 · Cancelling 3 · Expired 12" reflects the whole
 *     channel roster, not just the current page.
 *   - New per-row data: subscription status (color-coded), lifetime
 *     value (USD-normalised), next payment / cancels-on date.
 *
 * Kept the mute/unmute (Can Post) toggle since that's the one action
 * founders reach for from this view.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessageSquareOff,
  Filter,
  Calendar,
  DollarSign,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getChannelSubscribers,
  toggleMemberPosting,
  type ChannelSubscriber,
  type ChannelSubscriberBucketCounts,
  type ChannelMembershipBucket,
  type Channel,
} from "@/lib/feed-api";

const PAGE_SIZE = 25;

// Subscription-state semantic → colour + label. Two visual buckets:
// "healthy paying", "cancelling this cycle", "expired/inactive". Free
// members show as "member" (neutral).
function membershipBadge(
  sub: ChannelSubscriber,
): { label: string; className: string } {
  const status = sub.status;
  const subStatus = sub.subscriptionStatus || "active";

  if (status === "active" && subStatus === "cancelled") {
    return {
      label: "Cancelling",
      className:
        "bg-amber-500/15 text-amber-300 border-amber-500/30",
    };
  }
  if (status === "inactive" || status === "suspended" || subStatus === "expired") {
    return {
      label: subStatus === "expired" ? "Expired" : status === "suspended" ? "Suspended" : "Left",
      className:
        "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    };
  }
  if (sub.lastPaymentDate) {
    return {
      label: "Paying",
      className:
        "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    };
  }
  return {
    label: "Member",
    className:
      "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const now = Date.now();
  if (isNaN(then)) return null;
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

interface FounderMembersPanelProps {
  orgId: string | null;
  channels: Channel[];
}

export function FounderMembersPanel({ orgId, channels }: FounderMembersPanelProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [bucket, setBucket] = useState<ChannelMembershipBucket>("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [subscribers, setSubscribers] = useState<ChannelSubscriber[]>([]);
  const [counts, setCounts] = useState<ChannelSubscriberBucketCounts>({
    active: 0,
    cancelling: 0,
    expired: 0,
    all: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [muteBusyUserId, setMuteBusyUserId] = useState<string | null>(null);

  // Pick a channel on first render / when the channel list changes.
  useEffect(() => {
    if (channels.length === 0) {
      setSelectedChannelId("");
      return;
    }
    if (!channels.some((c) => c._id === selectedChannelId)) {
      const dflt = channels.find((c) => c.isDefault) || channels[0];
      setSelectedChannelId(dflt._id);
    }
  }, [channels, selectedChannelId]);

  // Debounce search — same 350 ms cadence as the invoices page for
  // consistency.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Reset pagination whenever any filter changes.
  useEffect(() => {
    setOffset(0);
  }, [selectedChannelId, bucket, debouncedSearch]);

  const load = useCallback(async () => {
    if (!orgId || !selectedChannelId) {
      setSubscribers([]);
      setCounts({ active: 0, cancelling: 0, expired: 0, all: 0 });
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getChannelSubscribers(selectedChannelId, orgId, {
        limit: PAGE_SIZE,
        offset,
        membershipFilter: bucket,
        search: debouncedSearch || undefined,
      });
      setSubscribers(res.subscribers);
      setCounts(res.counts);
      setTotal(res.total);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load members");
      setSubscribers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedChannelId, bucket, debouncedSearch, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c._id === selectedChannelId) || null,
    [channels, selectedChannelId],
  );

  const handleMuteToggle = async (sub: ChannelSubscriber) => {
    if (!orgId || !selectedChannelId) return;
    if (muteBusyUserId) return;
    const userId = sub.user._id;
    const newCanPost = !sub.canPost;
    setMuteBusyUserId(userId);
    // Optimistic swap
    setSubscribers((prev) =>
      prev.map((s) => (s.user._id === userId ? { ...s, canPost: newCanPost } : s)),
    );
    try {
      await toggleMemberPosting(selectedChannelId, userId, orgId, newCanPost);
      toast.success(
        newCanPost
          ? `${sub.user.name || sub.user.email} can now post`
          : `${sub.user.name || sub.user.email} has been muted`,
      );
    } catch {
      // Revert optimistic swap on failure.
      setSubscribers((prev) =>
        prev.map((s) => (s.user._id === userId ? { ...s, canPost: !newCanPost } : s)),
      );
      toast.error("Failed to update posting permission");
    } finally {
      setMuteBusyUserId(null);
    }
  };

  const bucketOptions: {
    value: ChannelMembershipBucket;
    label: string;
    count: number;
    tone: string;
  }[] = [
    { value: "active", label: "Active", count: counts.active, tone: "emerald" },
    {
      value: "cancelling",
      label: "Cancelling",
      count: counts.cancelling,
      tone: "amber",
    },
    { value: "expired", label: "Expired", count: counts.expired, tone: "zinc" },
    { value: "all", label: "All time", count: counts.all, tone: "blue" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header + top control card */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand/15 to-brand/[0.02] border border-brand/15 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-brand" />
              </div>
              <div>
                <CardTitle className="text-white text-xl font-black tracking-tight leading-none">
                  Community Members
                </CardTitle>
                <CardDescription className="text-[#9fa0b8] text-sm mt-1.5">
                  Every subscriber across your communities — lifetime value, subscription state, and posting permissions.
                </CardDescription>
              </div>
            </div>
            {selectedChannel && !loading && (
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="font-mono text-xl font-black text-white leading-none">
                  {counts.all.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] mt-1">
                  total members
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Community picker */}
            <div className="sm:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5">
                Community
              </label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="h-10 bg-[#0d0d11] border-[#2a2a35] text-white hover:bg-[#15151b] transition-colors">
                  <SelectValue placeholder="Select a community" />
                </SelectTrigger>
                <SelectContent className="bg-[#111116] border-[#2a2a35] text-white max-h-72">
                  {channels.length === 0 ? (
                    <SelectItem
                      value="__none__"
                      disabled
                      className="focus:bg-[#1a1a22] focus:text-white"
                    >
                      No communities yet
                    </SelectItem>
                  ) : (
                    channels.map((c) => (
                      <SelectItem
                        key={c._id}
                        value={c._id}
                        className="focus:bg-[#1a1a22] focus:text-white"
                      >
                        {c.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a5a72] pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-9 pr-9 h-10 bg-[#0d0d11] border-[#2a2a35] text-white placeholder:text-[#5a5a72] focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:border-brand/40"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-[#5a5a72] hover:text-white hover:bg-[#1a1a22] transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bucket filter chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72]">
              <Filter className="h-3 w-3" />
              Filter
            </span>
            {bucketOptions.map((opt) => {
              const isActive = bucket === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBucket(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                    isActive
                      ? "bg-brand/15 text-brand border-brand/30"
                      : "bg-[#1a1a22] text-[#c7c7da] border-[#2a2a35] hover:bg-[#15151b] hover:text-white",
                  )}
                >
                  {opt.label}
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      isActive ? "text-brand/70" : "text-[#5a5a72]",
                    )}
                  >
                    {opt.count.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Members table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardContent className="p-4 sm:p-6">
          {channels.length === 0 ? (
            <div className="border border-dashed border-[#2a2a35] rounded-xl py-16 flex flex-col items-center gap-3 text-center">
              <Users className="w-10 h-10 text-[#2a2a35]" />
              <div>
                <p className="text-sm font-semibold text-white">
                  No communities yet
                </p>
                <p className="text-xs text-[#5a5a72] mt-1 max-w-sm">
                  Create a community first to see its members here.
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading members…
            </div>
          ) : subscribers.length === 0 ? (
            <div className="border border-dashed border-[#2a2a35] rounded-xl py-16 flex flex-col items-center gap-3 text-center">
              <Users className="w-10 h-10 text-[#2a2a35]" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {debouncedSearch
                    ? "No members match your search"
                    : bucket === "cancelling"
                      ? "No one is cancelling this cycle"
                      : bucket === "expired"
                        ? "No expired members yet"
                        : "No active members yet"}
                </p>
                <p className="text-xs text-[#5a5a72] mt-1 max-w-sm">
                  {debouncedSearch
                    ? "Try a different name or email."
                    : "New members show up here the moment they join."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-[#1f1f2a]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1f1f2a] hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] py-3">
                        Member
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] py-3">
                        Status
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] py-3">
                        Joined
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] py-3">
                        Next payment
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] py-3 text-right">
                        Lifetime value
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a5a72] py-3 text-right">
                        Posting
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.filter((sub) => sub.user).map((sub) => {
                      const displayName =
                        sub.user.name || sub.user.email || "Unnamed";
                      const badge = membershipBadge(sub);
                      const daysAsMember = daysSince(sub.joinedAt);
                      const isCancelling = sub.subscriptionStatus === "cancelled";
                      return (
                        <TableRow
                          key={sub.user._id}
                          className="border-[#1f1f2a] hover:bg-white/[0.02] transition-colors"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {sub.user.profilePicture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sub.user.profilePicture}
                                  alt={displayName}
                                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#2a2a35]"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-brand font-semibold text-sm shrink-0">
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-white truncate max-w-[220px]">
                                    {displayName}
                                  </p>
                                  {sub.user.name && sub.user.email && (
                                    <UserCircle2 className="h-3 w-3 text-[#5a5a72] shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-[#9fa0b8] truncate max-w-[220px]">
                                  {sub.user.email || "—"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold px-2 py-0",
                                  badge.className,
                                )}
                              >
                                {badge.label}
                              </Badge>
                              {isCancelling && sub.cancelledAt && (
                                <span className="text-[10px] text-[#5a5a72]">
                                  Cancelled {formatDate(sub.cancelledAt)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-xs text-[#c7c7da] flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-[#5a5a72]" />
                              {formatDate(sub.joinedAt)}
                            </div>
                            {daysAsMember !== null && (
                              <div className="text-[10px] text-[#5a5a72] mt-0.5">
                                {daysAsMember === 0
                                  ? "Today"
                                  : `${daysAsMember} day${daysAsMember === 1 ? "" : "s"} ago`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {isCancelling ? (
                              <div className="text-xs text-amber-300">
                                Ends {formatDate(sub.nextPaymentDate)}
                              </div>
                            ) : sub.nextPaymentDate ? (
                              <div className="text-xs text-[#c7c7da]">
                                {formatDate(sub.nextPaymentDate)}
                              </div>
                            ) : (
                              <div className="text-xs text-[#5a5a72]">—</div>
                            )}
                            {sub.lastPaymentDate && (
                              <div className="text-[10px] text-[#5a5a72] mt-0.5">
                                Last {formatDate(sub.lastPaymentDate)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="inline-flex items-center gap-1 text-sm font-mono font-semibold text-white">
                              <DollarSign className="h-3 w-3 text-[#5a5a72]" />
                              {sub.lifetimeValueUsd.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={muteBusyUserId === sub.user._id}
                              onClick={() => handleMuteToggle(sub)}
                              className={cn(
                                "h-8 text-xs font-medium rounded-lg transition-colors",
                                sub.canPost !== false
                                  ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border-rose-500/30",
                              )}
                              title={
                                sub.canPost !== false
                                  ? "Click to mute this member"
                                  : "Click to unmute this member"
                              }
                            >
                              {muteBusyUserId === sub.user._id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : sub.canPost !== false ? (
                                <>
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Can post
                                </>
                              ) : (
                                <>
                                  <MessageSquareOff className="h-3 w-3 mr-1" />
                                  Muted
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 gap-2">
                  <span className="text-[11px] text-[#5a5a72]">
                    Showing {offset + 1}–
                    {Math.min(offset + subscribers.length, total)} of{" "}
                    {total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                      className="h-8 border-[#2a2a35] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + subscribers.length >= total}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                      className="h-8 border-[#2a2a35] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
