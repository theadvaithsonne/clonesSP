"use client";

// A5/A6 · Step 3 — Application form builder.
//
//   left    field library (click to add to the selected page)
//   centre  the pages and their fields; drag to reorder within a page
//   right   inspector: Field (label, help, required, options, files),
//           Logic (knockout rule, conditional display), Scoring (quiz)
//
// The whole form is sent as one `form.pages` array on every save.

import React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  Eye,
  GripVertical,
  LayoutTemplate,
  Lock,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import {
  CHOICE_TYPES,
  FIELD_GROUPS,
  FIELD_LABELS,
  FILE_TYPES,
  FORM_TEMPLATES,
  LAYOUT_TYPES,
  makeField,
  newId,
} from "../../constants";
import {
  Button,
  Checkbox,
  Chip,
  CustomSelect,
  GOLD,
  Label,
  Modal,
  SwitchControl,
  TextArea,
  TextInput,
  UnderlineTabs,
  useConfirm,
  useLoad,
  errorMessage,
} from "../../ui";
import FormRenderer, { type AnswerMap } from "../../shared/FormRenderer";
import type { FieldCondition, FormField, FormPage, JobFieldType, Knockout } from "../../types";
import type { StepProps } from "./JobWizard";
import { StepHeading } from "./StepBasics";

type Selection = { pageId: string; fieldId: string | null };

function fieldMeta(f: FormField): string {
  const bits = [FIELD_LABELS[f.type] || f.type];
  if (f.locked) bits.push("Locked");
  else if (f.required) bits.push("Required");
  else if (!LAYOUT_TYPES.includes(f.type)) bits.push("Optional");
  if (f.knockout?.enabled) bits.push("Knockout");
  if (f.condition?.fieldId) bits.push("Conditional");
  if (f.type === "quiz_mcq") bits.push(f.correctOptionId ? "Scored" : "No answer set");
  if (FILE_TYPES.includes(f.type) && f.fileTypes.length) bits.push(f.fileTypes.map((t) => t.toUpperCase()).join(" / "));
  return bits.join(" · ");
}

