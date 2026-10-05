"use client";

// A16 · Talent pool — past applicants who ticked the talent-pool consent on an
// application form, while that consent lasts. Search them, and invite a
// selection to apply for one of the office's live roles.

import React from "react";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../api";
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FilterMenu,
  PageHeader,
  SearchInput,
  SkeletonRows,
  formatDate,
  useLoad,
} from "../ui";
import CandidateDrawer from "./candidate/CandidateDrawer";
import type { TalentCandidate } from "../types";

const EXPERIENCE: Record<string, { label: string; minExp?: number; maxExp?: number }> = {
  "0-2": { label: "0–2 years", maxExp: 2 },
  "2-5": { label: "2–5 years", minExp: 2, maxExp: 5 },
  "5-8": { label: "5–8 years", minExp: 5, maxExp: 8 },
  "8+": { label: "8+ years", minExp: 8 },
};

const STATUS_NOTE: Record<string, string> = {
  hired: "Hired",
  rejected: "Not moved forward",
  withdrawn: "Withdrew",
};

const COLS = "grid-cols-[36px_1.4fr_1.2fr_1fr_130px_1.1fr]";

export default function TalentPoolPage() {
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [locationDraft, setLocationDraft] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [appliedWithin, setAppliedWithin] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [inviteJobId, setInviteJobId] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [openAppId, setOpenAppId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  React.useEffect(() => {
    const t = setTimeout(() => setLocation(locationDraft.trim()), 300);
    return () => clearTimeout(t);
  }, [locationDraft]);

  const exp = EXPERIENCE[experience];
  const { data, loading, error, reload } = useLoad(
    () =>
      jobsApi.getTalentPool({
        q: q || undefined,
        tag: tag || undefined,
        minExp: exp?.minExp,
        maxExp: exp?.maxExp,
        location: location || undefined,
        appliedWithin: appliedWithin ? Number(appliedWithin) : undefined,
      }),
    [q, tag, experience, location, appliedWithin]
  );

  const candidates = React.useMemo(() => data?.candidates || [], [data]);
  const liveJobs = React.useMemo(() => data?.liveJobs || [], [data]);
  const filtering = !!(q || tag || experience || location || appliedWithin);

  // Drop selections that the current filters no longer show.
  React.useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(candidates.map((c) => c.candidateId));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [candidates]);

  React.useEffect(() => {
    if (inviteJobId && !liveJobs.some((j) => j._id === inviteJobId)) setInviteJobId("");
  }, [liveJobs, inviteJobId]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.candidateId));

  const invite = async () => {
    if (!inviteJobId || !selected.size) return;
    const ids = [...selected];
    setInviting(true);
    try {
      const res = await jobsApi.inviteFromTalentPool(ids, inviteJobId);
      const jobTitle = liveJobs.find((j) => j._id === inviteJobId)?.title || "the job";
      if (res.sent > 0) toast.success(`Invited ${res.sent} candidate${res.sent === 1 ? "" : "s"} to apply for ${jobTitle}`);
      if (res.sent < ids.length) {
        const skipped = ids.length - res.sent;
        toast.message(`${skipped} skipped — they've already applied for this job or have no email on file.`);
      }
      setSelected(new Set());
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't send the invites.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Talent pool"
        subtitle="Search past applicants and reconnect with strong candidates who consented to stay in touch."
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Skills, title, or name" className="w-72" />
          <FilterMenu label="Tags" value={tag} options={(data?.tags || []).map((t) => ({ value: t, label: t }))} onChange={setTag} />
          <FilterMenu
            label="Experience"
            value={experience}
            options={Object.entries(EXPERIENCE).map(([value, e]) => ({ value, label: e.label }))}
            onChange={setExperience}
          />
          <FilterMenu
            label="Last applied"
            value={appliedWithin}
            allLabel="Any time"
            options={[
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "365", label: "Last 12 months" },
            ]}
            onChange={setAppliedWithin}
          />
          <SearchInput value={locationDraft} onChange={setLocationDraft} placeholder="Location" className="w-44" />
        </div>

        {selected.size > 0 && (
          <Card className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm text-white">{selected.size} selected</span>
            <span className="h-4 w-px bg-[#262626]" />
            <span className="text-sm text-[#7c7d94]">Invite to apply for</span>
            <select
              value={inviteJobId}
              disabled={!liveJobs.length}
              onChange={(e) => setInviteJobId(e.target.value)}
              title={liveJobs.length ? undefined : "Publish a job first"}
              className="max-w-[260px] rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-sm text-[#c7c7da] outline-none disabled:opacity-50 [&>option]:bg-[#141414]"
            >
              <option value="">{liveJobs.length ? "Select a live job" : "No live jobs"}</option>
              {liveJobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.title}
                </option>
              ))}
            </select>
            <Button onClick={invite} loading={inviting} disabled={!inviteJobId}>
              <Send className="h-4 w-4" /> Invite {selected.size} to apply
            </Button>
            {!liveJobs.length && <span className="text-xs text-[#61627a]">Publish a job first.</span>}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#7c7d94] hover:text-white">
              Clear selection
            </button>
          </Card>
        )}

        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : candidates.length === 0 ? (
          filtering ? (
            <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">No candidates match these filters.</Card>
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No candidates in your talent pool yet"
              description="Applicants who tick the talent-pool consent on your application form appear here, for as long as their consent lasts."
            />
          )
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className={`grid ${COLS} items-center gap-4 border-b border-[#1f1f24] px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]`}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.candidateId)))}
                  className="glass-check"
                />
                <span>Candidate</span>
                <span>Top skills</span>
                <span>Last job applied for</span>
                <span>Last stage</span>
                <span>Tags & consent</span>
              </div>
              {candidates.map((c) => (
                <CandidateRow
                  key={c.candidateId}
                  c={c}
                  selected={selected.has(c.candidateId)}
                  onToggle={() => toggle(c.candidateId)}
                  onOpen={() => setOpenAppId(c.applicationId)}
                />
              ))}
            </Card>
            <p className="mt-4 text-xs text-[#7c7d94]">
              {data?.total ?? candidates.length} candidate{(data?.total ?? candidates.length) === 1 ? "" : "s"} in your talent pool
            </p>
          </>
        )}
      </div>

      <CandidateDrawer
        applicationId={openAppId}
        onClose={() => setOpenAppId(null)}
        onChanged={() => reload(true)}
        siblings={candidates.map((c) => c.applicationId)}
        onSelect={setOpenAppId}
      />
    </>
  );
}

