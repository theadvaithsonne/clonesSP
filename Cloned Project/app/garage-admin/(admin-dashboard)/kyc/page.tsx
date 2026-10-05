"use client";

/**
 * Office KYC console — the one place KYC is run from.
 *
 * Left: every office, newest first, so an office created this morning is the
 * first thing on screen. Search and status filters narrow it; the counts on
 * the filter chips are what tells an admin there is work waiting.
 *
 * Right: the selected office's packet — pick which documents it owes and send
 * the request, then review what comes back, approve or reject each file, and
 * verify or send the whole thing back. That panel is `OrgKycCard`, which is
 * also what the flow used to live in on the org detail page.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Building2,
  CalendarDays,
  Inbox,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OrgKycCard from "@/components/garage-admin/OrgKycCard";
import {
  adminOrgKycApi,
  type AdminOrgKycListItem,
} from "@/lib/admin-api/org-kyc";
import { ORG_KYC_STATUS_LABEL, type OrgKycStatus } from "@/lib/org-kyc";
import { cn } from "@/lib/utils";

/** Same pill vocabulary the rest of the console uses: rounded-full, brand
 *  yellow for "the platform is waiting", semantic colours for the rest. */
const STATUS_CLASS: Record<OrgKycStatus, string> = {
  not_requested: "border-white/[0.12] bg-white/[0.04] text-zinc-400",
  pending: "border-[#FBD10D]/30 bg-[#FBD10D]/15 text-[#FBD10D]",
  submitted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  verified: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

/** Filter chips, in the order an admin works them. */
const FILTERS: { key: OrgKycStatus | "all"; label: string }[] = [
  { key: "submitted", label: "Needs review" },
  { key: "not_requested", label: "Not requested" },
  { key: "pending", label: "Awaiting founder" },
  { key: "rejected", label: "Sent back" },
  { key: "verified", label: "Verified" },
  { key: "all", label: "All offices" },
];

function daysSince(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** One labelled number in the office header's stat row. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm text-zinc-200">{value || "—"}</p>
    </div>
  );
}