export default function StepForm({ job, detail, update }: StepProps) {
  const pages = job.form.pages;
  const [sel, setSel] = React.useState<Selection>(() => ({ pageId: pages[0]?.id || "", fieldId: null }));
  const [inspectorTab, setInspectorTab] = React.useState<"field" | "logic" | "scoring">("field");
  const [search, setSearch] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const settings = useLoad(() => jobsApi.getSettings(), []);

  const setPages = (next: FormPage[]) => update({ form: { pages: next } });
  const allFields = pages.flatMap((p) => p.fields);
  const selectedPage = pages.find((p) => p.id === sel.pageId) || pages[0];
  const selectedField = selectedPage?.fields.find((f) => f.id === sel.fieldId) || null;

  React.useEffect(() => {
    if (!pages.find((p) => p.id === sel.pageId) && pages[0]) setSel({ pageId: pages[0].id, fieldId: null });
  }, [pages, sel.pageId]);

  const consent = `I consent to ${detail.org.name} processing my application data for recruitment purposes.`;

  const patchField = (fieldId: string, patch: Partial<FormField>) =>
    setPages(pages.map((p) => ({ ...p, fields: p.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) })));

  const patchPage = (pageId: string, patch: Partial<FormPage>) =>
    setPages(pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)));

  const addField = (type: JobFieldType) => {
    const field = makeField(type);
    if (!pages.length) {
      const page: FormPage = { id: newId("pg_"), title: "Page 1", fields: [field] };
      setPages([page]);
      setSel({ pageId: page.id, fieldId: field.id });
      return;
    }
    const target = selectedPage || pages[0];
    const idx = sel.fieldId ? target.fields.findIndex((f) => f.id === sel.fieldId) + 1 : target.fields.length;
    const fields = [...target.fields];
    fields.splice(idx, 0, field);
    patchPage(target.id, { fields });
    setSel({ pageId: target.id, fieldId: field.id });
    setInspectorTab("field");
  };

  const addPage = () => {
    const page: FormPage = { id: newId("pg_"), title: `Page ${pages.length + 1}`, fields: [] };
    setPages([...pages, page]);
    setSel({ pageId: page.id, fieldId: null });
  };

  const removeField = (fieldId: string) => {
    const dependants = allFields.filter((f) => f.condition?.fieldId === fieldId);
    setPages(
      pages.map((p) => ({
        ...p,
        fields: p.fields
          .filter((f) => f.id !== fieldId)
          .map((f) => (f.condition?.fieldId === fieldId ? { ...f, condition: null } : f)),
      }))
    );
    setSel((s) => ({ ...s, fieldId: null }));
    if (dependants.length) toast.message(`Removed the condition on ${dependants.length} field(s) that depended on it.`);
  };

  const duplicateField = (fieldId: string) => {
    const page = pages.find((p) => p.fields.some((f) => f.id === fieldId));
    if (!page) return;
    const i = page.fields.findIndex((f) => f.id === fieldId);
    const src = page.fields[i];
    const copy: FormField = {
      ...src,
      id: newId("fld_"),
      locked: false,
      options: src.options.map((o) => ({ ...o, id: newId("opt_") })),
      correctOptionId: undefined,
    };
    if (src.correctOptionId) {
      const idx = src.options.findIndex((o) => o.id === src.correctOptionId);
      copy.correctOptionId = idx >= 0 ? copy.options[idx].id : undefined;
    }
    const fields = [...page.fields];
    fields.splice(i + 1, 0, copy);
    patchPage(page.id, { fields });
    setSel({ pageId: page.id, fieldId: copy.id });
  };

  const removePage = async (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    if (page.fields.some((f) => f.locked)) {
      toast.error("This page holds the required consent declaration — move it first.");
      return;
    }
    if (page.fields.length && !(await confirm({ title: `Delete “${page.title}”?`, message: `Its ${page.fields.length} field(s) will be removed.` }))) return;
    setPages(pages.filter((p) => p.id !== pageId));
  };

  const moveFieldToPage = (fieldId: string, toPageId: string) => {
    const field = allFields.find((f) => f.id === fieldId);
    if (!field) return;
    setPages(
      pages.map((p) =>
        p.id === toPageId
          ? { ...p, fields: [...p.fields.filter((f) => f.id !== fieldId), field] }
          : { ...p, fields: p.fields.filter((f) => f.id !== fieldId) }
      )
    );
    setSel({ pageId: toPageId, fieldId });
  };

  const applyTemplate = async (build: FormPage[]) => {
    if (allFields.length && !(await confirm({ title: "Replace the current form?", message: "Your current pages and fields will be replaced.", confirmLabel: "Replace", destructive: false }))) {
      return;
    }
    setPages(build);
    setSel({ pageId: build[0]?.id || "", fieldId: null });
    setTemplatesOpen(false);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (pageId: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const from = page.fields.findIndex((f) => f.id === active.id);
    const to = page.fields.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    patchPage(pageId, { fields: arrayMove(page.fields, from, to) });
  };

  const answerable = allFields.filter((f) => !LAYOUT_TYPES.includes(f.type)).length;
  const minutes = Math.max(
    1,
    Math.round(pages.reduce((s, p) => s + (p.timeLimitMinutes || 0) + p.fields.length * 0.6, 0))
  );
  const q = search.trim().toLowerCase();

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-8 pt-6">
        <StepHeading
          step={3}
          title="Application form"
          subtitle={`Build the candidate journey for ${job.title || "this role"} · ${detail.org.name}`}
          right={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplate className="h-4 w-4" /> Templates & saved forms
              </Button>
              <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!answerable}>
                <Eye className="h-4 w-4" /> Preview as candidate
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 px-8 pb-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Field library */}
        <aside className="rounded-2xl border border-[#262626] bg-[#141414] p-3 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
          <div className="mb-2 px-1 text-sm font-semibold text-white">Add fields</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields"
            className="mb-3 w-full rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-brand"
          />
          {FIELD_GROUPS.map((g) => {
            const types = g.types.filter((t) => !q || t.label.toLowerCase().includes(q));
            if (!types.length) return null;
            return (
              <div key={g.title} className="mb-3">
                <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#61627a]">{g.title}</div>
                <div className="grid grid-cols-1 gap-1">
                  {types.map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => addField(t.type)}
                      className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs text-[#c7c7da] transition-colors hover:border-[#262626] hover:bg-[#1A1A1A] hover:text-white"
                    >
                      <Plus className="h-3 w-3 text-[#61627a]" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Canvas */}
        <section className="min-w-0 space-y-4 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            {pages.map((p, i) => (
              <Chip key={p.id} active={p.id === selectedPage?.id} onClick={() => setSel({ pageId: p.id, fieldId: null })}>
                {i + 1} {p.title || "Untitled"}
              </Chip>
            ))}
            <Chip onClick={addPage}>
              <Plus className="h-3 w-3" /> Page
            </Chip>
          </div>

          {!allFields.length ? (
            <div className="rounded-2xl border border-dashed border-[#262626] px-6 py-10 text-center">
              <p className="text-sm text-white">Add a field from the library, or start from a template</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {FORM_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.build(consent))}
                    className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 text-left transition-colors hover:border-[#3a3a48]"
                  >
                    <div className="text-sm font-medium text-white">{t.name}</div>
                    <div className="text-xs text-[#7c7d94]">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            pages.map((p, pi) => (
              <div
                key={p.id}
                onClick={() => setSel((s) => (s.pageId === p.id ? s : { pageId: p.id, fieldId: null }))}
                className="rounded-2xl border bg-[#141414] p-4 transition-colors"
                style={{ borderColor: p.id === selectedPage?.id ? "color-mix(in srgb, var(--brand) 55%, #262626)" : "#262626" }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1f1f28] text-[11px] font-semibold text-[#c7c7da]">
                      {pi + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white">{p.title || "Untitled page"}</div>
                      <div className="text-xs text-[#7c7d94]">
                        {[p.description, p.timeLimitMinutes ? `${p.timeLimitMinutes} min timed` : "", p.passMark ? `Pass ${p.passMark}` : ""]
                          .filter(Boolean)
                          .join(" · ") || `${p.fields.length} field${p.fields.length === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(p.id);
                    }}
                    className="rounded-lg p-1.5 text-[#61627a] hover:bg-[#1f1f28] hover:text-[#f87171]"
                    aria-label="Delete page"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {p.fields.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#262626] px-4 py-5 text-center text-xs text-[#61627a]">
                    Select this page, then pick a field from the library.
                  </p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(p.id)}>
                    <SortableContext items={p.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {p.fields.map((f) => (
                          <SortableField
                            key={f.id}
                            field={f}
                            selected={sel.fieldId === f.id}
                            onSelect={() => {
                              setSel({ pageId: p.id, fieldId: f.id });
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            ))
          )}
        </section>

        {/* Inspector */}
        <aside className="rounded-2xl border border-[#262626] bg-[#141414] lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
          <div className="border-b border-[#1f1f24] px-4 pt-3">
            <UnderlineTabs<"field" | "logic" | "scoring">
              value={inspectorTab}
              onChange={setInspectorTab}
              tabs={[
                { value: "field", label: "Field" },
                { value: "logic", label: "Logic" },
                { value: "scoring", label: "Scoring" },
              ]}
            />
          </div>
          <div className="space-y-4 p-4">
            {!selectedField ? (
              selectedPage ? (
                <PageInspector page={selectedPage} onChange={(patch) => patchPage(selectedPage.id, patch)} tab={inspectorTab} />
              ) : (
                <p className="text-sm text-[#7c7d94]">Add a page to start.</p>
              )
            ) : inspectorTab === "field" ? (
              <FieldInspector
                field={selectedField}
                pages={pages}
                currentPageId={selectedPage!.id}
                onChange={(patch) => patchField(selectedField.id, patch)}
                onRemove={() => removeField(selectedField.id)}
                onDuplicate={() => duplicateField(selectedField.id)}
                onMove={(toPage) => moveFieldToPage(selectedField.id, toPage)}
              />
            ) : inspectorTab === "logic" ? (
              <LogicInspector
                field={selectedField}
                allFields={allFields}
                reasons={settings.data?.settings.rejectionReasons || []}
                templates={(settings.data?.settings.emailTemplates || []).filter((t) => t.kind === "rejection" || t.kind === "custom")}
                onChange={(patch) => patchField(selectedField.id, patch)}
              />
            ) : (
              <ScoringInspector field={selectedField} page={selectedPage!} onChange={(patch) => patchField(selectedField.id, patch)} onPage={(patch) => patchPage(selectedPage!.id, patch)} />
            )}
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#1c1c24] bg-[#0c0c0e] px-8 py-3 text-xs text-[#7c7d94]">
        <span>
          {pages.length} page{pages.length === 1 ? "" : "s"} · {answerable} field{answerable === 1 ? "" : "s"} · ~{minutes} min to complete
        </span>
        <Button variant="secondary" onClick={() => setSaveOpen(true)} disabled={!answerable}>
          <Save className="h-4 w-4" /> Save as reusable form
        </Button>
      </div>

      <CandidatePreview open={previewOpen} onClose={() => setPreviewOpen(false)} pages={pages} title={job.title} orgName={detail.org.name} />
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        consent={consent}
        saved={settings.data?.settings.savedForms || []}
        onApply={applyTemplate}
        onDeleted={() => settings.reload(true)}
      />
      <SaveFormModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        defaultName={job.title ? `${job.title} form` : "Application form"}
        pages={pages}
        onSaved={() => settings.reload(true)}
      />
      {confirmDialog}
    </div>
  );
}

function SortableField({ field, selected, onSelect }: { field: FormField; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        borderColor: selected ? GOLD : "#262626",
        background: selected ? "color-mix(in srgb, var(--brand) 6%, #1A1A1A)" : "#1A1A1A",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-[#4f5065] hover:text-[#c7c7da]" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm text-white">
          {field.locked && <Lock className="h-3 w-3 text-[#7c7d94]" />}
          {field.label || <span className="text-[#61627a]">Untitled question</span>}
          {field.required && <span className="text-[#f87171]">*</span>}
        </div>
        <div className="truncate text-[11px] text-[#7c7d94]">{fieldMeta(field)}</div>
      </div>
    </div>
  );
}

function PageInspector({ page, onChange, tab }: { page: FormPage; onChange: (p: Partial<FormPage>) => void; tab: string }) {
  return (
    <>
      <div className="text-sm font-semibold text-white">Page settings</div>
      {tab === "scoring" ? (
        <>
          <TextInput
            label="Time limit (minutes)"
            hint="Makes this a timed section"
            type="number"
            min={1}
            max={600}
            value={page.timeLimitMinutes ?? ""}
            onChange={(e) => onChange({ timeLimitMinutes: e.target.value ? Number(e.target.value) : null })}
          />
          <TextInput
            label="Pass mark"
            hint="Correct quiz answers needed"
            type="number"
            min={0}
            value={page.passMark ?? ""}
            onChange={(e) => onChange({ passMark: e.target.value ? Number(e.target.value) : null })}
          />
        </>
      ) : (
        <>
          <TextInput label="Page title" value={page.title} maxLength={200} onChange={(e) => onChange({ title: e.target.value })} />
          <TextInput
            label="Description"
            value={page.description || ""}
            maxLength={500}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <p className="text-xs text-[#61627a]">Select a field on the canvas to edit it.</p>
        </>
      )}
    </>
  );
}

function FieldInspector({
  field,
  pages,
  currentPageId,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  field: FormField;
  pages: FormPage[];
  currentPageId: string;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (pageId: string) => void;
}) {
  const isLayout = LAYOUT_TYPES.includes(field.type);
  const isChoice = CHOICE_TYPES.includes(field.type);
  const isFile = FILE_TYPES.includes(field.type);
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">{FIELD_LABELS[field.type]}</div>
        <div className="flex gap-1">
          <button type="button" onClick={onDuplicate} className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white" aria-label="Duplicate">
            <Copy className="h-4 w-4" />
          </button>
          {!field.locked && (
            <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-[#f87171]" aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {field.locked ? (
        <p className="rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-xs text-[#7c7d94]">
          The minimum consent clause is locked. Add your own wording in Settings → Data & privacy.
        </p>
      ) : (
        <TextArea
          label={isLayout ? "Text" : "Question"}
          rows={2}
          value={field.label}
          maxLength={500}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      )}
      {!isLayout && !field.locked && (
        <>
          <TextInput label="Help text" value={field.helpText || ""} maxLength={1000} onChange={(e) => onChange({ helpText: e.target.value })} />
          <div className="flex items-center justify-between text-sm text-white">
            Required
            <SwitchControl checked={field.required} onChange={(v) => onChange({ required: v })} aria-label="Required" />
          </div>
        </>
      )}
      {field.type === "declaration" && !field.locked && (
        <div className="flex items-center justify-between gap-3 text-sm text-white">
          <span>
            Talent pool opt-in
            <span className="block text-xs text-[#7c7d94]">Ticking it keeps the candidate in your talent pool.</span>
          </span>
          <SwitchControl checked={field.talentPoolConsent} onChange={(v) => onChange({ talentPoolConsent: v })} aria-label="Talent pool opt-in" />
        </div>
      )}
      {isChoice && <OptionsEditor field={field} onChange={onChange} />}
      {field.type === "rating" && (
        <TextInput
          label="Scale (1 to…)"
          type="number"
          min={2}
          max={10}
          value={field.scaleMax ?? 5}
          onChange={(e) => onChange({ scaleMax: Math.max(2, Math.min(10, Number(e.target.value) || 5)) })}
        />
      )}
      {field.type === "long_text" && (
        <TextInput
          label="Character limit"
          type="number"
          min={1}
          value={field.maxLength ?? ""}
          onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
        />
      )}
      {isFile && (
        <div className="space-y-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3">
          <Label>Allowed file types</Label>
          <div className="grid grid-cols-3 gap-2">
            {(field.type === "video_answer" ? ["mp4", "mov", "webm"] : ["pdf", "docx", "doc", "png", "jpg", "zip"]).map((t) => (
              <Checkbox
                key={t}
                checked={field.fileTypes.includes(t)}
                label={t.toUpperCase()}
                onChange={(on) => onChange({ fileTypes: on ? [...field.fileTypes, t] : field.fileTypes.filter((x) => x !== t) })}
              />
            ))}
          </div>
          <TextInput
            label="Maximum file size (MB)"
            type="number"
            min={1}
            max={100}
            value={field.maxSizeMb ?? ""}
            onChange={(e) => onChange({ maxSizeMb: e.target.value ? Math.min(100, Number(e.target.value)) : undefined })}
          />
          <div className="flex gap-2">
            <Chip active={!field.multiple} onClick={() => onChange({ multiple: false })}>
              One file
            </Chip>
            <Chip active={field.multiple} onClick={() => onChange({ multiple: true })}>
              Multiple files
            </Chip>
          </div>
        </div>
      )}
      {pages.length > 1 && (
        <CustomSelect
          label="Page"
          value={currentPageId}
          onChange={(v) => v !== currentPageId && onMove(v)}
          options={pages.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.title || "Untitled"}` }))}
        />
      )}
    </>
  );
}

