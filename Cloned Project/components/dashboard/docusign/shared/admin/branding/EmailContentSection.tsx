"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DsBrandingCatalogItem, DsBrandingEditor, DsBrandingFieldError, DsEmailContent, DsEmailKind } from "@/lib/docusign/types";
import { FIELD_ERROR, FIELD_HINT, FIELD_LABEL, SECTION, SECTION_SUBTITLE, SECTION_TITLE, TEXT_AREA, TEXT_INPUT, errorFor } from "./brandingUi";

type Field = keyof DsEmailContent;
type FieldEl = HTMLInputElement | HTMLTextAreaElement;

const FIELD_META: Record<Field, { label: string; hint?: string }> = {
  subject: { label: "Subject", hint: "Subjects can't name people — they show in lock-screen notifications." },
  heading: { label: "Heading" },
  body: { label: "Message", hint: "Shown under the heading. The sender's own note, if any, is added below it." },
  buttonLabel: { label: "Button label" },
};

// "{{sender_name}} sent you…" → "[Sender name] sent you…"
const readableDefault = (text: string, labels: Record<string, string>) =>
  text.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, token: string) => `[${labels[token] || token.replace(/_/g, " ")}]`);

interface EmailContentSectionProps {
  catalog: DsBrandingCatalogItem[];
  defaults: DsBrandingEditor["defaults"]["content"];
  limits: DsBrandingEditor["limits"];
  kind: DsEmailKind;
  onKindChange: (kind: DsEmailKind) => void;
  content: Record<DsEmailKind, DsEmailContent>;
  onChange: (kind: DsEmailKind, field: Field, value: string) => void;
  onResetKind: (kind: DsEmailKind) => void;
  errors: DsBrandingFieldError[];
}

export function EmailContentSection({ catalog, defaults, limits, kind, onKindChange, content, onChange, onResetKind, errors }: EmailContentSectionProps) {
  const item = catalog.find((c) => c.kind === kind) || catalog[0];
  const values = content[kind];
  const defaultsForKind = defaults[kind];
  const fields: Field[] = item.hasButton ? ["subject", "heading", "body", "buttonLabel"] : ["subject", "heading", "body"];

  // Variables go in wherever the cursor last was — the chips below follow the field being edited, since
  // subjects allow fewer of them than the rest.
  const refs = useRef<Partial<Record<Field, FieldEl | null>>>({});
  const [lastFocused, setActiveField] = useState<Field>("heading");
  // The Verification code email has no button field — fall back rather than insert into a hidden one.
  const activeField: Field = fields.includes(lastFocused) ? lastFocused : "heading";
  const tokensFor = (field: Field) => (field === "subject" ? item.subjectTokens : item.tokens);

  const insertToken = (token: string) => {
    const field = activeField;
    const el = refs.current[field];
    const current = values[field];
    const text = `{{${token}}}`;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    onChange(kind, field, current.slice(0, start) + text + current.slice(end));
    requestAnimationFrame(() => {
      const node = refs.current[field];
      if (!node) return;
      node.focus();
      node.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const kindsWithErrors = new Set(errors.filter((e) => e.field.startsWith("content.")).map((e) => e.field.split(".")[1]));
  const isCustomised = fields.some((f) => values[f].trim() && values[f].trim() !== defaultsForKind[f]);

  return (
    <div className={SECTION}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={SECTION_TITLE}>Email content</h3>
          <p className={SECTION_SUBTITLE}>Edit the wording of each email. Leave a field empty to use the default.</p>
        </div>
        {isCustomised && (
          <button
            type="button"
            onClick={() => onResetKind(kind)}
            className="inline-flex items-center gap-1.5 text-xs text-[#8a8a9b] transition-colors hover:text-white/85"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset this email
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <p className={FIELD_LABEL}>Email</p>
        <Select value={kind} onValueChange={(v) => onKindChange(v as DsEmailKind)}>
          <SelectTrigger className="h-11 w-full border-[#2a2a35] bg-[#0c0c10] text-sm text-white/90" aria-label="Email to edit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((c) => (
              <SelectItem key={c.kind} value={c.kind}>
                <span className="flex items-center gap-2">
                  {c.label}
                  {kindsWithErrors.has(c.kind) && <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-label="has problems" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className={FIELD_HINT}>{item.description}</p>
      </div>

      {fields.map((field) => {
        const meta = FIELD_META[field];
        const error = errorFor(errors, `content.${kind}.${field}`);
        const limit = limits[field];
        const value = values[field];
        const common = {
          ref: (el: FieldEl | null) => {
            refs.current[field] = el;
          },
          value,
          // Shown only once a field is cleared — that's what will be used instead, in plain words
          // ("[Sender name]") rather than raw {{sender_name}} codes.
          placeholder: `Default: ${readableDefault(defaultsForKind[field], item.tokenLabels)}`,
          maxLength: limit,
          onFocus: () => setActiveField(field),
          onChange: (e: React.ChangeEvent<FieldEl>) => onChange(kind, field, e.target.value),
          "aria-invalid": !!error,
          "aria-label": `${item.label} ${meta.label}`,
        };
        return (
          <div key={`${kind}-${field}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className={FIELD_LABEL}>{meta.label}</label>
              {value.trim() && value.trim() !== defaultsForKind[field] && (
                <button type="button" onClick={() => onChange(kind, field, defaultsForKind[field])} className="text-[11px] text-[#7a7a90] hover:text-white/80">
                  Use default
                </button>
              )}
            </div>
            {field === "body" ? (
              <textarea {...common} rows={4} className={cn(TEXT_AREA, error && "border-red-500/60")} />
            ) : (
              <input {...common} className={cn(TEXT_INPUT, error && "border-red-500/60")} />
            )}
            <div className="flex items-start justify-between gap-3">
              {error ? <p className={FIELD_ERROR}>{error}</p> : meta.hint ? <p className={FIELD_HINT}>{meta.hint}</p> : <span />}
              {field === "body" && <span className="shrink-0 text-[11px] tabular-nums text-[#5a5a72]">{value.length}/{limit}</span>}
            </div>
          </div>
        );
      })}

      <div className="space-y-2 rounded-xl border border-dashed border-[#2a2a35] p-3">
        <p className={FIELD_HINT}>
          Insert into <span className="text-white/70">{FIELD_META[activeField].label}</span> — filled in for each email:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tokensFor(activeField).map((token) => (
            <button
              key={token}
              type="button"
              // Keep focus (and the cursor position) in the field being edited.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertToken(token)}
              className="rounded-md border border-[#2a2a35] bg-[#0c0c10] px-2 py-1 text-[11px] text-white/75 transition-colors hover:border-brand/50 hover:text-white"
              title={`{{${token}}}`}
            >
              {item.tokenLabels[token] || token}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
