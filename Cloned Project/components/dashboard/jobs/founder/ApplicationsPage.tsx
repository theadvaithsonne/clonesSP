"use client";

// A10 · Applications — every candidate across the office's jobs: saved views,
// filters, sorting, bulk actions (move, reject, tag, star, email, export) and
// the candidate profile drawer.

import React from "react";
import { ArrowRight, ChevronDown, Download, Mail, Star, Tag, Users, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../api";
import { CATEGORY_META, JOB_PAGES, SOURCE_LABELS, STAGE_CATEGORIES } from "../constants";
import { useJobsNav, useJobsNavStore } from "../nav";
import {
  Avatar,
  Button,
  Card,
  CustomSelect,
  EmptyState,
  ErrorState,
  FilterMenu,
  GOLD,
  MatchScore,
  Modal,
  PageHeader,
  SearchInput,
  SkeletonRows,
  StagePill,
  TextArea,
  TextInput,
  UnderlineTabs,
  formatDate,
  timeAgo,
  useLoad,
} from "../ui";
import type { ApplicationRow, ApplicationSource, StageCategory } from "../types";
import CandidateDrawer from "./candidate/CandidateDrawer";

type View = "all" | "new" | "needs_review" | "referred" | "starred";
const VIEWS: View[] = ["all", "new", "needs_review", "referred", "starred"];
const PAGE_SIZE = 25;

const GRID =
  "grid grid-cols-[28px_minmax(200px,1.6fr)_minmax(140px,1.1fr)_minmax(130px,1fr)_56px_minmax(120px,1fr)_92px_minmax(170px,1.3fr)] items-center gap-4";

type BulkPayload = Omit<Parameters<typeof jobsApi.bulkApplications>[0], "ids">;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function sourceText(row: ApplicationRow): string {
  if (row.source === "referral" && row.referral) return `Referral · ${row.referral.affiliateId}`;
  return SOURCE_LABELS[row.source] || row.source;
}

export default function ApplicationsPage() {
  const nav = useJobsNav();
  const setNav = useJobsNavStore((s) => s.set);

  // Filters an overview link asked for ("38 new applications", "overdue
  // scorecards") — read once, then cleared so a later visit starts fresh.
  const preset = React.useRef(useJobsNavStore.getState().applicationsPreset);
  const [view, setView] = React.useState<View>(() =>
    VIEWS.includes(preset.current?.view as View) ? (preset.current!.view as View) : "all"
  );
  const [stage, setStage] = React.useState<string>(() =>
    preset.current?.stage && STAGE_CATEGORIES.includes(preset.current.stage as StageCategory) ? preset.current.stage : ""
  );
  const [jobId, setJobId] = React.useState<string>(() => preset.current?.jobId || "");
  React.useEffect(() => {
    if (preset.current) setNav({ applicationsPreset: null });
  }, [setNav]);

  const [status, setStatus] = React.useState("active");
  const [source, setSource] = React.useState("");
  const [minMatch, setMinMatch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [sort, setSort] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [knownTags, setKnownTags] = React.useState<string[]>([]);
  const [modal, setModal] = React.useState<null | "reject" | "tag" | "email">(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = React.useMemo(
    () => ({
      view: view === "all" ? undefined : view,
      stage: stage as StageCategory | "",
      jobId: jobId || undefined,
      status: status || "all",
      source: source || undefined,
      minMatch: minMatch ? Number(minMatch) : undefined,
      appliedWithin: applied ? Number(applied) : undefined,
      tag: tag || undefined,
      q: q || undefined,
      sort: sort || undefined,
    }),
    [view, stage, jobId, status, source, minMatch, applied, tag, q, sort]
  );

  const { data, setData, loading, error, reload } = useLoad(
    () => jobsApi.getApplications({ ...query, page, limit: PAGE_SIZE }),
    [query, page]
  );

  React.useEffect(() => {
    if (!data) return;
    setKnownTags((prev) => {
      const next = new Set(prev);
      data.applications.forEach((a) => a.tags.forEach((t) => next.add(t)));
      return next.size === prev.length ? prev : [...next].sort();
    });
  }, [data]);

  /** Any filter change goes back to page 1 and drops the selection. */
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
      setSelected(new Set());
    };

  const filtersActive = !!(q || stage || jobId || source || minMatch || applied || tag || view !== "all" || status !== "active");
  const clearFilters = () => {
    setView("all");
    setStage("");
    setJobId("");
    setStatus("active");
    setSource("");
    setMinMatch("");
    setApplied("");
    setTag("");
    setSearch("");
    setQ("");
    setPage(1);
    setSelected(new Set());
  };

  const rows = data?.applications || [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) rows.forEach((r) => next.delete(r._id));
      else rows.forEach((r) => next.add(r._id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleStar = async (row: ApplicationRow) => {
    const next = !row.starred;
    const patch = (starred: boolean) =>
      setData((d) => (d ? { ...d, applications: d.applications.map((a) => (a._id === row._id ? { ...a, starred } : a)) } : d));
    patch(next);
    try {
      await jobsApi.updateApplication(row._id, { starred: next });
      if (view === "starred") reload(true);
    } catch (err) {
      patch(!next);
      toast.error(errorMessage(err, "Couldn't update the star."));
    }
  };

  const runBulk = async (payload: BulkPayload, message: (updated: number) => string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await jobsApi.bulkApplications({ ids, ...payload });
      const skipped = res.skipped?.length || 0;
      toast.success(`${message(res.updated)}${skipped ? ` · ${skipped} skipped` : ""}`);
      setSelected(new Set());
      setModal(null);
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the selected candidates."));
    } finally {
      setBusy(false);
    }
  };

  const plural = (n: number) => `${n} candidate${n === 1 ? "" : "s"}`;

  const exportCsv = async () => {
    try {
      await jobsApi.downloadApplicationsCsv({ ...query, ids: selected.size ? [...selected] : undefined });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't export the applications."));
    }
  };

  const counts = data?.counts;
  const from = data && data.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = data ? Math.min(page * PAGE_SIZE, data.total) : 0;

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle="Every candidate across your jobs."
        actions={
          <>
            {counts && (
              <>
                <span className="rounded-md border border-[#262626] px-2 py-1 text-xs text-[#c7c7da]">{counts.active} active</span>
                <span
                  className="rounded-md px-2 py-1 text-xs font-medium"
                  style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
                >
                  {counts.new} new
                </span>
              </>
            )}
            <Button variant="secondary" onClick={exportCsv} disabled={!data || !data.total}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      >
        <UnderlineTabs<View>
          value={view}
          onChange={withReset(setView)}
          tabs={[
            { value: "all", label: "All" },
            { value: "new", label: "New", count: counts?.new },
            { value: "needs_review", label: "Needs review", count: counts?.needsReview },
            { value: "referred", label: "Referred", count: counts?.referred },
            { value: "starred", label: "Starred", count: counts?.starred },
          ]}
        />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email or skill" />
          <FilterMenu
            label="Job"
            value={jobId}
            allLabel="All jobs"
            options={(data?.jobs || []).map((j) => ({ value: j._id, label: j.title || "Untitled job" }))}
            onChange={withReset(setJobId)}
          />
          <FilterMenu
            label="Stage"
            value={stage}
            allLabel="Any stage"
            options={STAGE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))}
            onChange={withReset(setStage)}
          />
          <FilterMenu
            label="Source"
            value={source}
            allLabel="Any source"
            options={(Object.keys(SOURCE_LABELS) as ApplicationSource[]).map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
            onChange={withReset(setSource)}
          />
          <FilterMenu
            label="Match"
            value={minMatch}
            allLabel="Any match"
            options={[
              { value: "80", label: "80%+" },
              { value: "60", label: "60%+" },
            ]}
            onChange={withReset(setMinMatch)}
          />
          <FilterMenu
            label="Applied"
            value={applied}
            allLabel="Any time"
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
            onChange={withReset(setApplied)}
          />
          {knownTags.length > 0 && (
            <FilterMenu
              label="Tag"
              value={tag}
              allLabel="Any tag"
              options={knownTags.map((t) => ({ value: t, label: t }))}
              onChange={withReset(setTag)}
            />
          )}
          <FilterMenu
            label="Status"
            value={status}
            allLabel="Any status"
            options={[
              { value: "active", label: "Active" },
              { value: "hired", label: "Hired" },
              { value: "rejected", label: "Rejected" },
              { value: "withdrawn", label: "Withdrawn" },
            ]}
            onChange={withReset(setStatus)}
          />
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="px-1 text-xs text-[#7c7d94] hover:text-white">
              Clear all
            </button>
          )}
          <div className="ml-auto">
            <FilterMenu
              label="Sort"
              value={sort}
              allLabel="Applied date"
              options={[
                { value: "match", label: "Match score" },
                { value: "activity", label: "Last activity" },
              ]}
              onChange={withReset(setSort)}
            />
          </div>
        </div>

        {loading && !data ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : data && data.total === 0 ? (
          filtersActive ? (
            <Card className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <p className="text-sm text-[#7c7d94]">No candidates match these filters.</p>
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            </Card>
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No applications yet"
              description="Candidates who apply to your live jobs show up here."
              action={
                <Button variant="secondary" onClick={() => nav.go(JOB_PAGES.postings)}>
                  View postings
                </Button>
              }
            />
          )
        ) : data ? (
          <>
            <Card className="overflow-x-auto">
              <div className="min-w-[1080px]">
                <div className={`${GRID} border-b border-[#1f1f24] px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all on this page"
                    className="glass-check"
                  />
                  <span>Candidate</span>
                  <span>Job</span>
                  <span>Stage</span>
                  <span>Match</span>
                  <span>Source</span>
                  <span>Applied</span>
                  <span>Last activity</span>
                </div>
                {rows.map((row) => {
                  const isSelected = selected.has(row._id);
                  return (
                    <div
                      key={row._id}
                      onClick={() => setOpenId(row._id)}
                      className={`${GRID} cursor-pointer border-t border-[#1f1f24] px-5 py-3 transition-colors first:border-t-0 hover:bg-white/[0.02]`}
                      style={isSelected ? { background: "color-mix(in srgb, var(--brand) 5%, transparent)" } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleOne(row._id)}
                        aria-label={`Select ${row.candidate.name}`}
                        className="glass-check"
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={row.candidate.name} src={row.candidate.avatar} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                            <span className="truncate">{row.candidate.name}</span>
                            {row.isNew && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GOLD }} title="Not reviewed yet" />
                            )}
                          </div>
                          <div className="truncate text-xs text-[#7c7d94]">{row.candidate.email || row.reference}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(row);
                          }}
                          className="shrink-0 rounded-md p-1 text-[#4f5065] transition-colors hover:text-white"
                          aria-label={row.starred ? "Unstar" : "Star"}
                        >
                          <Star className="h-4 w-4" style={row.starred ? { color: GOLD, fill: GOLD } : undefined} />
                        </button>
                      </div>
                      <div className="truncate text-sm text-[#c7c7da]">{row.job.title}</div>
                      <div className="min-w-0">
                        {row.status === "active" || row.status === "hired" ? (
                          <StagePill category={row.stage.category} name={row.stage.name} />
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-0.5 text-[11px] capitalize text-[#7c7d94]">
                            {row.status}
                          </span>
                        )}
                      </div>
                      <MatchScore score={row.matchScore} />
                      <div className="truncate text-sm text-[#c7c7da]" title={sourceText(row)}>
                        {sourceText(row)}
                      </div>
                      <div className="text-sm text-[#c7c7da]">{formatDate(row.appliedAt, { year: undefined })}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-[#c7c7da]">{row.lastActivity || "—"}</div>
                        {row.lastActivityAt && <div className="text-[11px] text-[#61627a]">{timeAgo(row.lastActivityAt)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="mt-4 flex items-center justify-between text-xs text-[#7c7d94]">
              <span>
                Showing {from}–{to} of {data.total} candidate{data.total === 1 ? "" : "s"}
              </span>
              {data.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => p - 1);
                      setSelected(new Set());
                    }}
                  >
                    ← Previous
                  </Button>
                  <span className="text-white">
                    {page} / {data.pages}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={page >= data.pages}
                    onClick={() => {
                      setPage((p) => p + 1);
                      setSelected(new Set());
                    }}
                  >
                    Next →
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : null}

        {selected.size > 0 && (
          <div className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-[#262626] bg-[#141414]/95 px-4 py-2.5 shadow-2xl backdrop-blur">
            <span className="mr-1 text-sm text-white">
              <span style={{ color: GOLD }}>✓</span> {selected.size} selected
            </span>
            <BulkMenu
              label="Move to stage"
              icon={<ArrowRight className="h-3.5 w-3.5" />}
              disabled={busy}
              options={STAGE_CATEGORIES.filter((c) => c !== "hired").map((c) => ({ value: c, label: CATEGORY_META[c].label }))}
              onPick={(category) =>
                runBulk({ action: "move", category: category as StageCategory }, (n) => `Moved ${plural(n)} to ${CATEGORY_META[category as StageCategory].label}`)
              }
            />
            <BulkButton icon={<XCircle className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setModal("reject")}>
              Reject
            </BulkButton>
            <BulkButton icon={<Tag className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setModal("tag")}>
              Add tag
            </BulkButton>
            <BulkButton
              icon={<Star className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => runBulk({ action: "star" }, (n) => `Starred ${plural(n)}`)}
            >
              Star
            </BulkButton>
            <BulkButton icon={<Mail className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setModal("email")}>
              Email
            </BulkButton>
            <BulkButton icon={<Download className="h-3.5 w-3.5" />} disabled={busy} onClick={exportCsv}>
              Export CSV
            </BulkButton>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-1 rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <RejectModal
        open={modal === "reject"}
        count={selected.size}
        busy={busy}
        onClose={() => setModal(null)}
        onConfirm={(reason) => runBulk({ action: "reject", reason: reason || undefined }, (n) => `Rejected ${plural(n)}`)}
      />
      <TagModal
        open={modal === "tag"}
        count={selected.size}
        busy={busy}
        suggestions={knownTags}
        onClose={() => setModal(null)}
        onConfirm={(t) => runBulk({ action: "tag", tag: t }, (n) => `Tagged ${plural(n)} “${t}”`)}
      />
      <EmailModal
        open={modal === "email"}
        count={selected.size}
        busy={busy}
        onClose={() => setModal(null)}
        onConfirm={(subject, body) => runBulk({ action: "email", subject, body }, (n) => `Emailed ${plural(n)}`)}
      />

      <CandidateDrawer
        applicationId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => reload(true)}
        siblings={rows.map((r) => r._id)}
        onSelect={setOpenId}
      />
    </>
  );
}

function BulkButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a35] bg-[#1A1A1A] px-3 py-1.5 text-xs text-[#c7c7da] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

/** A bulk-bar button that opens a short option list upwards. */
function BulkMenu({
  label,
  icon,
  options,
  onPick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  options: Array<{ value: string; label: string }>;
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a35] bg-[#1A1A1A] px-3 py-1.5 text-xs text-[#c7c7da] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon}
        {label}
        <ChevronDown className="h-3 w-3 text-[#7c7d94]" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[180px] rounded-xl border border-[#262626] bg-[#141414] p-1 shadow-2xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(o.value);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#c7c7da] hover:bg-[#1f1f28] hover:text-white"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: CATEGORY_META[o.value as StageCategory]?.color || "#71717a" }}
              />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RejectModal({
  open,
  count,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reasons, setReasons] = React.useState<Array<{ id: string; label: string }> | null>(null);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setReason("");
    let cancelled = false;
    jobsApi
      .getSettings()
      .then((r) => !cancelled && setReasons(r.settings.rejectionReasons))
      .catch(() => !cancelled && setReasons([]));
    return () => {
      cancelled = true;
    };
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reject ${count} candidate${count === 1 ? "" : "s"}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={() => onConfirm(reason)}
          >
            Reject
          </Button>
        </>
      }
    >
      <CustomSelect
        label="Reason (optional)"
        value={reason}
        onChange={setReason}
        placeholder={reasons === null ? "Loading reasons…" : "No reason"}
        options={[{ value: "", label: "No reason" }, ...(reasons || []).map((r) => ({ value: r.label, label: r.label }))]}
      />
      <p className="text-xs leading-5 text-[#7c7d94]">
        Candidates who are no longer active are skipped. Each rejected candidate gets the rejection email after the delay set on
        their job, and never sees the reason.
      </p>
    </Modal>
  );
}

function TagModal({
  open,
  count,
  busy,
  suggestions,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  suggestions: string[];
  onClose: () => void;
  onConfirm: (tag: string) => void;
}) {
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    if (open) setValue("");
  }, [open]);
  const tag = value.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tag ${count} candidate${count === 1 ? "" : "s"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!tag} onClick={() => onConfirm(tag)}>
            Add tag
          </Button>
        </>
      }
    >
      <TextInput
        label="Tag"
        value={value}
        maxLength={40}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && tag) {
            e.preventDefault();
            onConfirm(tag);
          }
        }}
        placeholder="e.g. Strong portfolio"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className="rounded-lg border border-[#2a2a35] bg-[#141418] px-2.5 py-1 text-xs text-[#c7c7da] hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EmailModal({
  open,
  count,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (subject: string, body: string) => void;
}) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setSubject("");
      setBody("");
    }
  }, [open]);
  const ready = subject.trim() && body.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Email ${count} candidate${count === 1 ? "" : "s"}`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!ready} onClick={() => onConfirm(subject.trim(), body.trim())}>
            <Mail className="h-4 w-4" /> Send email
          </Button>
        </>
      }
    >
      <TextInput label="Subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
      <TextArea label="Message" rows={8} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
      <p className="text-xs leading-5 text-[#7c7d94]">
        Personalise with <code className="text-[#c7c7da]">{"{{candidate_name}}"}</code>,{" "}
        <code className="text-[#c7c7da]">{"{{job_title}}"}</code> and <code className="text-[#c7c7da]">{"{{company}}"}</code>. Each
        candidate gets their own copy from your office&apos;s email sender.
      </p>
    </Modal>
  );
}
