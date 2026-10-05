"use client";

// A18 · Rejection reasons — the list offered when rejecting a candidate and
// in knockout rules. Reasons are internal; candidates never see them.

import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { newId } from "../../constants";
import { Button, Card } from "../../ui";
import { SaveBar, SectionHeading, errorMessage, useDraft, type SectionProps } from "./shared";

const MAX_REASONS = 50;

export default function RejectionReasonsSection({ data, onSaved, onDirtyChange }: SectionProps) {
  const { draft, setDraft, dirty, reset } = useDraft(data.settings.rejectionReasons, onDirtyChange);
  const [newLabel, setNewLabel] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };

  const add = () => {
    const label = newLabel.trim().slice(0, 120);
    if (!label) return;
    if (draft.some((r) => r.label.trim().toLowerCase() === label.toLowerCase())) {
      toast.error("That reason is already on the list.");
      return;
    }
    setDraft([...draft, { id: newId("rsn_"), label }]);
    setNewLabel("");
  };

  const labels = draft.map((r) => r.label.trim().toLowerCase());
  const problem = labels.some((l) => !l)
    ? "Reasons can't be empty."
    : new Set(labels).size !== labels.length
      ? "Two reasons have the same wording."
      : null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await jobsApi.saveRejectionReasons(draft.map((r) => ({ id: r.id, label: r.label.trim() })));
      onSaved(res.settings);
      toast.success("Rejection reasons saved");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the reasons."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Rejection reasons"
        description="Offered when you reject a candidate or set up a knockout rule. Candidates never see them."
      />

      <Card className="overflow-hidden">
        {draft.length ? (
          draft.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 border-t border-[#1f1f24] px-4 py-2.5 first:border-t-0">
              <span className="w-6 text-right text-xs tabular-nums text-[#61627a]">{i + 1}</span>
              <input
                value={r.label}
                maxLength={120}
                onChange={(e) => setDraft(draft.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-white outline-none transition-colors hover:border-[#262626] focus:border-brand focus:bg-[#1A1A1A]"
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === draft.length - 1}
                className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDraft(draft.filter((x) => x.id !== r.id))}
                className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#f87171]/10 hover:text-[#f87171]"
                aria-label="Delete reason"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="px-5 py-6 text-center text-sm text-[#7c7d94]">No reasons yet — add the ones your team uses.</p>
        )}
        <div className="flex items-center gap-2 border-t border-[#1f1f24] px-4 py-3">
          <input
            value={newLabel}
            maxLength={120}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            disabled={draft.length >= MAX_REASONS}
            placeholder="Add a reason, e.g. Salary expectations too high"
            className="min-w-0 flex-1 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand disabled:opacity-50"
          />
          <Button variant="secondary" onClick={add} disabled={!newLabel.trim() || draft.length >= MAX_REASONS}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} problem={problem} />
    </div>
  );
}
