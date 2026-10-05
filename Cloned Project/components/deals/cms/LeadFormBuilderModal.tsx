"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  GripVertical,
  Pencil,
  Trash2,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Factory,
  MapPin,
  Globe,
  Type,
  List,
  Hash,
  Calendar,
} from "lucide-react";
import type { CmsForm, CmsFormField, CmsFormFieldType } from "@/lib/cms/types";

const ADD_FIELDS: Array<{
  type: CmsFormFieldType;
  key: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { type: "text", key: "full_name", label: "Full Name", icon: <User className="h-4 w-4" /> },
  { type: "email", key: "email", label: "Email Address", icon: <Mail className="h-4 w-4" /> },
  { type: "phone", key: "phone", label: "Phone Number", icon: <Phone className="h-4 w-4" /> },
  { type: "text", key: "company", label: "Company Name", icon: <Building2 className="h-4 w-4" /> },
  { type: "text", key: "job_title", label: "Job Title", icon: <Briefcase className="h-4 w-4" /> },
  {
    type: "dropdown",
    key: "industry",
    label: "Industry",
    icon: <Factory className="h-4 w-4" />,
  },
  { type: "text", key: "city", label: "City", icon: <MapPin className="h-4 w-4" /> },
  {
    type: "dropdown",
    key: "country",
    label: "Country",
    icon: <Globe className="h-4 w-4" />,
  },
  { type: "text", key: "custom_text", label: "Custom Text", icon: <Type className="h-4 w-4" /> },
  {
    type: "dropdown",
    key: "custom_dropdown",
    label: "Custom Dropdown",
    icon: <List className="h-4 w-4" />,
  },
  { type: "number", key: "custom_number", label: "Custom Number", icon: <Hash className="h-4 w-4" /> },
  { type: "date", key: "custom_date", label: "Custom Date", icon: <Calendar className="h-4 w-4" /> },
];

function fieldIcon(type: string) {
  const found = ADD_FIELDS.find((f) => f.type === type);
  return found?.icon || <Type className="h-4 w-4" />;
}

function newField(preset: (typeof ADD_FIELDS)[number], order: number): CmsFormField {
  const suffix = Math.random().toString(36).slice(2, 6);
  const key =
    preset.key.startsWith("custom_") || ["industry", "country"].includes(preset.key)
      ? `${preset.key}_${suffix}`
      : preset.key;
  return {
    id: `f_${suffix}`,
    type: preset.type,
    key,
    label: preset.label,
    placeholder: preset.label,
    required: ["full_name", "email", "phone"].includes(preset.key),
    order,
    options:
      preset.type === "dropdown"
        ? preset.key.includes("industry")
          ? ["Technology", "Healthcare", "Finance", "Other"]
          : preset.key.includes("country")
            ? ["United States", "India", "United Kingdom", "Other"]
            : ["Option 1", "Option 2"]
        : undefined,
  };
}

