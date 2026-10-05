"use client";

// The registration form an organizer builds for one event.
//
// Three panes, left to right: what you can add, what you've built, and the
// settings for whatever is selected. That layout is the whole point — the
// canvas is a real preview of the public form, so there is no "now go and
// check what it looks like" step.
//
// Fields are added by click as well as drag: dragging is faster once you know
// the library, but a click target that also works is what makes it usable on
// a trackpad and with a keyboard.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Building2,
  Check,
  ChevronDown,
  Copy,
  GripVertical,
  Globe,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Type as TypeIcon,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  GOLD,
  Label,
  Toggle,
  useConfirm,
  useConsoleAction,
} from "../ui";
import { getRegistrationForm, listTickets, saveRegistrationForm } from "../api";
import {
  CONSENT_FIELD_TYPES,
  STANDARD_FIELD_TYPES,
  type EventFormField,
  type EventFormFieldType,
  type TicketTier,
} from "../types";

// ── Field library ────────────────────────────────────────────────────────

type LibraryEntry = {
  type: EventFormFieldType;
  label: string;
  icon: any;
  /** Default label when dropped on the canvas. */
  defaultLabel: string;
  placeholder?: string;
};

const LIBRARY: Array<{ group: string; items: LibraryEntry[] }> = [
  {
    group: "Standard",
    items: [
      { type: "first_name", label: "First name", icon: User, defaultLabel: "First name", placeholder: "Enter first name" },
      { type: "last_name", label: "Last name", icon: User, defaultLabel: "Last name", placeholder: "Enter last name" },
      { type: "email", label: "Email", icon: Mail, defaultLabel: "Email address", placeholder: "you@example.com" },
      { type: "phone", label: "Phone", icon: Phone, defaultLabel: "Phone number", placeholder: "Enter mobile number" },
      { type: "company", label: "Company", icon: Building2, defaultLabel: "Company / Organization", placeholder: "Company name" },
      { type: "job_title", label: "Job title", icon: TypeIcon, defaultLabel: "Job title", placeholder: "Your role" },
      { type: "country", label: "Country", icon: Globe, defaultLabel: "Country", placeholder: "Country" },
    ],
  },
  {
    group: "Custom fields",
    items: [
      { type: "short_text", label: "Short text", icon: TypeIcon, defaultLabel: "Short answer", placeholder: "Type here…" },
      { type: "long_text", label: "Long text", icon: AlignLeft, defaultLabel: "Long answer", placeholder: "Type here…" },
      { type: "dropdown", label: "Dropdown", icon: ChevronDown, defaultLabel: "Choose one", placeholder: "Select…" },
      { type: "multi_select", label: "Multi-select", icon: Check, defaultLabel: "Choose any", placeholder: "" },
    ],
  },
  {
    group: "Consent",
    items: [
      { type: "terms", label: "Terms", icon: ShieldCheck, defaultLabel: "I agree to the Terms of Service and Privacy Policy." },
      { type: "marketing_opt_in", label: "Marketing opt-in", icon: ShieldCheck, defaultLabel: "I consent to receiving event updates and promotional material." },
      { type: "photo_consent", label: "Photo consent", icon: ShieldCheck, defaultLabel: "I consent to being photographed or filmed at this event." },
    ],
  },
];

const ENTRY_BY_TYPE = new Map<EventFormFieldType, LibraryEntry>(
  LIBRARY.flatMap((g) => g.items).map((i) => [i.type, i])
);

/** A standard field can only appear once — two "Email" boxes answer nowhere. */
const SINGLETON_TYPES = new Set<EventFormFieldType>([
  ...STANDARD_FIELD_TYPES,
  ...CONSENT_FIELD_TYPES,
]);

function newKey(type: EventFormFieldType, existing: EventFormField[]): string {
  if (SINGLETON_TYPES.has(type)) return type;
  // Custom fields need a stable, unique key that survives relabelling.
  let n = 1;
  while (existing.some((f) => f.key === `${type}_${n}`)) n += 1;
  return `${type}_${n}`;
}

function makeField(
  type: EventFormFieldType,
  existing: EventFormField[]
): EventFormField {
  const entry = ENTRY_BY_TYPE.get(type)!;
  return {
    key: newKey(type, existing),
    type,
    label: entry.defaultLabel,
    placeholder: entry.placeholder,
    required: type === "first_name" || type === "email",
    showOnBadge: false,
    options:
      type === "dropdown" || type === "multi_select"
        ? ["Option 1", "Option 2"]
        : [],
    conditions: [],
    order: existing.length,
  };
}

const isConsent = (t: EventFormFieldType) =>
  CONSENT_FIELD_TYPES.includes(t);

