"use client";

// Renders one page of a job's application form. Used by the founder's
// "Preview as candidate" and by the candidate's apply flow, so both always
// show the same thing. Conditional fields are evaluated here with the same
// rules as the backend (services/jobs.ts: conditionMet / fieldState).

import React from "react";
import { ArrowDown, ArrowUp, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { GOLD, errorMessage } from "../ui";
import type { Answer, AnswerFile, FieldCondition, FormField, FormPage } from "../types";

export type AnswerMap = Record<string, Answer>;

function optionLabel(field: FormField | undefined, value: unknown): string {
  const opt = field?.options?.find((o) => o.id === value);
  return opt ? opt.label : String(value ?? "");
}

export function conditionMet(cond: FieldCondition, answers: AnswerMap, byId: Map<string, FormField>): boolean {
  const a = answers[cond.fieldId];
  const src = byId.get(cond.fieldId);
  if (!a || a.value === undefined || a.value === null || a.value === "") return false;
  const values = Array.isArray(a.value) ? a.value : [a.value];
  const want = String(cond.value ?? "").trim().toLowerCase();
  const asText = (v: unknown) => [String(v).toLowerCase(), optionLabel(src, v).toLowerCase()];
  switch (cond.operator) {
    case "equals":
      return values.some((v) => asText(v).includes(want));
    case "not_equals":
      return !values.some((v) => asText(v).includes(want));
    case "contains":
      return values.some((v) => asText(v).some((t) => t.includes(want)));
    case "greater_than":
      return Number(a.value) > Number(cond.value);
    case "less_than":
      return Number(a.value) < Number(cond.value);
    default:
      return false;
  }
}

export function fieldState(f: FormField, answers: AnswerMap, byId: Map<string, FormField>) {
  if (!f.condition?.fieldId) return { visible: true, required: f.required };
  const met = conditionMet(f.condition, answers, byId);
  return { visible: met || !f.condition.hideUntilMet, required: met && f.required };
}

const TEXT_TYPES = new Set([
  "short_text",
  "email",
  "phone",
  "url",
  "portfolio_link",
  "profile_full_name",
  "profile_email",
  "profile_phone",
  "profile_location",
  "profile_company",
  "profile_current_ctc",
  "profile_expected_ctc",
  "profile_notice_period",
  "profile_linkedin",
]);
const FILE_TYPES = new Set(["resume", "file_upload", "video_answer"]);

const inputClass =
  "w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-60";

function inputType(t: string) {
  if (t === "email" || t === "profile_email") return "email";
  if (t === "phone" || t === "profile_phone") return "tel";
  if (t === "url" || t === "portfolio_link" || t === "profile_linkedin") return "url";
  return "text";
}

export default function FormRenderer({
  page,
  allFields,
  answers,
  onChange,
  errors = {},
  onUpload,
  prefilledIds,
  readOnly,
}: {
  page: FormPage;
  allFields: FormField[];
  answers: AnswerMap;
  onChange: (fieldId: string, patch: Partial<Answer>) => void;
  errors?: Record<string, string>;
  /** Uploads a file and returns where it lives; omit to disable uploads (preview). */
  onUpload?: (file: File) => Promise<AnswerFile>;
  /** Fields prefilled from the candidate's Garage profile. */
  prefilledIds?: Set<string>;
  readOnly?: boolean;
}) {
  const byId = React.useMemo(() => new Map(allFields.map((f) => [f.id, f])), [allFields]);
  return (
    <div className="space-y-5">
      {page.fields.map((f) => {
        const { visible, required } = fieldState(f, answers, byId);
        if (!visible) return null;
        return (
          <FieldInput
            key={f.id}
            field={f}
            required={required}
            answer={answers[f.id]}
            error={errors[f.id]}
            prefilled={prefilledIds?.has(f.id)}
            onChange={(patch) => onChange(f.id, patch)}
            onUpload={onUpload}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function FieldLabel({ field, required, prefilled }: { field: FormField; required: boolean; prefilled?: boolean }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label className="block text-sm font-medium text-white">
        {field.label}
        {required && <span className="ml-1 text-[#f87171]">*</span>}
      </label>
      {prefilled && <span className="text-[11px] text-[#7c7d94]">From your profile</span>}
    </div>
  );
}

function FieldInput({
  field,
  required,
  answer,
  error,
  prefilled,
  onChange,
  onUpload,
  readOnly,
}: {
  field: FormField;
  required: boolean;
  answer?: Answer;
  error?: string;
  prefilled?: boolean;
  onChange: (patch: Partial<Answer>) => void;
  onUpload?: (file: File) => Promise<AnswerFile>;
  readOnly?: boolean;
}) {
  const value = answer?.value;
  const errorEl = error ? <p className="mt-1.5 text-xs text-[#f87171]">{error}</p> : null;
  const help = field.helpText ? <p className="mb-2 text-xs text-[#7c7d94]">{field.helpText}</p> : null;

  if (field.type === "section_heading") {
    return <h3 className="pt-2 text-base font-semibold text-white">{field.label}</h3>;
  }
  if (field.type === "info_text") {
    return <p className="text-sm leading-6 text-[#c7c7da]">{field.label}</p>;
  }
  if (field.type === "declaration") {
    const checked = value === true;
    return (
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-[#c7c7da]">
          <input
            type="checkbox"
            checked={checked}
            disabled={readOnly}
            onChange={(e) => onChange({ value: e.target.checked })}
            className="glass-check mt-0.5"
          />
          <span>
            {field.label}
            {required && <span className="ml-1 text-[#f87171]">*</span>}
          </span>
        </label>
        {errorEl}
      </div>
    );
  }

  let control: React.ReactNode = null;
  if (TEXT_TYPES.has(field.type)) {
    control = (
      <input
        type={inputType(field.type)}
        value={typeof value === "string" ? value : ""}
        disabled={readOnly}
        onChange={(e) => onChange({ value: e.target.value })}
        className={inputClass}
        placeholder={field.type === "portfolio_link" || field.type === "url" || field.type === "profile_linkedin" ? "https://" : ""}
      />
    );
  } else if (field.type === "long_text") {
    const text = typeof value === "string" ? value : "";
    control = (
      <>
        <textarea
          rows={4}
          value={text}
          disabled={readOnly}
          maxLength={field.maxLength || undefined}
          onChange={(e) => onChange({ value: e.target.value })}
          className={`${inputClass} resize-y`}
        />
        {field.maxLength && (
          <div className="mt-1 text-right text-[11px] text-[#61627a]">
            {text.length} / {field.maxLength}
          </div>
        )}
      </>
    );
  } else if (field.type === "number" || field.type === "profile_experience") {
    control = (
      <input
        type="number"
        min={0}
        value={value === undefined || value === null ? "" : String(value)}
        disabled={readOnly}
        onWheel={(e) => e.currentTarget.blur()}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value) })}
        className={inputClass}
      />
    );
  } else if (field.type === "date") {
    control = (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        disabled={readOnly}
        onChange={(e) => onChange({ value: e.target.value })}
        className={`${inputClass} [color-scheme:dark]`}
      />
    );
  } else if (field.type === "single_choice" || field.type === "quiz_mcq") {
    control = (
      <div className="space-y-2">
        {field.options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={readOnly}
              onClick={() => onChange({ value: o.id })}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors"
              style={
                active
                  ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 8%, transparent)", color: "#fff" }
                  : { borderColor: "#262626", background: "#1A1A1A", color: "#c7c7da" }
              }
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: active ? GOLD : "#3A3A3A" }}
              >
                {active && <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    );
  } else if (field.type === "checkboxes") {
    const arr = Array.isArray(value) ? value : [];
    control = (
      <div className="space-y-2">
        {field.options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-3 text-sm text-[#c7c7da]">
            <input
              type="checkbox"
              checked={arr.includes(o.id)}
              disabled={readOnly}
              onChange={(e) =>
                onChange({ value: e.target.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id) })
              }
              className="glass-check"
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "dropdown") {
    control = (
      <select
        value={typeof value === "string" ? value : ""}
        disabled={readOnly}
        onChange={(e) => onChange({ value: e.target.value })}
        className={`${inputClass} appearance-none [&>option]:bg-[#1A1A1A]`}
      >
        <option value="">Select one</option>
        {field.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "yes_no") {
    control = (
      <div className="flex gap-2">
        {["yes", "no"].map((v) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={readOnly}
              onClick={() => onChange({ value: v })}
              className="min-w-[88px] rounded-xl border px-4 py-2.5 text-sm transition-colors"
              style={
                active
                  ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 8%, transparent)", color: "#fff" }
                  : { borderColor: "#262626", background: "#1A1A1A", color: "#c7c7da" }
              }
            >
              {v === "yes" ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    );
  } else if (field.type === "rating") {
    const max = field.scaleMax || 5;
    control = (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => onChange({ value: n })}
              className="h-10 w-10 rounded-xl border text-sm transition-colors"
              style={
                active
                  ? { borderColor: GOLD, background: GOLD, color: "#000" }
                  : { borderColor: "#262626", background: "#1A1A1A", color: "#c7c7da" }
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  } else if (field.type === "ranking") {
    const order: string[] =
      Array.isArray(value) && value.length === field.options.length ? (value as string[]) : field.options.map((o) => o.id);
    const move = (i: number, d: number) => {
      const next = [...order];
      const j = i + d;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      onChange({ value: next });
    };
    control = (
      <ol className="space-y-2">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#c7c7da]">
            <span className="w-5 text-xs text-[#7c7d94]">{i + 1}</span>
            <span className="flex-1">{optionLabel(field, id)}</span>
            <button type="button" disabled={readOnly || i === 0} onClick={() => move(i, -1)} className="text-[#7c7d94] hover:text-white disabled:opacity-30">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={readOnly || i === order.length - 1}
              onClick={() => move(i, 1)}
              className="text-[#7c7d94] hover:text-white disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
    );
  } else if (FILE_TYPES.has(field.type)) {
    control = <FileField field={field} answer={answer} onChange={onChange} onUpload={onUpload} readOnly={readOnly} />;
  }

  return (
    <div>
      <FieldLabel field={field} required={required} prefilled={prefilled} />
      {help}
      {control}
      {errorEl}
    </div>
  );
}

function FileField({
  field,
  answer,
  onChange,
  onUpload,
  readOnly,
}: {
  field: FormField;
  answer?: Answer;
  onChange: (patch: Partial<Answer>) => void;
  onUpload?: (file: File) => Promise<AnswerFile>;
  readOnly?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const files = answer?.files || [];
  const accept = field.fileTypes.length ? field.fileTypes.map((t) => `.${t}`).join(",") : undefined;
  const canAdd = !readOnly && (field.multiple || files.length === 0);

  const pick = async (list: FileList | null) => {
    if (!list?.length || !onUpload) return;
    const chosen = Array.from(list).slice(0, field.multiple ? 10 : 1);
    for (const file of chosen) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (field.fileTypes.length && !field.fileTypes.includes(ext)) {
        toast.error(`${file.name}: use ${field.fileTypes.map((t) => t.toUpperCase()).join(", ")}.`);
        return;
      }
      if (field.maxSizeMb && file.size > field.maxSizeMb * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${field.maxSizeMb} MB.`);
        return;
      }
    }
    setBusy(true);
    try {
      const uploaded: AnswerFile[] = [];
      for (const file of chosen) uploaded.push(await onUpload(file));
      onChange({ files: field.multiple ? [...files, ...uploaded] : uploaded });
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <div key={`${f.url}-${i}`} className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-2.5">
          <FileText className="h-4 w-4 text-[#7c7d94]" />
          <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-white hover:underline">
            {f.name}
          </a>
          {f.size ? <span className="text-xs text-[#61627a]">{(f.size / 1024 / 1024).toFixed(1)} MB</span> : null}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange({ files: files.filter((_, j) => j !== i) })}
              className="text-[#7c7d94] hover:text-white"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {canAdd && (
        <button
          type="button"
          disabled={!onUpload || busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#3A3A3A] bg-[#141414] px-4 py-6 text-sm text-[#c7c7da] transition-colors hover:border-[#4a4a5c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-[#7c7d94]" />}
          {onUpload ? (busy ? "Uploading…" : "Click to upload") : "Uploads are off in preview"}
          <span className="text-[11px] text-[#61627a]">
            {[field.fileTypes.map((t) => t.toUpperCase()).join(", "), field.maxSizeMb ? `${field.maxSizeMb} MB max` : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
      )}
      <input ref={inputRef} type="file" hidden accept={accept} multiple={field.multiple} onChange={(e) => pick(e.target.files)} />
    </div>
  );
}
