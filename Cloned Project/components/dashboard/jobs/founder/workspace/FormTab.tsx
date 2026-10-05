"use client";

// Job workspace · Application form — the live form exactly as candidates see
// it (read-only), with its rules called out. Editing happens in the wizard.

import React from "react";
import { Pencil } from "lucide-react";
import { FIELD_LABELS, LAYOUT_TYPES } from "../../constants";
import { Button, Card } from "../../ui";
import FormRenderer from "../../shared/FormRenderer";
import type { Job } from "../../types";

export default function FormTab({ job, onEdit }: { job: Job; onEdit: () => void }) {
  const pages = job.form.pages;
  const allFields = pages.flatMap((p) => p.fields);
  const rules = allFields.filter((f) => f.knockout?.enabled || f.condition?.fieldId || f.type === "quiz_mcq");
  return (
    <div className="grid gap-5 px-8 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {pages.map((p, i) => (
          <Card key={p.id} className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7c7d94]">
                  Page {i + 1} of {pages.length}
                  {p.timeLimitMinutes ? ` · ${p.timeLimitMinutes} min timed` : ""}
                  {p.passMark ? ` · pass ${p.passMark}` : ""}
                </div>
                <h3 className="text-base font-semibold text-white">{p.title}</h3>
                {p.description && <p className="text-sm text-[#7c7d94]">{p.description}</p>}
              </div>
            </div>
            <FormRenderer page={p} allFields={allFields} answers={{}} onChange={() => {}} readOnly />
          </Card>
        ))}
        {!pages.length && <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">This job has no application form yet.</Card>}
      </div>
      <div className="space-y-4">
        <Card className="p-5">
          <div className="text-sm font-semibold text-white">Form summary</div>
          <p className="mt-1 text-xs text-[#7c7d94]">
            {pages.length} pages · {allFields.filter((f) => !LAYOUT_TYPES.includes(f.type)).length} fields
          </p>
          <Button variant="secondary" className="mt-4 w-full" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit application form
          </Button>
          <p className="mt-3 text-[11px] text-[#61627a]">Changes apply to new applicants; submitted applications keep their answers.</p>
        </Card>
        {rules.length > 0 && (
          <Card className="p-5">
            <div className="mb-2 text-sm font-semibold text-white">Rules</div>
            <ul className="space-y-2 text-xs text-[#c7c7da]">
              {rules.map((f) => (
                <li key={f.id}>
                  <span className="text-white">{f.label || FIELD_LABELS[f.type]}</span>
                  <span className="block text-[#7c7d94]">
                    {[
                      f.knockout?.enabled ? "Knockout: rejects automatically" : "",
                      f.condition?.fieldId ? "Shown only when its condition is met" : "",
                      f.type === "quiz_mcq" ? (f.correctOptionId ? `Scored · ${f.points ?? 1} pt` : "Scored · no answer set") : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