export default function RegistrationFormBuilder({ eventId }: { eventId: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EventFormField[]>([]);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const dragKey = useRef<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([
        getRegistrationForm(eventId),
        listTickets(eventId, "ticket"),
      ]);
      setTitle(f.form.title || "");
      setDescription(f.form.description || "");
      setFields([...(f.form.fields || [])].sort((a, b) => a.order - b.order));
      setTiers(t.tiers || []);
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not load the registration form");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => fields.find((f) => f.key === selectedKey) || null,
    [fields, selectedKey]
  );

  // ── Mutations ──────────────────────────────────────────────────────────
  const patch = useCallback(
    (key: string, changes: Partial<EventFormField>) => {
      setFields((prev) =>
        prev.map((f) => (f.key === key ? { ...f, ...changes } : f))
      );
      setDirty(true);
    },
    []
  );

  const addField = useCallback(
    (type: EventFormFieldType, atIndex?: number) => {
      setFields((prev) => {
        if (SINGLETON_TYPES.has(type) && prev.some((f) => f.type === type)) {
          toast.info(`${ENTRY_BY_TYPE.get(type)?.label} is already on the form`);
          return prev;
        }
        const field = makeField(type, prev);
        const next = [...prev];
        next.splice(atIndex ?? next.length, 0, field);
        setSelectedKey(field.key);
        return next.map((f, order) => ({ ...f, order }));
      });
      setDirty(true);
    },
    []
  );

  const duplicate = useCallback((key: string) => {
    setFields((prev) => {
      const source = prev.find((f) => f.key === key);
      if (!source) return prev;
      if (SINGLETON_TYPES.has(source.type)) {
        toast.info("This field can only appear once");
        return prev;
      }
      const copy = { ...source, key: newKey(source.type, prev) };
      const next = [...prev];
      next.splice(prev.indexOf(source) + 1, 0, copy);
      setSelectedKey(copy.key);
      return next.map((f, order) => ({ ...f, order }));
    });
    setDirty(true);
  }, []);

  const remove = useCallback(
    async (key: string) => {
      const field = fields.find((f) => f.key === key);
      if (!field) return;
      const ok = await confirm({
        title: `Remove "${field.label}"?`,
        message:
          "New registrations stop collecting it. Answers already given are kept on the registrations that have them.",
        confirmLabel: "Remove field",
      });
      if (!ok) return;
      setFields((prev) =>
        prev.filter((f) => f.key !== key).map((f, order) => ({ ...f, order }))
      );
      setSelectedKey(null);
      setDirty(true);
    },
    [fields, confirm]
  );

  function reorder(fromKey: string, toIndex: number) {
    setFields((prev) => {
      const from = prev.findIndex((f) => f.key === fromKey);
      if (from < 0 || from === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex > from ? toIndex - 1 : toIndex, 0, moved);
      return next.map((f, order) => ({ ...f, order }));
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await saveRegistrationForm(eventId, { title, description, fields });
      toast.success("Registration form saved");
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not save the form");
    } finally {
      setSaving(false);
    }
  }

  useConsoleAction("form:save", () => void save());

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LIBRARY;
    return LIBRARY.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  if (loading) {
    return (
      <div className="flex justify-center px-8 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
      {/* ── Field library ─────────────────────────────────────────────── */}
      <aside className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
        <h3 className="text-sm font-bold text-white">Field library</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Drag or click to add an element to your form.
        </p>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] py-2 pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-brand"
          />
        </div>

        <div className="mt-4 space-y-4">
          {filteredLibrary.map((group) => (
            <div key={group.group}>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {group.group}
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const used =
                    SINGLETON_TYPES.has(item.type) &&
                    fields.some((f) => f.type === item.type);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      draggable={!used}
                      onDragStart={(e) => {
                        dragKey.current = null;
                        e.dataTransfer.setData("text/field-type", item.type);
                      }}
                      disabled={used}
                      onClick={() => addField(item.type)}
                      title={used ? "Already on the form" : `Add ${item.label}`}
                      className={[
                        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                        used
                          ? "cursor-not-allowed border-[#1f1f1f] text-zinc-600"
                          : "cursor-grab border-[#262626] bg-[#1A1A1A] text-zinc-300 hover:border-[#3A3A3A] hover:text-white",
                      ].join(" ")}
                    >
                      {isConsent(item.type) ? (
                        <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      ) : (
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {used ? (
                        <Check className="h-3 w-3 shrink-0" style={{ color: GOLD }} />
                      ) : (
                        <Plus className="h-3 w-3 shrink-0 text-zinc-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Canvas ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Register for this event"
          className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder:text-zinc-600"
        />
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDirty(true);
          }}
          placeholder="A line explaining what this form is for."
          className="mt-1 w-full bg-transparent text-sm text-zinc-400 outline-none placeholder:text-zinc-600"
        />

        <div
          className="mt-6 space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const type = e.dataTransfer.getData("text/field-type");
            if (type) addField(type as EventFormFieldType);
            else if (dragKey.current) reorder(dragKey.current, fields.length);
            dragKey.current = null;
          }}
        >
          {fields.map((field, i) => (
            <FieldCard
              key={field.key}
              field={field}
              tiers={tiers}
              active={field.key === selectedKey}
              onSelect={() => setSelectedKey(field.key)}
              onDuplicate={() => duplicate(field.key)}
              onRemove={() => void remove(field.key)}
              onDragStart={() => {
                dragKey.current = field.key;
              }}
              onDropBefore={(e) => {
                const type = e.dataTransfer.getData("text/field-type");
                if (type) addField(type as EventFormFieldType, i);
                else if (dragKey.current) reorder(dragKey.current, i);
                dragKey.current = null;
              }}
            />
          ))}

          {/* Always-present drop target, so an empty form is still buildable
              and appending never requires aiming between two cards. */}
          <div
            onDragOver={(e) => e.preventDefault()}
            className="rounded-xl border border-dashed border-[#3A3A3A] py-4 text-center text-xs font-medium"
            style={{ color: GOLD }}
          >
            {fields.length === 0
              ? "Drop a field here to start your form"
              : "Drop field here"}
          </div>
        </div>
      </div>

      {/* ── Field settings ────────────────────────────────────────────── */}
      <aside className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
        <h3 className="text-sm font-bold text-white">Field settings</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          {selected
            ? "Configure the selected form element."
            : "Select a field on the form to configure it."}
        </p>

        {selected && (
          <FieldSettings
            field={selected}
            tiers={tiers}
            onChange={(changes) => patch(selected.key, changes)}
          />
        )}

        <div className="mt-5 border-t border-[#262626] pt-4">
          <Button
            className="w-full"
            loading={saving}
            disabled={!dirty}
            onClick={save}
          >
            {dirty ? "Save form" : "Saved"}
          </Button>
        </div>
      </aside>

      {confirmDialog}
    </div>
  );
}

// ── Canvas card ──────────────────────────────────────────────────────────

function FieldCard({
  field,
  tiers,
  active,
  onSelect,
  onDuplicate,
  onRemove,
  onDragStart,
  onDropBefore,
}: {
  field: EventFormField;
  tiers: TicketTier[];
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDropBefore: (e: React.DragEvent) => void;
}) {
  const conditional = field.conditions.length > 0;
  const tierName = (id: string) => tiers.find((t) => t._id === id)?.name || "a tier";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropBefore}
      onClick={onSelect}
      className={[
        "group relative cursor-pointer rounded-xl border p-4 transition-colors",
        active
          ? "border-brand bg-[#1A1A1A]"
          : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
      ].join(" ")}
    >
      {/* Row actions sit above the card so they never cover its content. */}
      <div
        className={[
          "absolute -top-3 left-3 flex items-center gap-1 rounded-lg border border-[#262626] bg-[#0e0e12] px-1 py-0.5 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
      >
        <span className="cursor-grab p-1 text-zinc-500" title="Drag to reorder">
          <GripVertical className="h-3 w-3" />
        </span>
        <button
          type="button"
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1 text-zinc-500 transition-colors hover:text-white"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-zinc-500 transition-colors hover:text-[#f87171]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white">
          {field.label}
          {field.required && <span className="ml-1 text-[#f87171]">*</span>}
        </span>
        {conditional && (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ background: `${GOLD}1f`, color: GOLD }}
            title={`Shown when ticket ${field.conditions[0].operator === "is" ? "is" : "is not"} ${field.conditions[0].values.map(tierName).join(", ")}`}
          >
            Conditional
          </span>
        )}
      </div>

      {/* A real preview, not an abstraction of one. */}
      <div className="mt-2">
        <FieldPreview field={field} />
      </div>

      {field.helpText && (
        <p className="mt-1.5 text-[11px] text-zinc-500">{field.helpText}</p>
      )}
    </div>
  );
}

function FieldPreview({ field }: { field: EventFormField }) {
  const box =
    "w-full rounded-xl border border-[#262626] bg-[#0e0e12] px-3 py-2.5 text-sm text-zinc-600";

  if (isConsent(field.type)) {
    return (
      <label className="flex items-start gap-2.5 text-xs leading-5 text-zinc-400">
        <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-[#3A3A3A]" />
        {field.label}
      </label>
    );
  }
  if (field.type === "long_text") {
    return <div className={`${box} h-16`}>{field.placeholder || "…"}</div>;
  }
  if (field.type === "dropdown" || field.type === "multi_select") {
    return (
      <div className={`${box} flex items-center justify-between`}>
        {field.placeholder || "Select…"}
        <ChevronDown className="h-4 w-4 text-zinc-600" />
      </div>
    );
  }
  return <div className={box}>{field.placeholder || "…"}</div>;
}

// ── Settings pane ────────────────────────────────────────────────────────

function FieldSettings({
  field,
  tiers,
  onChange,
}: {
  field: EventFormField;
  tiers: TicketTier[];
  onChange: (changes: Partial<EventFormField>) => void;
}) {
  const input =
    "w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-brand";
  const hasOptions = field.type === "dropdown" || field.type === "multi_select";
  const consent = isConsent(field.type);
  const rule = field.conditions[0];

  return (
    <div className="mt-4 space-y-4">
      <div>
        <Label>{consent ? "Consent text" : "Label"}</Label>
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className={input}
        />
      </div>

      {!consent && (
        <>
          <div>
            <Label>Placeholder</Label>
            <input
              value={field.placeholder || ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              className={input}
            />
          </div>
          <div>
            <Label>Help text</Label>
            <input
              value={field.helpText || ""}
              onChange={(e) => onChange({ helpText: e.target.value })}
              placeholder="Shown under the field"
              className={input}
            />
          </div>
        </>
      )}

      {hasOptions && (
        <div>
          <Label hint={`${field.options.length} option(s)`}>Options</Label>
          <div className="space-y-1.5">
            {field.options.map((opt, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...field.options];
                    next[i] = e.target.value;
                    onChange({ options: next });
                  }}
                  className={input}
                />
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() =>
                    onChange({ options: field.options.filter((_, x) => x !== i) })
                  }
                  className="shrink-0 rounded-lg px-2 text-zinc-500 transition-colors hover:text-[#f87171]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  options: [...field.options, `Option ${field.options.length + 1}`],
                })
              }
              className="w-full rounded-xl border border-dashed border-[#262626] py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-brand hover:text-brand"
            >
              + Add option
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1 border-t border-[#262626] pt-3">
        <Toggle
          checked={field.required}
          onChange={(v) => onChange({ required: v })}
          label="Required field"
          description="User must fill this in to submit."
        />
        {!consent && (
          <Toggle
            checked={field.showOnBadge}
            onChange={(v) => onChange({ showOnBadge: v })}
            label="Show on badge"
            description="Print this answer on the attendee badge."
          />
        )}
      </div>

      {!consent && (
        <div>
          <Label hint="Optional">Map to Deals field</Label>
          <input
            value={field.mapToDealsField || ""}
            onChange={(e) => onChange({ mapToDealsField: e.target.value })}
            placeholder="deal.track_interest"
            className={input}
          />
        </div>
      )}

      {/* Conditional logic. Ticket type is the only source available, because
          it is the one thing known before the form is filled in. */}
      <div className="border-t border-[#262626] pt-3">
        <Label>Conditional logic</Label>
        {tiers.length === 0 ? (
          <p className="text-[11px] text-zinc-500">
            Add a ticket type first — rules are based on which ticket is being
            bought.
          </p>
        ) : rule ? (
          <div className="space-y-2 rounded-xl border border-[#262626] bg-[#1A1A1A] p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Show this field if
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-[#262626] px-2 py-1 text-[11px] text-zinc-300">
                Ticket type
              </span>
              <select
                value={rule.operator}
                onChange={(e) =>
                  onChange({
                    conditions: [
                      { ...rule, operator: e.target.value as "is" | "is_not" },
                    ],
                  })
                }
                className="rounded bg-[#262626] px-2 py-1 text-[11px] text-zinc-300 outline-none"
              >
                <option value="is">is</option>
                <option value="is_not">is not</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tiers.map((t) => {
                const on = rule.values.includes(t._id);
                return (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() =>
                      onChange({
                        conditions: [
                          {
                            ...rule,
                            values: on
                              ? rule.values.filter((v) => v !== t._id)
                              : [...rule.values, t._id],
                          },
                        ],
                      })
                    }
                    className={[
                      "rounded px-2 py-1 text-[11px] transition-colors",
                      on ? "text-[#141418]" : "bg-[#262626] text-zinc-400",
                    ].join(" ")}
                    style={on ? { background: GOLD } : undefined}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onChange({ conditions: [] })}
              className="text-[11px] text-zinc-500 transition-colors hover:text-[#f87171]"
            >
              Remove rule
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              onChange({
                conditions: [
                  { source: "ticket_type", operator: "is", values: [] },
                ],
              })
            }
            className="flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: GOLD }}
          >
            <Plus className="h-3 w-3" />
            Add rule
          </button>
        )}
      </div>
    </div>
  );
}
