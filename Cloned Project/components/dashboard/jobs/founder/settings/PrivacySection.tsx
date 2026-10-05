"use client";

// A18 · Data & privacy — how long opted-in candidates stay in the talent
// pool, whether candidates may ask for deletion, and the consent candidates
// agree to before submitting. The minimum clause is fixed; the office can add
// its own wording after it.

import React from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { Card, CustomSelect, Toggle } from "../../ui";
import { SaveBar, SectionHeading, errorMessage, useDraft, type SectionProps } from "./shared";

const RETENTION_OPTIONS = [3, 6, 12, 24, 36];

export default function PrivacySection({ data, onSaved, onDirtyChange }: SectionProps) {
  const p = data.settings.privacy;
  const baseline = React.useMemo(
    () => ({
      retentionMonths: p?.retentionMonths || 12,
      allowDeletionRequests: p?.allowDeletionRequests ?? true,
      consentAddition: p?.consentAddition || "",
    }),
    [p]
  );
  const { draft, setDraft, dirty, reset } = useDraft(baseline, onDirtyChange);
  const [saving, setSaving] = React.useState(false);

  const months = RETENTION_OPTIONS.includes(draft.retentionMonths)
    ? RETENTION_OPTIONS
    : [...RETENTION_OPTIONS, draft.retentionMonths].sort((a, b) => a - b);

  const save = async () => {
    setSaving(true);
    try {
      const res = await jobsApi.savePrivacy({
        retentionMonths: draft.retentionMonths,
        allowDeletionRequests: draft.allowDeletionRequests,
        consentAddition: draft.consentAddition.trim(),
      });
      onSaved(res.settings);
      toast.success("Privacy settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the privacy settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Data & privacy"
        description={`Set how ${data.org.name} keeps applicant data and what candidates consent to.`}
      />

      <div className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="text-sm font-medium text-white">Data retention</div>
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_200px]">
            <div>
              <div className="text-sm text-[#c7c7da]">Keep talent-pool candidates for</div>
              <p className="mt-0.5 text-xs text-[#7c7d94]">
                Candidates who opt into your talent pool stay searchable for this long after they apply, then drop out of it.
              </p>
            </div>
            <CustomSelect
              value={String(draft.retentionMonths)}
              onChange={(v) => setDraft((d) => ({ ...d, retentionMonths: Number(v) }))}
              options={months.map((m) => ({ value: String(m), label: `${m} months` }))}
            />
          </div>
          <div className="border-t border-[#1f1f24] pt-4">
            <Toggle
              checked={draft.allowDeletionRequests}
              onChange={(v) => setDraft((d) => ({ ...d, allowDeletionRequests: v }))}
              label="Allow candidates to request deletion"
              description="Candidates can ask you to delete the data they sent with an application."
            />
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Candidate consent</div>
              <div className="text-xs text-[#7c7d94]">Shown before every application is submitted.</div>
            </div>
            <span className="rounded-md border border-[#262626] px-2 py-0.5 text-[11px] text-[#c7c7da]">Required</span>
          </div>

          <div className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7c7d94]">
              <Lock className="h-3 w-3" /> Minimum clause
            </div>
            <p className="text-sm leading-6 text-[#c7c7da]">{data.consentMinimum}</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Your addition</label>
              <span className="text-[11px] text-zinc-500">{draft.consentAddition.length} / 4000</span>
            </div>
            <textarea
              rows={4}
              maxLength={4000}
              value={draft.consentAddition}
              onChange={(e) => setDraft((d) => ({ ...d, consentAddition: e.target.value }))}
              placeholder="e.g. You may also choose to stay in our talent pool so we can contact you about relevant roles in the future."
              className="w-full resize-y rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm leading-6 text-white placeholder:text-zinc-600 outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <p className="mt-2 text-xs text-[#61627a]">
              Locked text protects the minimum consent standard. Your addition appears right after it.
            </p>
          </div>
        </Card>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} />
    </div>
  );
}