function CandidateRow({
  c,
  selected,
  onToggle,
  onOpen,
}: {
  c: TalentCandidate;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className={`grid ${COLS} cursor-pointer items-center gap-4 border-t border-[#1f1f24] px-5 py-3.5 transition-colors first:border-t-0 hover:bg-white/[0.02]`}
      style={selected ? { background: "color-mix(in srgb, var(--brand) 5%, transparent)" } : undefined}
    >
      <input
        type="checkbox"
        aria-label={`Select ${c.name}`}
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className="glass-check"
      />
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={c.name} src={c.avatar} size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{c.name}</div>
          <div className="truncate text-xs text-[#7c7d94]">
            {[c.title, c.location].filter(Boolean).join(" · ") || c.email}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {c.topSkills.length ? c.topSkills.map((s) => <Chip key={s}>{s}</Chip>) : <span className="text-sm text-[#61627a]">—</span>}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-[#c7c7da]">{c.lastJob.title}</div>
        {c.applications > 1 && <div className="text-[11px] text-[#61627a]">{c.applications} applications</div>}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-[#c7c7da]">{c.lastStage}</div>
        {STATUS_NOTE[c.status] && <div className="text-[11px] text-[#61627a]">{STATUS_NOTE[c.status]}</div>}
      </div>
      <div className="min-w-0">
        {c.tags.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {c.tags.slice(0, 3).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        )}
        <div className="text-[11px] text-[#7c7d94]">{c.consentUntil ? `Consent until ${formatDate(c.consentUntil)}` : "Consent on file"}</div>
      </div>
    </div>
  );
}
