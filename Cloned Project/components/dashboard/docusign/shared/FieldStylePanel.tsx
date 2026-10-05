"use client";

import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DsField } from "@/lib/docusign/types";
import {
  COLOR_PRESETS,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_PRESETS,
  clampFontSize,
  isSignatureLike,
  supportsFontControls,
} from "@/components/dashboard/docusign/shared/fieldStyle";

export interface FieldStylePatch {
  color?: string | undefined;
  // In PDF points. undefined clears the field's own size, putting it back on DEFAULT_FONT_SIZE.
  fontSize?: number | undefined;
  required?: boolean;
  // Reassign the field to another recipient (index into the recipients list).
  recipientIndex?: number;
}

interface FieldStylePanelProps {
  type: DsField["type"];
  typeLabel: string;
  recipientName?: string;
  recipientColor?: string;
  // Everyone a field can be assigned to, and who this one is assigned to now. Omit to hide "Assigned to".
  recipients?: Array<{ label: string; color: string }>;
  assignedIndex?: number;
  color?: string;
  // Absent = this field has no size of its own and is drawn at DEFAULT_FONT_SIZE.
  fontSize?: number;
  required: boolean;
  onChange: (patch: FieldStylePatch) => void;
  onDelete: () => void;
}

// Shown in the editor's right column while a placed field is selected. Text-like fields and
// signature/initials get a colour and a text size, both of which follow the field through to the
// signer's view and the final flattened PDF; every field can be marked required or removed.
export function FieldStylePanel({
  type,
  typeLabel,
  recipientName,
  recipientColor,
  recipients,
  assignedIndex,
  color,
  fontSize,
  required,
  onChange,
  onDelete,
}: FieldStylePanelProps) {
  const hasStyle = color !== undefined || fontSize !== undefined;
  const hasFontControls = supportsFontControls(type);
  // What the control displays: this field's own size, or the default it is currently drawn at.
  const shownSize = fontSize ?? DEFAULT_FONT_SIZE;

  return (
    <div className="mb-6 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/90">{typeLabel} field</p>
          {recipientName && (
            <p className="flex items-center gap-1.5 truncate text-xs text-[#7a7a90]">
              {recipientColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: recipientColor }} />}
              {recipientName}
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete field" className="h-7 w-7 shrink-0">
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>

      {recipients && recipients.length > 1 && assignedIndex !== undefined && (
        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-[#8a8a9b]">Assigned to</Label>
          <Select value={String(assignedIndex)} onValueChange={(v) => onChange({ recipientIndex: Number(v) })}>
            <SelectTrigger className="h-8 text-xs" aria-label="Assigned to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recipients.map((r, i) => (
                <SelectItem key={i} value={String(i)}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasFontControls && (
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs text-[#8a8a9b]">
              {isSignatureLike(type) ? "Signature size" : "Text size"}
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Decrease text size"
                disabled={shownSize <= FONT_SIZE_MIN}
                onClick={() => onChange({ fontSize: clampFontSize(shownSize - 1) })}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              {/* Committed on change, not on every keystroke, so a half-typed "1" on the way to "16"
                  never briefly redraws the field at 1pt (and never sends a value the backend drops). */}
              <input
                type="number"
                inputMode="numeric"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={shownSize}
                aria-label="Text size in points"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next) && next >= FONT_SIZE_MIN && next <= FONT_SIZE_MAX) {
                    onChange({ fontSize: clampFontSize(next) });
                  }
                }}
                onBlur={(e) => onChange({ fontSize: clampFontSize(Number(e.target.value) || DEFAULT_FONT_SIZE) })}
                className="h-8 w-14 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2 text-center text-xs text-white/85 focus:border-[#3b3b4a] focus:outline-none"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Increase text size"
                disabled={shownSize >= FONT_SIZE_MAX}
                onClick={() => onChange({ fontSize: clampFontSize(shownSize + 1) })}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-[#7a7a90]">pt</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {FONT_SIZE_PRESETS.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onChange({ fontSize: pt })}
                  className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums transition-colors ${
                    shownSize === pt ? "bg-brand font-medium text-[#141414]" : "bg-[#2a2a35] text-[#8a8a9b] hover:text-white/90"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-[#8a8a9b]">{isSignatureLike(type) ? "Colour" : "Text colour"}</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => onChange({ color: c })}
                  className={`h-6 w-6 rounded-full border ${
                    (color ?? "#000000").toLowerCase() === c ? "ring-2 ring-white ring-offset-1 ring-offset-[#111116]" : "border-white/20"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-white/20" title="Custom colour">
                <span
                  className="absolute inset-0"
                  style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
                />
                <input
                  type="color"
                  value={color ?? "#000000"}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Custom colour"
                />
              </label>
            </div>
          </div>

          {isSignatureLike(type) && (
            <p className="text-[11px] leading-snug text-[#7a7a90]">
              Size and colour apply to typed and drawn signatures. An uploaded image is kept as it is.
            </p>
          )}

          {hasStyle && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-[#8a8a9b]" onClick={() => onChange({ color: undefined, fontSize: undefined })}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset to default
            </Button>
          )}
        </div>
      )}

      {/* <div className={`flex items-center gap-2 ${hasFontControls ? "mt-3 border-t border-[#2a2a35] pt-3" : ""}`}>
        <Checkbox id="field-required" checked={required} onCheckedChange={(v) => onChange({ required: !!v })} />
        <Label htmlFor="field-required" className="text-xs text-[#8a8a9b]">
          Required
        </Label>
      </div> */}
      {/* <p className="mt-3 text-[11px] leading-snug text-[#7a7a90]">Drag to move, drag the corner to resize, arrow keys to nudge.</p> */}
    </div>
  );
}
