"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { EyeOff, Trash2 } from "lucide-react";

type EmailBlock = {
  id: string;
  type: string;
  content: Record<string, string>;
  styles: Record<string, string>;
};

const CLIENT_PREVIEWS = [
  { name: "Gmail", limit: 100 },
  { name: "iPhone Mail", limit: 140 },
  { name: "Outlook", limit: 50 },
] as const;

export function createPreheaderBlockContent(): Record<string, string> {
  return {
    text: "Preview your email content here — open to read the full message inside.",
  };
}

export function createPreheaderBlockStyles(): Record<string, string> {
  return {
    hideInBody: "true",
    mobileVisibility: "auto",
    fontSize: "12",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
  };
}

function charCountColor(len: number): string {
  if (len < 40) return "#9CA3AF";
  if (len < 100) return "#10B981";
  return "#EF4444";
}

export function renderPreheaderHidden(
  content: Record<string, string>,
  esc: (str: string) => string,
): string {
  const text = esc(content.text || "");
  return `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${text}</div>`;
}

export function renderPreheaderVisibleRow(
  s: Record<string, string>,
  content: Record<string, string>,
  esc: (str: string) => string,
): string {
  const text = esc(content.text || "");
  const mobileClass = s.mobileVisibility === "hide" ? "preheader-hide-mobile" : s.mobileVisibility === "show" ? "preheader-show-mobile" : "";
  return `<tr class="${mobileClass}"><td style="font-size:${s.fontSize || 12}px;color:${s.color || "#6B7280"};padding:10px 16px;text-align:center;background-color:${s.backgroundColor || "#F9FAFB"};font-family:Arial,Helvetica,sans-serif;">${text}</td></tr>`;
}

export function buildPreheaderExportFragments(
  components: EmailBlock[],
  esc: (str: string) => string,
): { hiddenHtml: string; visibleRows: string } {
  const blocks = components.filter((c) => c.type === "preheader");
  const hiddenHtml = blocks
    .filter((b) => b.styles.hideInBody !== "false")
    .map((b) => renderPreheaderHidden(b.content, esc))
    .join("\n  ");
  const visibleRows = blocks
    .filter((b) => b.styles.hideInBody === "false")
    .map((b) => renderPreheaderVisibleRow(b.styles, b.content, esc))
    .join("\n              ");
  return { hiddenHtml, visibleRows };
}

export function sortComponentsWithPreheaderFirst<T extends { type: string }>(components: T[]): T[] {
  const pre = components.filter((c) => c.type === "preheader");
  const rest = components.filter((c) => c.type !== "preheader");
  return [...pre, ...rest];
}

export function PreheaderBlockRenderer({
  block,
  onUpdate,
}: {
  block: EmailBlock;
  onUpdate: (b: EmailBlock) => void;
}) {
  const s = block.styles;
  const text = block.content.text || "";
  const [localLen, setLocalLen] = useState(text.length);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = s.hideInBody !== "false";

  useEffect(() => {
    setLocalLen(text.length);
    if (ref.current && ref.current.innerText !== text) {
      ref.current.innerText = text;
    }
  }, [text]);

  const handleBlur = () => {
    if (!ref.current) return;
    const next = ref.current.innerText.trim();
    const sliced = next.slice(0, 100);
    if (sliced !== block.content.text) {
      onUpdate({ ...block, content: { ...block.content, text: sliced } });
    }
    if (next !== sliced) {
      ref.current.innerText = sliced;
    }
    setLocalLen(sliced.length);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setLocalLen(e.currentTarget.innerText.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) return;

    const allowedKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Tab",
      "Escape",
      "Enter",
    ];
    if (allowedKeys.includes(e.key)) return;

    const textVal = e.currentTarget.innerText || "";
    const selection = window.getSelection();
    const selectedTextLength = selection ? selection.toString().length : 0;

    if (textVal.length - selectedTextLength >= 100) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasteText = e.clipboardData.getData("text") || "";
    const currentText = e.currentTarget.innerText || "";

    const selection = window.getSelection();
    const selectedTextLength = selection ? selection.toString().length : 0;

    const allowedLength = 100 - (currentText.length - selectedTextLength);
    if (allowedLength <= 0) return;

    const truncatedPaste = pasteText.slice(0, allowedLength);
    document.execCommand("insertText", false, truncatedPaste);
    setLocalLen(e.currentTarget.innerText.length);
  };

  return (
    <div
      className="mx-2 my-2 rounded-lg border border-dashed border-[#C4B5FD]/60 overflow-hidden"
      style={{ backgroundColor: s.backgroundColor || "#F9FAFB" }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#EDE9FE]/80 border-b border-[#DDD6FE]">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
          <EyeOff className="h-3.5 w-3.5" />
          Preview text {hidden ? "(hidden in email)" : "(visible in email)"}
        </div>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: charCountColor(localLen) }}>
          {localLen} chars {localLen >= 40 && localLen < 100 ? "· good" : localLen === 100 ? "· limit reached" : localLen > 100 ? "· too long" : "· short"}
        </span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="outline-none px-4 py-3 text-[13px] leading-relaxed min-h-[44px]"
        style={{
          color: s.color || "#6B7280",
          fontSize: `${s.fontSize || 12}px`,
        }}
      >
        {text || "Enter pre-header preview text…"}
      </div>
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 cursor-pointer">
        <span className="text-[12px] font-semibold text-[#a8a8a8] uppercase tracking-wider">{title}</span>
        <span className="text-[#7a7a7a] text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="pb-4 space-y-3.5">{children}</div>}
    </div>
  );
}

