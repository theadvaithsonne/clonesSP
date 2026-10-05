"use client";

// Notifications — Admin → Notifications.
//
// Rules that say "when X happens, mail Y". Both halves are configured here
// rather than coded: conditions are a boolean tree over the event's payload,
// and recipients are resolved per event.
//
// Backend: GET/POST/PATCH/DELETE /garage-admin/notifications/rules, with the
// event catalogue at /events. The condition builder renders entirely from
// that catalogue, so a new event shows up here with no change to this file.
//
// Delivery is NOT built yet. A rule can be created and enabled, but nothing
// evaluates or sends — see the spec's phasing. The banner below says so
// rather than letting an admin assume mail is going out.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Loader2, X, Search, AlertTriangle } from "lucide-react";
import {
  listEvents,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  resolveUser,
  type AdminEventDescriptor,
  type AdminNotificationRule,
  type ConditionNode,
  type EventFieldType,
  type RecipientSpec,
} from "@/lib/admin-api/notifications";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const PAGE_KEY = "admin_notifications";

/** A leaf the builder can edit. The stored tree is richer (nested all/any),
 *  but this first builder emits a flat AND of include/exclude leaves, which
 *  is exactly what the driving example needs and is far easier to read. */
interface DraftLeaf {
  id: string;
  field: string;
  op: string;
  /** Display value — an email for user fields, raw text otherwise. */
  raw: string;
  /** Resolved user id for user fields; null until resolved. */
  resolvedId: string | null;
  resolvedLabel: string | null;
  negate: boolean;
}