export default function OfficeKycPage() {
  const [items, setItems] = useState<AdminOrgKycListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrgKycStatus | "all">("submitted");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  /**
   * Always fetched unfiltered and narrowed in the browser. The list is capped
   * at a few hundred offices, and holding the whole set is what lets the
   * filter chips carry live counts — the number waiting on an admin is the
   * most useful thing on the page, and it can't be shown by a filtered query.
   */
  // If the queue is empty on first load there is nothing to review, so open
  // on the full list instead of an empty "Needs review" tab.
  const [autoFilterSettled, setAutoFilterSettled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await adminOrgKycApi.list({ q: debounced || undefined });
      setItems(next);
      setAutoFilterSettled((settled) => {
        if (settled || debounced) return settled;
        if (!next.some((i) => i.status === "submitted")) setFilter("all");
        return true;
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load offices");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  // A submission can land while this page is already open, and the reviewer
  // would never know. Re-poll every 60s, but only while the tab is actually
  // being looked at — a background tab polling forever is just load.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: items.length };
    for (const item of items) {
      out[item.status] = (out[item.status] || 0) + 1;
    }
    return out;
  }, [items]);

  /**
   * A search overrides the status chips while there is text in the box.
   * The page opens on "Needs review", which is right for the queue but made
   * searching look broken: typing an office name that wasn't awaiting review
   * returned nothing. Searching means "find me this office", not "find me
   * this office inside the filter I forgot was on".
   */
  const searching = debounced.length > 0;
  const awaitingApproval = useMemo(
    () =>
      items
        .filter((i) => i.status === "submitted")
        .sort(
          (a, b) =>
            new Date(a.submittedAt || a.updatedAt).getTime() -
            new Date(b.submittedAt || b.updatedAt).getTime(),
        ),
    [items],
  );

  const visible = useMemo(
    () =>
      searching || filter === "all"
        ? items
        : items.filter((i) => i.status === filter),
    [items, filter, searching],
  );

  const selectedItem = items.find((i) => i.orgId === selected) || null;

  /**
   * `founders` only exists on an API new enough to send it — an older
   * backend still answering this page (a dev server that hasn't restarted,
   * or a frontend deploy that landed first) sends just `founder`. Fall back
   * to that rather than crashing the whole page on `.length`.
   */
  const selectedFounders = selectedItem
    ? selectedItem.founders ??
      (selectedItem.founder ? [selectedItem.founder] : [])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#FBD10D]" />
            Office KYC
          </h1>
          <p className="text-zinc-400">
            Request identity documents from an office, review what the founder
            uploads, and verify.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={load}
          disabled={loading}
          className="h-9 rounded-full border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06]"
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* ── Waiting on you ───────────────────────────────────────────────
          Submitting is the one moment in this flow where the ball silently
          changes hands: the founder is done and nothing on screen said so.
          This box is that signal — it sits above everything, names every
          office waiting, and how long it has been waiting. */}
      {!loading && (
        <div
          className={cn(
            "rounded-2xl border p-4",
            awaitingApproval.length
              ? "border-[#FBD10D]/30 bg-[#FBD10D]/[0.06]"
              : "border-white/[0.06] bg-white/[0.02]",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BellRing
              className={cn(
                "h-4 w-4",
                awaitingApproval.length ? "text-[#FBD10D]" : "text-zinc-600",
              )}
            />
            <h2
              className={cn(
                "text-sm font-semibold",
                awaitingApproval.length ? "text-[#FBD10D]" : "text-zinc-300",
              )}
            >
              {awaitingApproval.length
                ? `${awaitingApproval.length} office${
                    awaitingApproval.length === 1 ? "" : "s"
                  } waiting for your approval`
                : "Nothing waiting for approval"}
            </h2>
            {awaitingApproval.length > 0 && (
              <span className="ml-auto text-[11px] text-[#FBD10D]/60">
                Oldest first · rechecked every minute
              </span>
            )}
          </div>

          {/* The empty state stays on screen rather than unmounting the box:
              a reviewer needs to see "nothing is waiting" as an answer, not
              as a blank space that might mean the panel is broken. */}
          {!awaitingApproval.length && (
            <p className="mt-2 text-[13px] text-zinc-500">
              Offices appear here the moment a founder submits their documents
              for verification.
            </p>
          )}

          <div
            className={cn(
              "mt-3 space-y-2",
              awaitingApproval.length > 4 &&
                "max-h-[280px] overflow-y-auto pr-1",
            )}
          >
            {awaitingApproval.map((item) => (
              <button
                key={item.orgId}
                onClick={() => {
                  setSelected(item.orgId);
                  // The list is probably filtered to something this office
                  // isn't in; put it back on screen alongside the panel.
                  setFilter("submitted");
                  setSearch("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-[#181818] px-3 py-2.5 text-left transition-colors hover:border-[#FBD10D]/40 hover:bg-[#1c1c1c]"
              >
                {item.orgIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.orgIcon}
                    alt={item.orgName}
                    className="h-8 w-8 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">
                    {item.orgName}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {item.founder?.name || item.founder?.email || "No founder"}
                    {" · "}
                    {item.submissionCount} document
                    {item.submissionCount === 1 ? "" : "s"} · submitted{" "}
                    {daysSince(item.submittedAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#FBD10D] px-2.5 py-1 text-[11px] font-semibold text-black">
                  Review
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Office list ──────────────────────────────────────────────── */}
        <div className="h-fit rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Offices</h2>
            <p className="mt-1 text-[13px] text-zinc-400">
              Newest first. Pick one to request or review its KYC.
            </p>
          </div>
          <div className="space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by office name"
                className="h-9 rounded-full border-white/[0.08] bg-[#0f0f0f] pl-8 text-zinc-200 placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const count = counts[f.key] || 0;
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                      active && !searching
                        ? "border-[#FBD10D]/40 bg-[#FBD10D]/10 text-[#FBD10D]"
                        : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200",
                      searching && "opacity-60",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "ml-1.5",
                        active && !searching
                          ? "text-[#FBD10D]/70"
                          : "text-zinc-600",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {searching && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-400">
                <span>
                  Showing every match for “{debounced}” — status filters are
                  ignored while searching.
                </span>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="shrink-0 rounded-full border border-white/[0.1] px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                >
                  Clear
                </button>
              </div>
            )}

            {loading ? (
              <div className="space-y-2 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                  />
                ))}
              </div>
            ) : !visible.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Inbox className="h-8 w-8 text-zinc-700" />
                <p className="text-sm text-zinc-500">
                  {searching
                    ? `No office matches “${debounced}”.`
                    : filter === "submitted"
                      ? "Nothing waiting on you right now."
                      : "No offices match this filter."}
                </p>
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {visible.map((item) => {
                  const active = item.orgId === selected;
                  const isNew =
                    item.status === "not_requested" &&
                    Date.now() - new Date(item.orgCreatedAt).getTime() <
                      14 * 86_400_000;
                  return (
                    <button
                      key={item.orgId}
                      onClick={() => setSelected(item.orgId)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-[#FBD10D]/40 bg-[#FBD10D]/[0.07]"
                          : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {item.orgIcon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.orgIcon}
                            alt={item.orgName}
                            className="h-8 w-8 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                            <Building2 className="h-4 w-4 text-zinc-400" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-white">
                              {item.orgName}
                            </p>
                            {isNew && (
                              <span className="shrink-0 rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#FBD10D]">
                                New
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-zinc-500">
                            {item.founder?.name ||
                              item.founder?.email ||
                              "No founder"}
                            {item.status === "submitted"
                              ? ` · ${item.submissionCount} to check`
                              : item.status === "pending"
                                ? ` · ${item.submissionCount}/${item.requirementCount} provided`
                                : item.status === "rejected"
                                  ? " · waiting on founder"
                                  : ` · created ${daysSince(item.orgCreatedAt)}`}
                          </p>
                        </div>

                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            STATUS_CLASS[item.status],
                          )}
                        >
                          {ORG_KYC_STATUS_LABEL[item.status]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Selected office ──────────────────────────────────────────── */}
        {selectedItem ? (
          <div className="space-y-4">
            {/* Who this packet belongs to. The name alone left an admin
                reviewing identity documents with no idea whose office they
                were looking at. */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              {selectedItem.orgCoverPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedItem.orgCoverPhoto}
                  alt=""
                  className="h-24 w-full object-cover opacity-70"
                />
              )}
              <div className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {selectedItem.orgIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedItem.orgIcon}
                      alt={selectedItem.orgName}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                      <Building2 className="h-6 w-6 text-zinc-400" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {selectedItem.orgName}
                      </h2>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          STATUS_CLASS[selectedItem.status],
                        )}
                      >
                        {ORG_KYC_STATUS_LABEL[selectedItem.status]}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                      {selectedItem.orgSlug && (
                        <span className="font-mono">/{selectedItem.orgSlug}</span>
                      )}
                      {selectedItem.orgCategory && (
                        <span>{selectedItem.orgCategory}</span>
                      )}
                      {selectedItem.orgLocation && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {selectedItem.orgLocation}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Created{" "}
                        {new Date(
                          selectedItem.orgCreatedAt,
                        ).toLocaleDateString()}{" "}
                        · {daysSince(selectedItem.orgCreatedAt)}
                      </span>
                    </div>

                    {selectedItem.orgDescription && (
                      <p className="mt-2 line-clamp-2 text-[13px] text-zinc-400">
                        {selectedItem.orgDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-600">
                      {selectedItem.orgId}
                    </span>
                    <a
                      href={`/garage-admin/organizations/${selectedItem.orgId}`}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      Office details →
                    </a>
                  </div>
                </div>

                {/* Founders — the people who actually have to upload, and
                    who the verdict email goes to. */}
                <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                      {selectedFounders.length > 1 ? "Founders" : "Founder"}
                    </p>
                    {selectedFounders.length ? (
                      <div className="mt-1.5 space-y-1.5">
                        {selectedFounders.map((f, i) => (
                          <div
                            key={f.id || f.email || i}
                            className="flex items-center gap-2"
                          >
                            {f.profilePicture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.profilePicture}
                                alt={f.name || f.email || ""}
                                className="h-6 w-6 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-medium text-zinc-300">
                                {(f.name || f.email || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-[13px] text-zinc-200">
                                {f.name || "(no name)"}
                              </p>
                              <p className="truncate text-[11px] text-zinc-500">
                                {f.email}
                                {f.phone ? ` · ${f.phone}` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[13px] text-zinc-500">
                        No founder on this office — nobody can upload for it.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat
                      label="Requested"
                      value={String(selectedItem.requirementCount)}
                    />
                    <Stat
                      label="Provided"
                      value={String(selectedItem.submissionCount)}
                    />
                    <Stat
                      label={
                        selectedItem.verifiedAt
                          ? "Verified"
                          : selectedItem.submittedAt
                            ? "Submitted"
                            : "Last change"
                      }
                      value={
                        selectedItem.verifiedAt
                          ? daysSince(selectedItem.verifiedAt)
                          : selectedItem.submittedAt
                            ? daysSince(selectedItem.submittedAt)
                            : daysSince(selectedItem.updatedAt)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Remount per office so the card's internal draft state can't
                leak from the office that was open a moment ago. */}
            <OrgKycCard
              key={selectedItem.orgId}
              orgId={selectedItem.orgId}
              onChanged={load}
            />
          </div>
        ) : (
          <div className="h-fit rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
              ) : (
                <>
                  <ShieldCheck className="h-10 w-10 text-zinc-700" />
                  <p className="text-sm text-zinc-400">
                    Pick an office on the left.
                  </p>
                  <p className="max-w-sm text-xs text-zinc-600">
                    For a new office, choose which documents it has to produce
                    and send the request — the founder gets a KYC dialog in the
                    app on their next load. Submitted documents come back here
                    for review.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
