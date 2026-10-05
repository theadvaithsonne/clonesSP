"use client";

// A18 · Default pipeline — the stages every new job starts with. Applied
// stays first and Hired last; the stages between can be renamed, re-typed,
// given an owner, reordered, added and removed. Existing jobs keep their own.

import React from "react";
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { CATEGORY_META, newId } from "../../constants";
import { Button, Card, GOLD, useLoad } from "../../ui";
import type { StageCategory } from "../../types";
import { SaveBar, SectionHeading, errorMessage, useDraft, type SectionProps } from "./shared";

type StageDraft = { key: string; name: string; category: StageCategory; ownerId: string | null };

const MAX_STAGES = 15;
const MIDDLE_CATEGORIES: StageCategory[] = ["screening", "assessment", "interview", "offer"];
const BUILT_IN: Array<[string, StageCategory]> = [
  ["Applied", "applied"],
  ["Screening", "screening"],
  ["Assessment", "assessment"],
  ["Interview", "interview"],
  ["Offer", "offer"],
  ["Hired", "hired"],
];

const builtIn = (): StageDraft[] => BUILT_IN.map(([name, category]) => ({ key: newId("stg_"), name, category, ownerId: null }));
const comparable = (stages: StageDraft[]) => stages.map((s) => ({ n: s.name.trim(), c: s.category, o: s.ownerId || null }));

const selectClass =
  "rounded-lg border border-[#262626] bg-[#141414] px-2 py-1.5 text-xs text-[#c7c7da] outline-none focus:border-brand [&>option]:bg-[#141414]";

export default function DefaultPipelineSection({ data, onSaved, onDirtyChange }: SectionProps) {
  const saved = data.settings.defaultPipeline?.stages || [];
  const usingBuiltIn = saved.length < 2;
  const savedKey = JSON.stringify(saved);
  const baseline = React.useMemo<StageDraft[]>(
    () =>
      usingBuiltIn
        ? builtIn()
        : saved.map((s) => ({ key: newId("stg_"), name: s.name, category: s.category, ownerId: s.ownerId || null })),
    // Rebuild only when the saved pipeline changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedKey]
  );
  const { draft, setDraft, dirty, reset } = useDraft(baseline, onDirtyChange, comparable);
  const members = useLoad(() => jobsApi.getOfficeMembers(), []);
  const [saving, setSaving] = React.useState(false);

  const patch = (key: string, p: Partial<StageDraft>) => setDraft((d) => d.map((s) => (s.key === key ? { ...s, ...p } : s)));

  const move = (i: number, dir: number) => {
    const j = i + dir;
    // Only the middle stages move, and never past Applied / Hired.
    if (i <= 0 || i >= draft.length - 1 || j <= 0 || j >= draft.length - 1) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };

  const add = () => {
    if (draft.length >= MAX_STAGES) return;
    const stage: StageDraft = { key: newId("stg_"), name: "New stage", category: "interview", ownerId: null };
    setDraft([...draft.slice(0, -1), stage, draft[draft.length - 1]]);
  };

  const problem = draft.some((s) => !s.name.trim()) ? "Every stage needs a name." : null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await jobsApi.saveDefaultPipeline(
        draft.map((s) => ({ name: s.name.trim(), category: s.category, ownerId: s.ownerId || null }))
      );
      onSaved(res.settings);
      toast.success("Default pipeline saved — new jobs start with it");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the pipeline."));
    } finally {
      setSaving(false);
    }
  };

  const memberOptions = members.data || [];

  return (
    <div>
      <SectionHeading
        title="Default pipeline"
        description="The stages every new job starts with. Jobs you've already created keep their own pipeline."
        action={
          <Button variant="secondary" onClick={() => setDraft(builtIn())}>
            <RotateCcw className="h-4 w-4" /> Reset to built-in
          </Button>
        }
      />

      {usingBuiltIn && !dirty && (
        <p className="mb-3 text-xs text-[#7c7d94]">You&rsquo;re using Garage&rsquo;s built-in pipeline. Edit it here to make it your own.</p>
      )}

      <Card className="p-4">
        <div className="space-y-2">
          {draft.map((s, i) => {
            const fixed = i === 0 || i === draft.length - 1;
            const meta = CATEGORY_META[s.category];
            return (
              <div key={s.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2.5">
                <span className="w-5 text-right text-xs tabular-nums text-[#61627a]">{i + 1}</span>
                {fixed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] px-2 py-1.5 text-xs text-[#c7c7da]" title="Fixed stage">
                    <Lock className="h-3 w-3 text-[#61627a]" />
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                ) : (
                  <select
                    value={s.category}
                    onChange={(e) => patch(s.key, { category: e.target.value as StageCategory })}
                    className={selectClass}
                    title="Stage type — what candidates see"
                  >
                    {MIDDLE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].label}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  value={s.name}
                  maxLength={80}
                  onChange={(e) => patch(s.key, { name: e.target.value })}
                  className="min-w-[140px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-white outline-none transition-colors hover:border-[#262626] focus:border-brand focus:bg-[#141414]"
                  placeholder="Stage name"
                />
                <select
                  value={s.ownerId || ""}
                  onChange={(e) => patch(s.key, { ownerId: e.target.value || null })}
                  className={`${selectClass} max-w-[160px]`}
                  title="Stage owner"
                >
                  <option value="">No owner</option>
                  {memberOptions.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                  {s.ownerId && !memberOptions.some((m) => m._id === s.ownerId) && (
                    <option value={s.ownerId}>{members.loading ? "Loading…" : "Former member"}</option>
                  )}
                </select>
                {!fixed ? (
                  <>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i <= 1}
                      className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i >= draft.length - 2}
                      className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft(draft.filter((x) => x.key !== s.key))}
                      className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#f87171]/10 hover:text-[#f87171]"
                      aria-label="Remove stage"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <span className="w-[98px]" />
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={add}
          disabled={draft.length >= MAX_STAGES}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-40"
          style={{ color: GOLD }}
        >
          <Plus className="h-4 w-4" /> Add stage
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-[#1f1f24] pt-3 text-xs text-[#7c7d94]">
          <span className="font-bold uppercase tracking-wider">Fixed outcomes</span>
          <div className="flex gap-2">
            <span className="rounded-md border border-[#262626] px-2 py-0.5">Rejected</span>
            <span className="rounded-md border border-[#262626] px-2 py-0.5">Withdrawn</span>
          </div>
        </div>
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} problem={problem} />
    </div>
  );
}
