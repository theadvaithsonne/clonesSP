"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/coverfi/communication-api";
import {
  TEMPLATE_TRIGGER_PRESETS,
  type EmailTemplate,
} from "@/lib/coverfi/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function extractVars(html: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) found.add(m[1]);
  return Array.from(found).sort();
}

export default function TemplateEditor({ id }: { id: string }) {
  const router = useRouter();
  const [tpl, setTpl] = useState<EmailTemplate | null>(null);
  const [trigger, setTrigger] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    getTemplate(id)
      .then((t) => {
        setTpl(t);
        setTrigger(t.trigger_event_name);
        setSubject(t.email_subject);
        setContent(t.email_content);
        setIsActive(t.is_active);
      })
      .catch((e) => toast.error(e?.message || "Failed to load"));
  }, [id]);

  const liveVars = useMemo(
    () => extractVars(`${subject} ${content}`),
    [subject, content],
  );

  async function onSave() {
    if (!trigger || !subject || !content) {
      toast.error("Trigger, subject, and content are required");
      return;
    }
    setSaving(true);
    try {
      await updateTemplate(id, {
        trigger_event_name: trigger,
        email_subject: subject,
        email_content: content,
        is_active: isActive,
      });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      router.push("/coverfi/communication/templates");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  if (!tpl) {
    return <div className="p-8 text-[#9fa0b8]">Loading…</div>;
  }

  const presetMissing = !TEMPLATE_TRIGGER_PRESETS.includes(
    trigger as (typeof TEMPLATE_TRIGGER_PRESETS)[number],
  );

  return (
    <div className="p-8 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/coverfi/communication/templates"
          className="inline-flex items-center text-sm text-[#9fa0b8] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to templates
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            <Eye className="h-4 w-4 mr-1" />
            {previewOpen ? "Hide preview" : "Preview"}
          </Button>
          <Button variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">
            Trigger event name
          </Label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {TEMPLATE_TRIGGER_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTrigger(p)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-mono transition-colors",
                  trigger === p
                    ? "bg-brand/20 border-brand/50 text-white"
                    : "bg-[#15151b] border-[#2a2a3a] text-[#9fa0b8] hover:text-white",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="font-mono text-sm"
            placeholder="welcome"
          />
          {presetMissing && trigger && (
            <p className="text-[11px] text-[#9fa0b8]">
              Custom trigger — not one of the presets.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">Active</Label>
          <div className="flex items-center gap-2 pt-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm text-[#9fa0b8]">
              {isActive
                ? "Will send when this trigger fires"
                : "Disabled — Coverfi will skip this template"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">Subject</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Welcome {{firstName}}"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">Content</Label>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Type the email body. Use {{variableName}} for placeholders."
          minHeight="280px"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">
          Variables detected ({liveVars.length})
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {liveVars.length === 0 ? (
            <span className="text-xs text-[#9fa0b8] italic">
              None yet — use{" "}
              <code className="font-mono">{"{{firstName}}"}</code> style
              tokens in the subject or content.
            </span>
          ) : (
            liveVars.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono text-[11px]">
                {`{{${v}}}`}
              </Badge>
            ))
          )}
        </div>
      </div>

      {previewOpen && (
        <div className="rounded-lg border border-[#222230] bg-white text-black p-6">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
            Preview
          </div>
          <div className="font-semibold text-lg mb-4">{subject}</div>
          <div
            className="prose prose-sm max-w-none"
            // Coverfi-trusted HTML — we author it here, so dangerouslySetInnerHTML is fine in v1.
            // Future external rendering paths must sanitize.
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      )}
    </div>
  );
}