function OptionsEditor({ field, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  return (
    <div className="space-y-2">
      <Label>Options</Label>
      {field.options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <input
            value={o.label}
            maxLength={300}
            onChange={(e) =>
              onChange({ options: field.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })
            }
            className="flex-1 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white outline-none focus:border-brand"
            placeholder={`Option ${i + 1}`}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                options: field.options.filter((x) => x.id !== o.id),
                ...(field.correctOptionId === o.id ? { correctOptionId: undefined } : {}),
              })
            }
            className="text-[#61627a] hover:text-[#f87171]"
            aria-label="Remove option"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {field.options.length < 50 && (
        <button
          type="button"
          onClick={() => onChange({ options: [...field.options, { id: newId("opt_"), label: `Option ${field.options.length + 1}` }] })}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: GOLD }}
        >
          <Plus className="h-3.5 w-3.5" /> Add option
        </button>
      )}
    </div>
  );
}

const KNOCKOUT_TYPES: JobFieldType[] = ["yes_no", "single_choice", "dropdown", "checkboxes"];

function LogicInspector({
  field,
  allFields,
  reasons,
  templates,
  onChange,
}: {
  field: FormField;
  allFields: FormField[];
  reasons: Array<{ id: string; label: string }>;
  templates: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const ko: Knockout = field.knockout || {
    enabled: false,
    answer: "",
    moveToRejected: true,
    addReason: true,
    notifyTeam: false,
    delayEmail: true,
  };
  const setKo = (patch: Partial<Knockout>) => onChange({ knockout: { ...ko, ...patch } });
  const answerOptions =
    field.type === "yes_no"
      ? [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]
      : field.options.map((o) => ({ value: o.id, label: o.label || "Untitled option" }));

  const sources = allFields.filter((f) => f.id !== field.id && !LAYOUT_TYPES.includes(f.type) && !FILE_TYPES.includes(f.type) && f.type !== "declaration");
  const cond: FieldCondition | null = field.condition || null;
  const source = cond ? allFields.find((f) => f.id === cond.fieldId) : undefined;

  return (
    <>
      <div>
        <div className="text-sm font-semibold text-white">Knockout rule</div>
        <p className="text-xs text-[#7c7d94]">Automatically act on an answer when the candidate submits.</p>
      </div>
      {KNOCKOUT_TYPES.includes(field.type) ? (
        <div className="space-y-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3">
          <div className="flex items-center justify-between text-sm text-white">
            Enable
            <SwitchControl checked={ko.enabled} onChange={(v) => setKo({ enabled: v })} aria-label="Enable knockout" />
          </div>
          {ko.enabled && (
            <>
              <CustomSelect label="If answer is" value={ko.answer} onChange={(v) => setKo({ answer: v })} options={answerOptions} />
              <p className="text-xs text-[#c7c7da]">
                then <span style={{ color: GOLD }}>reject automatically</span>
              </p>
              <Checkbox checked={ko.moveToRejected} onChange={(v) => setKo({ moveToRejected: v })} label="Move candidate to Rejected" />
              <Checkbox checked={ko.addReason} onChange={(v) => setKo({ addReason: v })} label="Add rejection reason" />
              {ko.addReason && (
                <CustomSelect
                  label="Reason"
                  value={ko.reason || ""}
                  onChange={(v) => setKo({ reason: v })}
                  placeholder="Pick a reason"
                  options={reasons.map((r) => ({ value: r.label, label: r.label }))}
                />
              )}
              <Checkbox checked={ko.notifyTeam} onChange={(v) => setKo({ notifyTeam: v })} label="Notify hiring team" />
              <CustomSelect
                label="Rejection email template"
                value={ko.emailTemplateId || ""}
                onChange={(v) => setKo({ emailTemplateId: v || undefined })}
                placeholder="Default rejection email"
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
              />
              <div className="flex items-center justify-between gap-3 text-sm text-white">
                Delay rejection email
                <SwitchControl checked={ko.delayEmail} onChange={(v) => setKo({ delayEmail: v })} aria-label="Delay rejection email" />
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-xs text-[#7c7d94]">
          Knockout rules work on Yes / No, single choice, dropdown and checkbox questions.
        </p>
      )}

      <div className="pt-2">
        <div className="text-sm font-semibold text-white">Conditional display</div>
        <p className="text-xs text-[#7c7d94]">Control when this field appears.</p>
      </div>
      {field.locked ? (
        <p className="text-xs text-[#7c7d94]">The consent declaration always shows.</p>
      ) : (
        <div className="space-y-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3">
          <CustomSelect
            label="Show this field only if"
            value={cond?.fieldId || ""}
            onChange={(v) =>
              onChange({
                condition: v
                  ? { fieldId: v, operator: cond?.operator || "equals", value: cond?.value || "", hideUntilMet: cond?.hideUntilMet ?? true, clearIfHidden: cond?.clearIfHidden ?? true }
                  : null,
              })
            }
            placeholder="Always show"
            options={[{ value: "", label: "Always show" }, ...sources.map((f) => ({ value: f.id, label: f.label || FIELD_LABELS[f.type] }))]}
          />
          {cond && source && (
            <>
              <CustomSelect
                label="Condition"
                value={cond.operator}
                onChange={(v) => onChange({ condition: { ...cond, operator: v as FieldCondition["operator"] } })}
                options={[
                  { value: "equals", label: "is" },
                  { value: "not_equals", label: "is not" },
                  { value: "contains", label: "contains" },
                  { value: "greater_than", label: "is greater than" },
                  { value: "less_than", label: "is less than" },
                ]}
              />
              {source.options?.length ? (
                <CustomSelect
                  label="Value"
                  value={cond.value}
                  onChange={(v) => onChange({ condition: { ...cond, value: v } })}
                  options={source.options.map((o) => ({ value: o.id, label: o.label }))}
                />
              ) : source.type === "yes_no" ? (
                <CustomSelect
                  label="Value"
                  value={cond.value}
                  onChange={(v) => onChange({ condition: { ...cond, value: v } })}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              ) : (
                <TextInput label="Value" value={cond.value} maxLength={200} onChange={(e) => onChange({ condition: { ...cond, value: e.target.value } })} />
              )}
              <Checkbox checked={cond.hideUntilMet} onChange={(v) => onChange({ condition: { ...cond, hideUntilMet: v } })} label="Hide until condition is met" />
              <Checkbox checked={cond.clearIfHidden} onChange={(v) => onChange({ condition: { ...cond, clearIfHidden: v } })} label="Clear answer if hidden" />
            </>
          )}
        </div>
      )}
    </>
  );
}

function ScoringInspector({
  field,
  page,
  onChange,
  onPage,
}: {
  field: FormField;
  page: FormPage;
  onChange: (patch: Partial<FormField>) => void;
  onPage: (patch: Partial<FormPage>) => void;
}) {
  return (
    <>
      {field.type === "quiz_mcq" ? (
        <>
          <div className="text-sm font-semibold text-white">Quiz scoring</div>
          <CustomSelect
            label="Correct answer"
            value={field.correctOptionId || ""}
            onChange={(v) => onChange({ correctOptionId: v || undefined })}
            placeholder="Pick the correct option"
            options={field.options.map((o) => ({ value: o.id, label: o.label || "Untitled option" }))}
          />
          <TextInput
            label="Points"
            type="number"
            min={0}
            max={100}
            value={field.points ?? 1}
            onChange={(e) => onChange({ points: Math.max(0, Number(e.target.value) || 0) })}
          />
          <p className="text-xs text-[#61627a]">Candidates never see the correct answer.</p>
        </>
      ) : (
        <p className="text-sm text-[#7c7d94]">Only scored quiz questions have scoring. Add one from the Assessment group.</p>
      )}
      <div className="border-t border-[#262626] pt-4">
        <div className="mb-3 text-sm font-semibold text-white">This page</div>
        <div className="space-y-3">
          <TextInput
            label="Time limit (minutes)"
            type="number"
            min={1}
            value={page.timeLimitMinutes ?? ""}
            onChange={(e) => onPage({ timeLimitMinutes: e.target.value ? Number(e.target.value) : null })}
          />
          <TextInput
            label="Pass mark"
            type="number"
            min={0}
            value={page.passMark ?? ""}
            onChange={(e) => onPage({ passMark: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>
    </>
  );
}

function CandidatePreview({
  open,
  onClose,
  pages,
  title,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  pages: FormPage[];
  title: string;
  orgName: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  React.useEffect(() => {
    if (open) {
      setIndex(0);
      setAnswers({});
    }
  }, [open]);
  const page = pages[index];
  const allFields = pages.flatMap((p) => p.fields);
  return (
    <Modal open={open} onClose={onClose} title="Preview — answers won't be saved" width="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{title || "Untitled job"}</div>
          <div className="text-xs text-[#7c7d94]">{orgName}</div>
        </div>
        <div className="flex gap-1">
          <Chip active={device === "desktop"} onClick={() => setDevice("desktop")}>
            <Monitor className="h-3 w-3" /> Desktop
          </Chip>
          <Chip active={device === "mobile"} onClick={() => setDevice("mobile")}>
            <Smartphone className="h-3 w-3" /> Mobile
          </Chip>
        </div>
      </div>
      {page && (
        <div className={`mx-auto w-full rounded-2xl border border-[#262626] bg-[#0f0f11] p-5 ${device === "mobile" ? "max-w-[380px]" : ""}`}>
          <div className="mb-4 flex items-center justify-between text-xs text-[#7c7d94]">
            <span>
              Step {index + 1} of {pages.length}
            </span>
            {page.timeLimitMinutes ? <span>{page.timeLimitMinutes} min timed</span> : null}
          </div>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-[#1f1f28]">
            <div className="h-full rounded-full" style={{ width: `${((index + 1) / pages.length) * 100}%`, background: GOLD }} />
          </div>
          <h3 className="text-lg font-semibold text-white">{page.title}</h3>
          {page.description && <p className="mb-4 text-sm text-[#7c7d94]">{page.description}</p>}
          <div className="mt-4">
            <FormRenderer
              page={page}
              allFields={allFields}
              answers={answers}
              onChange={(id, patch) =>
                setAnswers((a) => ({ ...a, [id]: { fieldId: id, files: [], ...(a[id] || {}), ...patch } }))
              }
            />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Back
            </Button>
            <Button disabled={index >= pages.length - 1} onClick={() => setIndex((i) => i + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TemplatesModal({
  open,
  onClose,
  consent,
  saved,
  onApply,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  consent: string;
  saved: Array<{ id: string; name: string; pages: FormPage[]; createdAt: string }>;
  onApply: (pages: FormPage[]) => void;
  onDeleted: () => void;
}) {
  // Saved forms keep their field ids; give them fresh ones so two jobs
  // never share answer keys.
  const fresh = (pages: FormPage[]): FormPage[] =>
    pages.map((p) => {
      const idMap = new Map<string, string>();
      const fields = p.fields.map((f) => {
        const id = newId("fld_");
        idMap.set(f.id, id);
        return { ...f, id };
      });
      return {
        ...p,
        id: newId("pg_"),
        fields: fields.map((f) =>
          f.condition?.fieldId && idMap.has(f.condition.fieldId) ? { ...f, condition: { ...f.condition, fieldId: idMap.get(f.condition.fieldId)! } } : f
        ),
      };
    });
  return (
    <Modal open={open} onClose={onClose} title="Templates & saved forms" width="max-w-2xl">
      <div>
        <Label>Templates</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onApply(t.build(consent))}
              className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-left transition-colors hover:border-[#3a3a48]"
            >
              <div className="text-sm font-medium text-white">{t.name}</div>
              <div className="text-xs text-[#7c7d94]">{t.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Your saved forms</Label>
        {saved.length ? (
          <div className="space-y-2">
            {saved.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{f.name}</div>
                  <div className="text-xs text-[#7c7d94]">
                    {f.pages.length} pages · {f.pages.reduce((s, p) => s + p.fields.length, 0)} fields
                  </div>
                </div>
                <Button variant="secondary" onClick={() => onApply(fresh(f.pages))}>
                  Use
                </Button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await jobsApi.deleteSavedForm(f.id);
                      onDeleted();
                    } catch (err) {
                      toast.error(errorMessage(err, "Couldn't delete the form."));
                    }
                  }}
                  className="text-[#61627a] hover:text-[#f87171]"
                  aria-label="Delete saved form"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#7c7d94]">Forms you save with “Save as reusable form” show up here.</p>
        )}
      </div>
    </Modal>
  );
}

function SaveFormModal({
  open,
  onClose,
  defaultName,
  pages,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  pages: FormPage[];
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(defaultName);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as reusable form"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await jobsApi.saveForm(name.trim(), pages);
                toast.success("Form saved");
                onSaved();
                onClose();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't save the form."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save form
          </Button>
        </>
      }
    >
      <TextInput label="Form name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <p className="text-xs text-[#7c7d94]">Reuse it on future jobs from “Templates & saved forms”.</p>
    </Modal>
  );
}
