"use client";

// A4 · Step 2 — Description: the five sections, skills, education, perks and
// the office's own "about". "Write with AI" drafts the sections from a few
// inputs; "Use a previous job" copies them from another of the office's roles.

import React from "react";
import { Copy, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import * as jobsApi from "../../api";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  CustomSelect,
  Drawer,
  GOLD,
  Label,
  Modal,
  SafeHtml,
  SwitchControl,
  TextArea,
  TextInput,
  formatDate,
  errorMessage,
} from "../../ui";
import type { Job, PostingRow } from "../../types";
import type { StepProps } from "./JobWizard";
import { StepHeading } from "./StepBasics";

const SECTIONS: Array<[keyof Job["description"], string, string]> = [
  ["aboutRole", "About the role", "What this person will own and why it matters."],
  ["responsibilities", "What you'll do", "The day-to-day, as a short list."],
  ["requirements", "What you'll need", "Must-have experience and skills."],
  ["niceToHave", "Nice to have", "Pluses, not requirements."],
  ["offer", "What we offer", "Benefits, growth, the team."],
];

const COMMON_PERKS = ["Health insurance", "Flexible hours", "Learning budget", "ESOPs", "Laptop"];

export default function StepDescription({ job, detail, update }: StepProps) {
  const [skillDraft, setSkillDraft] = React.useState("");
  const [perkDraft, setPerkDraft] = React.useState("");
  const [aiOpen, setAiOpen] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [suggested, setSuggested] = React.useState<string[]>([]);
  // Editors are uncontrolled once mounted; bumping the key reloads them after
  // an AI draft or a copied description replaces the content.
  const [editorKey, setEditorKey] = React.useState(0);

  const addSkill = (raw: string) => {
    const s = raw.trim();
    if (!s || job.skills.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    update({ skills: [...job.skills, s].slice(0, 30) });
  };

  const perks = Array.from(new Set([...COMMON_PERKS, ...job.perks]));

  return (
    <div className="max-w-4xl space-y-6 px-8 py-6">
      <StepHeading
        step={2}
        title="Job description"
        subtitle="Give candidates a clear picture of the role and its impact."
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} /> Write with AI
            </Button>
            <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
              <Copy className="h-4 w-4" /> Use a previous job
            </Button>
          </div>
        }
      />

      {SECTIONS.map(([key, label, hint]) => (
        <div key={`${key}-${editorKey}`}>
          <Label required={key === "aboutRole"} hint={hint}>
            {label}
          </Label>
          <RichTextEditor
            theme="admin"
            value={job.description[key] || ""}
            onChange={(v) => update({ description: { [key]: v } as Partial<Job["description"]> })}
            placeholder={hint}
            minHeight={key === "aboutRole" ? "96px" : "120px"}
          />
        </div>
      ))}

      <div>
        <Label hint={`${job.skills.length}/30`}>Skills</Label>
        <div className="flex flex-wrap items-center gap-2">
          {job.skills.map((s) => (
            <Chip key={s} onRemove={() => update({ skills: job.skills.filter((x) => x !== s) })}>
              {s}
            </Chip>
          ))}
          <input
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSkill(skillDraft);
                setSkillDraft("");
              }
            }}
            placeholder="Add a skill and press Enter"
            className="w-56 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
          />
        </div>
        {suggested.filter((s) => !job.skills.includes(s)).length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#7c7d94]">Suggestions</span>
            {suggested
              .filter((s) => !job.skills.includes(s))
              .map((s) => (
                <Chip key={s} onClick={() => addSkill(s)}>
                  <Plus className="h-3 w-3" /> {s}
                </Chip>
              ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">Education</div>
            <label className="flex items-center gap-2 text-xs text-[#c7c7da]">
              Required
              <SwitchControl
                checked={job.education.required}
                onChange={(v) => update({ education: { required: v } })}
                aria-label="Education required"
              />
            </label>
          </div>
          <TextInput
            label="Qualification"
            value={job.education.qualification || ""}
            maxLength={120}
            onChange={(e) => update({ education: { qualification: e.target.value } })}
            placeholder="e.g. Any graduate"
          />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="text-sm font-medium text-white">Perks</div>
          <div className="grid grid-cols-2 gap-2.5">
            {perks.map((p) => (
              <Checkbox
                key={p}
                checked={job.perks.includes(p)}
                label={p}
                onChange={(on) =>
                  update({ perks: on ? [...job.perks, p] : job.perks.filter((x) => x !== p) })
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              value={perkDraft}
              onChange={(e) => setPerkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && perkDraft.trim()) {
                  e.preventDefault();
                  if (!job.perks.includes(perkDraft.trim())) update({ perks: [...job.perks, perkDraft.trim()] });
                  setPerkDraft("");
                }
              }}
              placeholder="Add another perk"
              className="flex-1 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
            />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">About {detail.org.name}</div>
            <div className="text-xs text-[#7c7d94]">Auto-filled from your office profile</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#c7c7da]">
          {detail.org.description || "Your office profile has no description yet — add one in Office Settings and it will show here."}
        </p>
      </Card>

      <AiDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        job={job}
        onApply={(draft, mode, skills) => {
          const next = { ...job.description };
          for (const [key] of SECTIONS) {
            const add = draft[key] || "";
            next[key] = mode === "replace" ? add : [job.description[key], add].filter(Boolean).join("");
          }
          update({ description: next });
          setSuggested(skills);
          setEditorKey((k) => k + 1);
          setAiOpen(false);
          toast.success(mode === "replace" ? "Description replaced" : "Draft added below your text");
        }}
      />
      <CopyFromJobModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        currentId={job._id}
        onPick={(desc, skills, perks) => {
          update({ description: desc, skills: skills.length ? skills : job.skills, perks: perks.length ? perks : job.perks });
          setEditorKey((k) => k + 1);
          setTemplateOpen(false);
          toast.success("Description copied");
        }}
      />
    </div>
  );
}

function AiDrawer({
  open,
  onClose,
  job,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  onApply: (draft: Job["description"], mode: "append" | "replace", skills: string[]) => void;
}) {
  const [seniority, setSeniority] = React.useState("");
  const [tone, setTone] = React.useState<"professional" | "friendly" | "bold">("professional");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ draft: Job["description"]; suggestedSkills: string[] } | null>(null);

  const generate = async () => {
    if (!job.title.trim()) {
      toast.error("Add a job title in Basics first.");
      return;
    }
    setBusy(true);
    try {
      const res = await jobsApi.generateDescription({
        title: job.title,
        department: job.department,
        seniority: seniority || undefined,
        tone,
        notes: notes || undefined,
        skills: job.skills,
        workplace: job.workplace,
        locations: job.locations,
        employmentType: job.employmentType,
      });
      setResult({ draft: res.draft, suggestedSkills: res.suggestedSkills });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't generate a draft."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: GOLD }} /> Write with AI
        </span>
      }
      subtitle={job.title || "Untitled job"}
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={() => onApply(result.draft, "append", result.suggestedSkills)}>
              Insert below
            </Button>
            <Button onClick={() => onApply(result.draft, "replace", result.suggestedSkills)}>Replace description</Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5 px-6 py-5">
        <CustomSelect
          label="Seniority"
          value={seniority}
          onChange={setSeniority}
          placeholder="Select…"
          options={[
            "Intern",
            "Junior · 0–2 years",
            "Mid-level · 2–5 years",
            "Senior · 5–8 years",
            "Lead · 8+ years",
          ].map((v) => ({ value: v, label: v }))}
        />
        <div>
          <Label>Tone</Label>
          <div className="flex gap-2">
            {(["professional", "friendly", "bold"] as const).map((t) => (
              <Chip key={t} active={tone === t} onClick={() => setTone(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
        <TextArea
          label="Anything to include?"
          rows={4}
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Projects, team, ways of working, must-mention details…"
        />
        <Button onClick={generate} loading={busy} className="w-full">
          <Sparkles className="h-4 w-4" /> {result ? "Generate again" : "Generate"}
        </Button>

        {result && (
          <div className="space-y-4 rounded-xl border border-[#262626] bg-[#141414] p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Generated draft</div>
            {SECTIONS.map(([key, label]) =>
              result.draft[key] ? (
                <div key={key}>
                  <div className="mb-1 text-sm font-medium text-white">{label}</div>
                  <SafeHtml html={result.draft[key]} />
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function CopyFromJobModal({
  open,
  onClose,
  currentId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  currentId: string;
  onPick: (desc: Job["description"], skills: string[], perks: string[]) => void;
}) {
  const [rows, setRows] = React.useState<PostingRow[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setRows(null);
    jobsApi
      .getPostings({ status: "all", sort: "updated" })
      .then((r) => setRows(r.postings.filter((p) => p._id !== currentId)))
      .catch(() => setRows([]));
  }, [open, currentId]);

  return (
    <Modal open={open} onClose={onClose} title="Copy a description from another job">
      {!rows ? (
        <p className="text-sm text-[#7c7d94]">Loading your jobs…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#7c7d94]">You don&apos;t have other jobs to copy from yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r._id}
              type="button"
              disabled={!!busyId}
              onClick={async () => {
                setBusyId(r._id);
                try {
                  const d = await jobsApi.getJob(r._id);
                  onPick(d.job.description, d.job.skills, d.job.perks);
                } catch (err) {
                  toast.error(errorMessage(err, "Couldn't load that job."));
                } finally {
                  setBusyId(null);
                }
              }}
              className="flex w-full items-center justify-between rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-left transition-colors hover:border-[#3a3a48]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-white">{r.title}</span>
                <span className="block text-xs text-[#7c7d94]">Updated {formatDate(r.updatedAt)}</span>
              </span>
              <span className="text-xs" style={{ color: GOLD }}>
                {busyId === r._id ? "Copying…" : "Use"}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
