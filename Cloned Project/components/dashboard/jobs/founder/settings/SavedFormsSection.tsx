"use client";

// A18 · Saved forms — application forms saved from the builder for reuse.

import React from "react";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { Card, formatDate, useConfirm } from "../../ui";
import { SectionHeading, errorMessage, type SectionProps } from "./shared";

export default function SavedFormsSection({ data, onSaved }: SectionProps) {
  const forms = data.settings.savedForms || [];
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const remove = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      message: "Jobs that already used this form keep their own copy. It just won't be offered for new jobs.",
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await jobsApi.deleteSavedForm(id);
      onSaved(res.settings);
      toast.success("Saved form deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the form."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Saved forms"
        description="Reusable application forms. Save one from Post a job → Application form → “Save as reusable form”."
      />
      {forms.length ? (
        <Card className="overflow-hidden">
          {forms.map((f) => {
            const fields = f.pages.reduce((s, p) => s + (p.fields?.length || 0), 0);
            return (
              <div key={f.id} className="flex items-center gap-4 border-t border-[#1f1f24] px-5 py-3.5 first:border-t-0">
                <FileText className="h-4 w-4 shrink-0 text-[#7c7d94]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{f.name}</div>
                  <div className="text-xs text-[#7c7d94]">
                    {f.pages.length} page{f.pages.length === 1 ? "" : "s"} · {fields} field{fields === 1 ? "" : "s"}
                    {f.createdAt ? ` · saved ${formatDate(f.createdAt)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(f.id, f.name)}
                  disabled={busyId === f.id}
                  className="rounded-lg p-1.5 text-[#7c7d94] transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171] disabled:opacity-40"
                  aria-label={`Delete ${f.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="px-5 py-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-[#3A3A3A]" />
          <p className="text-sm text-white">No saved forms yet</p>
          <p className="mt-1 text-xs text-[#7c7d94]">
            While building a job&rsquo;s application form, choose “Save as reusable form” to keep it here.
          </p>
        </Card>
      )}
      {confirmDialog}
    </div>
  );
}