function SortableFieldRow({
  field,
  editingId,
  setEditingId,
  updateField,
  removeField,
}: {
  field: CmsFormField;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  updateField: (id: string, patch: Partial<CmsFormField>) => void;
  removeField: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2.5"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-[#555] active:cursor-grabbing"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-brand">{fieldIcon(field.type)}</span>
      <div className="min-w-0 flex-1">
        {editingId === field.id ? (
          <input
            className="w-full rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1 text-sm text-white"
            value={field.label}
            onChange={(e) => updateField(field.id, { label: e.target.value })}
            onBlur={() => setEditingId(null)}
            autoFocus
          />
        ) : (
          <span className="truncate text-sm text-white">{field.label}</span>
        )}
      </div>
      <span className="text-[11px] text-[#888]">Req</span>
      <button
        type="button"
        onClick={() => updateField(field.id, { required: !field.required })}
        className={`h-5 w-9 cursor-pointer rounded-full transition ${
          field.required ? "bg-brand" : "bg-[#2A2A2A]"
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white transition ${
            field.required ? "ml-4" : "ml-0.5"
          }`}
        />
      </button>
      <button
        type="button"
        onClick={() => setEditingId(field.id)}
        className="cursor-pointer text-[#888] hover:text-white"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => removeField(field.id)}
        className="cursor-pointer text-[#888] hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function LeadFormBuilderModal({
  open,
  form,
  onClose,
  onSave,
}: {
  open: boolean;
  form: CmsForm | null;
  onClose: () => void;
  onSave: (next: CmsForm) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"fields" | "settings" | "validation">("fields");
  const [draft, setDraft] = useState<CmsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Only hydrate when the modal opens (or form id changes) — avoid wiping edits on parent re-renders
  useEffect(() => {
    if (!open || !form) return;
    setDraft({
      ...form,
      fields: (form.fields || []).map((f, i) => ({
        ...f,
        id: f.id || `f_${i}_${Math.random().toString(36).slice(2, 6)}`,
        order: typeof f.order === "number" ? f.order : i,
      })),
    });
    setEditingId(null);
    setTab("fields");
  }, [open, form?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  if (!open || !draft) return null;

  const fields = [...(draft.fields || [])].sort((a, b) => a.order - b.order);

  const setFields = (next: CmsFormField[]) => {
    setDraft({
      ...draft,
      fields: next.map((f, i) => ({ ...f, order: i })),
    });
  };

  const addField = (preset: (typeof ADD_FIELDS)[number]) => {
    setFields([...fields, newField(preset, fields.length)]);
  };

  const updateField = (id: string, patch: Partial<CmsFormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setFields(arrayMove(fields, oldIndex, newIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="cms-ui flex max-h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[14px] border border-[#2A2A2A] bg-[#141414] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] px-5 py-4">
          <h2 className="text-[17px] font-bold">Lead Form Builder</h2>
          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-sm">
              {(["fields", "settings", "validation"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`cursor-pointer pb-1 capitalize ${
                    tab === t
                      ? "border-b-2 border-brand font-semibold text-white"
                      : "text-[#888]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} className="cursor-pointer rounded p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {tab === "fields" ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#888]">
                  Add Fields
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ADD_FIELDS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => addField(preset)}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2.5 text-left text-sm text-white hover:border-brand/60"
                    >
                      <span className="text-brand">{preset.icon}</span>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {fields.map((field) => (
                      <SortableFieldRow
                        key={field.id}
                        field={field}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        updateField={updateField}
                        removeField={removeField}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {fields.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#555]">
                    Add fields from the left to build your form
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "settings" ? (
            <div className="mx-auto max-w-lg space-y-4">
              <label className="block space-y-1.5 text-sm">
                <span className="text-[#888]">Form title</span>
                <input
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-[#888]">Submit button text</span>
                <input
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2"
                  value={draft.submitButtonText}
                  onChange={(e) =>
                    setDraft({ ...draft, submitButtonText: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-[#888]">Success message</span>
                <textarea
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2"
                  rows={3}
                  value={draft.successMessage}
                  onChange={(e) =>
                    setDraft({ ...draft, successMessage: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-[#888]">Redirect URL (optional)</span>
                <input
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2"
                  value={draft.redirectUrl || ""}
                  onChange={(e) => setDraft({ ...draft, redirectUrl: e.target.value })}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3 text-sm">
                <span>Enable reCAPTCHA</span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, recaptchaEnabled: !draft.recaptchaEnabled })
                  }
                  className={`h-5 w-9 cursor-pointer rounded-full ${
                    draft.recaptchaEnabled ? "bg-brand" : "bg-[#2A2A2A]"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition ${
                      draft.recaptchaEnabled ? "ml-4" : "ml-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>
          ) : null}

          {tab === "validation" ? (
            <div className="mx-auto max-w-lg space-y-3 text-sm">
              {[
                {
                  key: "emailFormat",
                  label: "Email format validation (RFC 5322)",
                },
                {
                  key: "phoneFormat",
                  label: "Phone format validation (E.164)",
                },
                {
                  key: "preventDuplicates",
                  label: "Duplicate submission prevention (24hr by email)",
                },
              ].map((item) => {
                const validation = draft.validation || {};
                const on = Boolean((validation as any)[item.key] ?? true);
                return (
                  <label
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          validation: { ...validation, [item.key]: !on },
                        })
                      }
                      className={`h-5 w-9 cursor-pointer rounded-full ${on ? "bg-brand" : "bg-[#2A2A2A]"}`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition ${
                          on ? "ml-4" : "ml-0.5"
                        }`}
                      />
                    </button>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#2A2A2A] px-5 py-4">
          <p className="text-xs text-[#888]">
            Save configuration to apply latest parameters instantly.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-4 py-2 text-sm text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-bold !text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
