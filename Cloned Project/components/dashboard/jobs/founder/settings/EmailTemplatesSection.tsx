"use client";

// A18 · Email templates — the wording of every automatic candidate email.
// Jobs pick a template by kind (application received, rejection…); custom
// templates are used by stage auto-actions and knockout rules.

import React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { newId } from "../../constants";
import { Button, Card, Chip, Modal, TextInput, useConfirm } from "../../ui";
import type { EmailTemplate, EmailTemplateKind } from "../../types";
import { SaveBar, SectionHeading, errorMessage, useDraft, type SectionProps } from "./shared";

const KIND_LABELS: Record<EmailTemplateKind, string> = {
  application_received: "Application received",
  moved_to_interview: "Moved to interview",
  interview_invite: "Interview invite",
  rejection: "Rejection",
  offer: "Offer",
  custom: "Custom",
};

const PLACEHOLDERS: Array<{ key: string; hint: string }> = [
  { key: "{{candidate_name}}", hint: "Candidate's name" },
  { key: "{{job_title}}", hint: "Role title" },
  { key: "{{company}}", hint: "Your office name" },
  { key: "{{interview_details}}", hint: "Time, link and interviewers (interview emails)" },
  { key: "{{offer_link}}", hint: "Where to review the offer (offer emails)" },
];

const MAX_TEMPLATES = 50;

export default function EmailTemplatesSection({ data, onSaved, onDirtyChange }: SectionProps) {
  const baseline = data.settings.emailTemplates;
  const { draft, setDraft, dirty, reset } = useDraft<EmailTemplate[]>(baseline, onDirtyChange);
  const [editing, setEditing] = React.useState<{ template: EmailTemplate; isNew: boolean } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const remove = async (t: EmailTemplate) => {
    const othersOfKind = draft.filter((x) => x.kind === t.kind && x.id !== t.id).length;
    const message =
      t.kind === "custom"
        ? "Any stage auto-action or knockout rule that sends this template will stop sending it."
        : othersOfKind === 0
          ? `This is your only “${KIND_LABELS[t.kind]}” template. Without it, candidates get Garage's built-in wording for these emails.`
          : "The template will be removed.";
    if (await confirm({ title: `Delete “${t.name}”?`, message })) {
      setDraft((d) => d.filter((x) => x.id !== t.id));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await jobsApi.saveEmailTemplates(
        draft.map((t) => ({ ...t, name: t.name.trim(), subject: t.subject.trim() }))
      );
      onSaved(res.settings);
      toast.success("Email templates saved");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the templates."));
    } finally {
      setSaving(false);
    }
  };

  const problem = draft.find((t) => !t.name.trim() || !t.subject.trim() || !t.body.trim())
    ? "Every template needs a name, subject and body."
    : null;

  return (
    <div>
      <SectionHeading
        title="Email templates"
        description="The wording of the emails candidates receive. Jobs choose which ones send automatically."
        action={
          <Button
            variant="secondary"
            disabled={draft.length >= MAX_TEMPLATES}
            onClick={() =>
              setEditing({
                isNew: true,
                template: { id: newId("tpl_"), name: "", kind: "custom", subject: "", body: "" },
              })
            }
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      {draft.length ? (
        <Card className="overflow-hidden">
          {draft.map((t) => (
            <div key={t.id} className="flex items-center gap-4 border-t border-[#1f1f24] px-5 py-3.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">{t.name || "Untitled template"}</span>
                  <Chip>{KIND_LABELS[t.kind]}</Chip>
                </div>
                <div className="mt-0.5 truncate text-xs text-[#7c7d94]">{t.subject || "No subject"}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditing({ isNew: false, template: t })}
                className="rounded-lg p-1.5 text-[#7c7d94] transition-colors hover:bg-[#1f1f28] hover:text-white"
                aria-label={`Edit ${t.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(t)}
                className="rounded-lg p-1.5 text-[#7c7d94] transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171]"
                aria-label={`Delete ${t.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="px-5 py-8 text-center text-sm text-[#7c7d94]">
          No templates. Candidates get Garage&rsquo;s built-in wording until you add one.
        </Card>
      )}

      <Card className="mt-5 p-5">
        <div className="mb-2 text-sm font-medium text-white">Placeholders</div>
        <p className="mb-3 text-xs text-[#7c7d94]">Replaced with the real details when each email is sent.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PLACEHOLDERS.map((p) => (
            <li key={p.key} className="flex items-baseline gap-2 text-xs">
              <code className="rounded bg-[#1f1f28] px-1.5 py-0.5 text-[#c7c7da]">{p.key}</code>
              <span className="text-[#7c7d94]">{p.hint}</span>
            </li>
          ))}
        </ul>
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} problem={problem} />

      <TemplateEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onDone={(t, isNew) => {
          setDraft((d) => (isNew ? [...d, t] : d.map((x) => (x.id === t.id ? t : x))));
          setEditing(null);
        }}
      />
      {confirmDialog}
    </div>
  );
}

function TemplateEditor({
  editing,
  onClose,
  onDone,
}: {
  editing: { template: EmailTemplate; isNew: boolean } | null;
  onClose: () => void;
  onDone: (t: EmailTemplate, isNew: boolean) => void;
}) {
  const [t, setT] = React.useState<EmailTemplate | null>(editing?.template || null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setT(editing?.template || null);
  }, [editing]);

  const insert = (key: string) => {
    if (!t) return;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? t.body.length;
    const end = el?.selectionEnd ?? t.body.length;
    const body = `${t.body.slice(0, start)}${key}${t.body.slice(end)}`.slice(0, 20000);
    setT({ ...t, body });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + key.length, start + key.length);
    });
  };

  const valid = !!t && !!t.name.trim() && !!t.subject.trim() && !!t.body.trim();

  return (
    <Modal
      open={!!editing && !!t}
      onClose={onClose}
      title={editing?.isNew ? "New email template" : "Edit email template"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => t && editing && onDone(t, editing.isNew)}>
            {editing?.isNew ? "Add template" : "Done"}
          </Button>
        </>
      }
    >
      {t && (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <TextInput
              label="Name"
              required
              value={t.name}
              maxLength={120}
              placeholder="e.g. Portfolio review invite"
              onChange={(e) => setT({ ...t, name: e.target.value })}
            />
            <div className="pb-2.5">
              <Chip>{KIND_LABELS[t.kind]}</Chip>
            </div>
          </div>
          <TextInput
            label="Subject"
            required
            value={t.subject}
            maxLength={300}
            onChange={(e) => setT({ ...t, subject: e.target.value })}
          />
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Body <span className="ml-1 text-[#f87171]">*</span>
              </label>
              <span className="text-[11px] text-zinc-500">{t.body.length} / 20000</span>
            </div>
            <textarea
              ref={bodyRef}
              rows={12}
              value={t.body}
              maxLength={20000}
              onChange={(e) => setT({ ...t, body: e.target.value })}
              className="w-full resize-y rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm leading-6 text-white placeholder:text-zinc-600 outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#61627a]">Insert:</span>
              {PLACEHOLDERS.map((p) => (
                <Chip key={p.key} onClick={() => insert(p.key)}>
                  {p.key}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