export default function AdminNotificationsPage() {
  const { ready, canView, canManage } = useAdminAccess();
  const mayManage = canManage(PAGE_KEY);

  const [events, setEvents] = useState<AdminEventDescriptor[]>([]);
  const [operators, setOperators] = useState<
    Record<EventFieldType, { op: string; label: string }[]>
  >({} as Record<EventFieldType, { op: string; label: string }[]>);
  const [rules, setRules] = useState<AdminNotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  // The header's one search box, same as the other admin list pages. Filtered
  // client-side rather than re-fetching: rules are a short, admin-authored
  // list, so the whole set is already here and a round-trip would only add
  // latency to every keystroke.
  const { query: search } = useAdminSearch();
  const q = search.trim().toLowerCase();
  const visibleRules = useMemo(() => {
    if (!q) return rules;
    return rules.filter((r) => {
      const eventLabel = events.find((e) => e.name === r.event)?.label || r.event;
      // Recipients are searchable too — "who gets mailed about this?" is the
      // question an operator actually arrives with.
      return [
        r.name,
        r.description ?? "",
        eventLabel,
        r.event,
        summariseRecipients(r.recipients || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rules, events, q]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ev, rl] = await Promise.all([listEvents(), listRules()]);
      setEvents(ev.events || []);
      setOperators(ev.operators || ({} as never));
      setRules(rl.rules || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && canView(PAGE_KEY)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const toggle = async (rule: AdminNotificationRule) => {
    try {
      const res = await updateRule(rule._id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r._id === rule._id ? res.rule : r)));
      toast.success(res.rule.enabled ? "Rule enabled" : "Rule disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update rule");
    }
  };

  const remove = async (rule: AdminNotificationRule) => {
    if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    try {
      await deleteRule(rule._id);
      setRules((prev) => prev.filter((r) => r._id !== rule._id));
      toast.success("Rule deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete rule");
    }
  };

  if (ready && !canView(PAGE_KEY)) {
    return (
      <div className="p-8 text-sm text-zinc-400">
        You don&apos;t have access to Notifications.
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[19px] font-semibold text-white">
            <Bell className="h-4.5 w-4.5 text-[#FBD10D]" />
            Notifications
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
            Rules that decide when an email goes out and who receives it. Both
            the condition and the recipients are set here — no deploy needed.
          </p>
          {/* Without this a filtered list is indistinguishable from a short
              one, and "we only have 3 rules" is the wrong conclusion to draw
              from a stale search box. */}
          {!loading && rules.length > 0 && (
            <p className="mt-1.5 text-[12px] text-zinc-500">
              {q
                ? `${visibleRules.length} of ${rules.length} rule${rules.length === 1 ? "" : "s"} match “${search.trim()}”`
                : `${rules.length} rule${rules.length === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
        {mayManage && (
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#FBD10D] px-4 text-sm font-medium text-black hover:bg-[#e6c00d]"
          >
            <Plus className="h-3.5 w-3.5" />
            New rule
          </button>
        )}
      </header>

      {/* Honesty banner. The surface is ahead of the engine, and an admin who
          assumed an enabled rule was sending would be badly misled. */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-[12px] leading-relaxed text-amber-200/90">
          <strong className="font-semibold">Live for $25 payments.</strong>{" "}
          Enabled rules on the three &ldquo;$25 payment&rdquo; events send email
          on every real payment. &ldquo;Customer signs up&rdquo; is not wired
          yet — rules on it are saved but will not send.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">
          {loadError}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState onCreate={mayManage ? () => setBuilderOpen(true) : undefined} />
      ) : visibleRules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-6 py-12 text-center text-[13px] text-zinc-500">
          No rules matching &ldquo;{search.trim()}&rdquo;
        </p>
      ) : (
        <div className="space-y-2">
          {visibleRules.map((rule) => (
            <RuleRow
              key={rule._id}
              rule={rule}
              event={events.find((e) => e.name === rule.event)}
              mayManage={mayManage}
              onToggle={() => toggle(rule)}
              onDelete={() => remove(rule)}
            />
          ))}
        </div>
      )}

      {builderOpen && (
        <RuleBuilder
          events={events}
          operators={operators}
          onClose={() => setBuilderOpen(false)}
          onCreated={(rule) => {
            setRules((prev) => [rule, ...prev]);
            setBuilderOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Rule row ──────────────────────────────────────────────────────────── */

function RuleRow({
  rule,
  event,
  mayManage,
  onToggle,
  onDelete,
}: {
  rule: AdminNotificationRule;
  event?: AdminEventDescriptor;
  mayManage: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const recipientSummary = summariseRecipients(rule.recipients || []);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-white">{rule.name}</span>
          <span
            className={
              rule.enabled
                ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                : "rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
            }
          >
            {rule.enabled ? "On" : "Off"}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-zinc-400">
          <span className="text-zinc-300">{event?.label || rule.event}</span>
          {recipientSummary && <span> → {recipientSummary}</span>}
        </div>
      </div>
      {mayManage && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[12px] text-zinc-200 hover:bg-white/[0.06]"
          >
            {rule.enabled ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete rule"
            className="rounded-full border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function summariseRecipients(specs: RecipientSpec[]): string {
  if (!specs.length) return "";
  return specs
    .map((s) => {
      if (s.type === "static") return s.emails.join(", ");
      if (s.type === "relation") return `the ${s.relation}`;
      if (s.type === "role") return `role: ${s.role}`;
      return `a query (max ${s.cap})`;
    })
    .join(" + ");
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.1] px-6 py-14 text-center">
      <Bell className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
      <p className="text-[14px] text-zinc-300">No notification rules yet</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-zinc-500">
        A rule pairs an event with a condition and a list of recipients — for
        example, mail ops whenever someone signs up in a particular downline.
      </p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 rounded-full bg-[#FBD10D] px-4 py-2 text-[13px] font-medium text-black hover:bg-[#e6c00d]"
        >
          Create the first rule
        </button>
      )}
    </div>
  );
}

/* ── Builder ───────────────────────────────────────────────────────────── */

function RuleBuilder({
  events,
  operators,
  onClose,
  onCreated,
}: {
  events: AdminEventDescriptor[];
  operators: Record<EventFieldType, { op: string; label: string }[]>;
  onClose: () => void;
  onCreated: (rule: AdminNotificationRule) => void;
}) {
  const [name, setName] = useState("");
  const [eventName, setEventName] = useState(events[0]?.name || "");
  const [leaves, setLeaves] = useState<DraftLeaf[]>([]);
  const [emails, setEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const event = useMemo(
    () => events.find((e) => e.name === eventName),
    [events, eventName],
  );

  const addLeaf = () => {
    const field = event?.fields[0];
    if (!field) return;
    setLeaves((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        field: field.key,
        op: operators[field.type]?.[0]?.op || "equals",
        raw: "",
        resolvedId: null,
        resolvedLabel: null,
        negate: false,
      },
    ]);
  };

  const patchLeaf = (id: string, patch: Partial<DraftLeaf>) =>
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const save = async () => {
    setError(null);
    const parsedEmails = emails
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!name.trim()) return setError("Give the rule a name.");
    if (!eventName) return setError("Pick an event.");
    if (parsedEmails.length === 0)
      return setError("Add at least one recipient email.");

    // User-typed leaves must be resolved to ids before they mean anything.
    const unresolved = leaves.find(
      (l) => fieldType(event, l.field) === "user" && !l.resolvedId,
    );
    if (unresolved)
      return setError(
        `Look up "${unresolved.raw || "the email"}" before saving — rules store user ids, not addresses.`,
      );

    const conditions: ConditionNode = {
      all: leaves.map((l) => {
        const leaf: ConditionNode = {
          field: l.field,
          op: l.op,
          value: fieldType(event, l.field) === "user" ? l.resolvedId : l.raw,
        };
        return l.negate ? { not: leaf } : leaf;
      }),
    };

    setSaving(true);
    try {
      const res = await createRule({
        name: name.trim(),
        event: eventName,
        conditions,
        recipients: [{ type: "static", emails: parsedEmails }],
      });
      toast.success("Rule created — it starts disabled");
      onCreated(res.rule);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#141419]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-white">New notification rule</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <Field label="Rule name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Signups under Shorupan"
              className="w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-[#FBD10D]/50"
            />
          </Field>

          <Field label="When this happens">
            <select
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                setLeaves([]);
              }}
              className="w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-[#FBD10D]/50"
            >
              {events.map((e) => (
                <option key={e.name} value={e.name} className="bg-[#141419]">
                  {e.label}
                </option>
              ))}
            </select>
            {event && (
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
                {event.description}
              </p>
            )}
          </Field>

          <Field
            label="Only when"
            hint="All conditions must hold. Leave empty to fire on every event."
          >
            <div className="space-y-2">
              {leaves.map((leaf) => (
                <LeafRow
                  key={leaf.id}
                  leaf={leaf}
                  event={event}
                  operators={operators}
                  onChange={(patch) => patchLeaf(leaf.id, patch)}
                  onRemove={() => setLeaves((p) => p.filter((l) => l.id !== leaf.id))}
                />
              ))}
              <button
                type="button"
                onClick={addLeaf}
                disabled={!event?.fields.length}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#FBD10D] hover:text-[#e6c00d] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add condition
              </button>
            </div>
          </Field>

          <Field label="Send to" hint="Comma or space separated.">
            <input
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="ops@garage.app, founders@garage.app"
              className="w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-[#FBD10D]/50"
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/[0.1] px-4 py-2 text-[13px] text-zinc-200 hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-[#FBD10D] px-4 py-2 text-[13px] font-medium text-black hover:bg-[#e6c00d] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create rule
          </button>
        </div>
      </div>
    </div>
  );
}

function fieldType(
  event: AdminEventDescriptor | undefined,
  key: string,
): EventFieldType | undefined {
  return event?.fields.find((f) => f.key === key)?.type;
}

function LeafRow({
  leaf,
  event,
  operators,
  onChange,
  onRemove,
}: {
  leaf: DraftLeaf;
  event?: AdminEventDescriptor;
  operators: Record<EventFieldType, { op: string; label: string }[]>;
  onChange: (patch: Partial<DraftLeaf>) => void;
  onRemove: () => void;
}) {
  const type = fieldType(event, leaf.field);
  const ops = type ? operators[type] || [] : [];
  const [looking, setLooking] = useState(false);

  const lookup = async () => {
    if (!leaf.raw.trim()) return;
    setLooking(true);
    try {
      const res = await resolveUser(leaf.raw.trim());
      onChange({
        resolvedId: res.user.id,
        resolvedLabel: `${res.user.name || res.user.email} · ${res.user.downlineCount.toLocaleString()} in downline`,
      });
    } catch (e) {
      onChange({ resolvedId: null, resolvedLabel: null });
      toast.error(e instanceof Error ? e.message : "No user with that email");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/20 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Negation is a first-class toggle, not a separate operator: "in the
            downline of X but NOT of Y" is the motivating case, and expressing
            it as two ops per field would double the operator list. */}
        <button
          type="button"
          onClick={() => onChange({ negate: !leaf.negate })}
          className={
            leaf.negate
              ? "rounded-md bg-red-500/20 px-2 py-1 text-[11px] font-medium text-red-300"
              : "rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-zinc-400 hover:text-white"
          }
        >
          {leaf.negate ? "NOT" : "IS"}
        </button>

        <select
          value={leaf.field}
          onChange={(e) => {
            const t = fieldType(event, e.target.value);
            onChange({
              field: e.target.value,
              op: (t && operators[t]?.[0]?.op) || "equals",
              raw: "",
              resolvedId: null,
              resolvedLabel: null,
            });
          }}
          className="rounded-md border border-white/[0.1] bg-black/30 px-2 py-1 text-[12px] text-white outline-none"
        >
          {(event?.fields || []).map((f) => (
            <option key={f.key} value={f.key} className="bg-[#141419]">
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={leaf.op}
          onChange={(e) => onChange({ op: e.target.value })}
          className="rounded-md border border-white/[0.1] bg-black/30 px-2 py-1 text-[12px] text-white outline-none"
        >
          {ops.map((o) => (
            <option key={o.op} value={o.op} className="bg-[#141419]">
              {o.label}
            </option>
          ))}
        </select>

        <input
          value={leaf.raw}
          onChange={(e) =>
            onChange({ raw: e.target.value, resolvedId: null, resolvedLabel: null })
          }
          placeholder={type === "user" ? "email@example.com" : "value"}
          className="min-w-[160px] flex-1 rounded-md border border-white/[0.1] bg-black/30 px-2 py-1 text-[12px] text-white outline-none placeholder:text-zinc-600"
        />

        {type === "user" && (
          <button
            type="button"
            onClick={lookup}
            disabled={looking || !leaf.raw.trim()}
            title="Resolve this email to a user"
            className="flex items-center gap-1 rounded-md border border-white/[0.1] px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
          >
            {looking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Look up
          </button>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-500 hover:text-red-300"
          title="Remove condition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {leaf.resolvedLabel && (
        <p className="mt-1.5 pl-1 text-[11px] text-emerald-300/90">✓ {leaf.resolvedLabel}</p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-zinc-300">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}