function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function SliderInput({
  label, min, max, value, onChange, unit = "px", step = 1,
}: {
  label: string; min: number; max: number; value: string; onChange: (v: string) => void; unit?: string; step?: number;
}) {
  const numVal = Number(value) || min;
  return (
    <PropertyField label={label}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={numVal} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-brand cursor-pointer" />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-14 h-8 px-2 rounded-lg border border-white/10 bg-white/[0.04] text-[12px] text-white text-center tabular-nums" />
        {unit && <span className="text-[11px] text-[#7a7a7a]">{unit}</span>}
      </div>
    </PropertyField>
  );
}

export function PreheaderPropertiesPanel({
  block,
  onUpdate,
  onDelete,
  ColorPicker,
}: {
  block: EmailBlock;
  onUpdate: (b: EmailBlock) => void;
  onDelete: () => void;
  ColorPicker: React.ComponentType<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    allowTransparent?: boolean;
  }>;
}) {
  const c = block.content;
  const s = block.styles;
  const text = c.text || "";
  const len = text.length;

  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...c, [key]: val } });
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...s, [key]: val } });

  const previews = useMemo(
    () =>
      CLIENT_PREVIEWS.map((client) => ({
        ...client,
        preview: text.length > client.limit ? `${text.slice(0, client.limit)}…` : text,
      })),
    [text],
  );

  const showBodyStyles = s.hideInBody === "false";

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Pre-header</h4>
        <button type="button" onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400" />
        </button>
      </div>

      <CollapsibleSection title="Content">
        <PropertyField label="Pre-header text">
          <textarea
            value={text}
            onChange={(e) => {
              const val = e.target.value;
              setContent("text", val.slice(0, 100));
            }}
            maxLength={100}
            rows={4}
            placeholder="Summarize your email in 50–100 characters…"
            className="w-full min-h-[96px] px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-[14px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 resize-y overflow-y-auto custom-scrollbar"
          />
        </PropertyField>
        <div className="flex items-center justify-between text-[12px] mt-1">
          <span className="text-[#7a7a7a]">Character count</span>
          <span className="font-semibold tabular-nums" style={{ color: charCountColor(len) }}>
            {len}/100 <span className="font-normal text-[#7a7a7a]">(recommended 50–100)</span>
          </span>
        </div>
        {len >= 100 && (
          <div className="text-[11px] text-red-400 font-medium mt-1.5 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
            <span>⚠</span> Maximum limit of 100 characters reached
          </div>
        )}
        <PropertyField label="Inbox preview simulation">
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            {previews.map((p) => (
              <div key={p.name}>
                <div className="text-[10px] text-[#7a7a7a] uppercase tracking-wider mb-0.5">{p.name} (~{p.limit} chars)</div>
                <div className="text-[12px] text-[#d1d5db] leading-snug">{p.preview || "—"}</div>
              </div>
            ))}
          </div>
        </PropertyField>
      </CollapsibleSection>

      <CollapsibleSection title="Visibility">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => setStyle("hideInBody", s.hideInBody !== "false" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center cursor-pointer shrink-0 ${
              s.hideInBody !== "false" ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04]"
            }`}
          >
            {s.hideInBody !== "false" && <span className="text-white text-[10px]">✓</span>}
          </div>
          <span className="text-[12px] text-[#a8a8a8] group-hover:text-white">Hide in email body (inbox preview only)</span>
        </label>
        <PropertyField label="Mobile visibility">
          <select
            value={s.mobileVisibility || "auto"}
            onChange={(e) => setStyle("mobileVisibility", e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none cursor-pointer"
          >
            <option value="auto" className="bg-[#1a1a1a]">Auto</option>
            <option value="show" className="bg-[#1a1a1a]">Show</option>
            <option value="hide" className="bg-[#1a1a1a]">Hide</option>
          </select>
        </PropertyField>
      </CollapsibleSection>

      {showBodyStyles && (
        <CollapsibleSection title="Style">
          <SliderInput label="Font size" min={10} max={14} value={s.fontSize || "12"} onChange={(v) => setStyle("fontSize", v)} />
        </CollapsibleSection>
      )}
    </div>
  );
}
