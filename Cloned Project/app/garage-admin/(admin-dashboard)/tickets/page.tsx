"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Mail,
  Plus,
  Send,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import {
  type AdminOption,
  RoleChip,
} from "@/components/garage-admin/assign-agent";
import {
  adminTicketsApi,
  type AdminTicket,
  type AdminTicketStatus,
} from "@/lib/admin-api/tickets";

const STATUS_META: Record<
  AdminTicketStatus,
  { label: string; pill: string; icon: typeof Circle }
> = {
  open: {
    label: "Open",
    pill: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    icon: Circle,
  },
  in_progress: {
    label: "In progress",
    pill: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    pill: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    icon: Circle,
  },
};

/** Named roles (Support Agent, NVC, …) first — those are the real assignees. */
function sortAgents(list: AdminOption[]): AdminOption[] {
  const named = (r?: string | null) =>
    r && r !== "garage-admin" && r !== "garage-super-admin" ? 0 : 1;
  return [...list].sort(
    (a, b) =>
      named(a.role) - named(b.role) ||
      (a.name || a.email).localeCompare(b.name || b.email),
  );
}

/** Fetch the assignable-admin roster once (same endpoint the user tables use). */
function useAssignableAgents(): AdminOption[] {
  const [agents, setAgents] = useState<AdminOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    garageAdminApi<{ data: AdminOption[] }>("/garage-admin/assignable-agents")
      .then((r) => {
        if (!cancelled) setAgents(sortAgents(r?.data || []));
      })
      .catch(() => {
        /* roster is optional — the picker just shows "no admins" */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return agents;
}

function initialsOf(name?: string | null): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

/** Compact assignee badge for rows and board cards. */
function AssigneeChip({ ticket }: { ticket: AdminTicket }) {
  if (!ticket.assignedToId) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
        <UserPlus className="h-3 w-3" />
        Unassigned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-[#6384ff]/20 text-[8px] font-bold text-[#9fb5ff]">
        {initialsOf(ticket.assignedToName)}
      </span>
      <span className="truncate max-w-[120px]">{ticket.assignedToName}</span>
      {ticket.assignedBy === "ai" && (
        <span className="rounded-full bg-violet-500/15 px-1 py-0.5 text-[8px] font-medium text-violet-300">
          ✨ AI
        </span>
      )}
    </span>
  );
}

/**
 * Assignee control for the ticket detail — shows who owns it (and whether the
 * AI or a human set it), with a dropdown to reassign or clear. Reassigning is
 * gated by the same grant as changing status.
 */
function AssigneePicker({
  ticket,
  agents,
  canAssign,
  onChanged,
}: {
  ticket: AdminTicket;
  agents: AdminOption[];
  canAssign: boolean;
  onChanged: (t: AdminTicket) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const assign = async (adminId: string | null) => {
    setSaving(adminId ?? "__clear__");
    try {
      const updated = adminId
        ? await adminTicketsApi.assign(ticket._id, adminId)
        : await adminTicketsApi.unassign(ticket._id);
      onChanged(updated);
      toast.success(adminId ? "Ticket reassigned" : "Unassigned");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Assigned to
          </p>
          {ticket.assignedToId ? (
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#6384ff]/20 text-[10px] font-bold text-[#9fb5ff]">
                {initialsOf(ticket.assignedToName)}
              </span>
              <span className="text-sm font-medium text-white truncate">
                {ticket.assignedToName}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  ticket.assignedBy === "ai"
                    ? "bg-violet-500/15 text-violet-300"
                    : "bg-white/[0.08] text-zinc-400"
                }`}
                title={ticket.assignReason || undefined}
              >
                {ticket.assignedBy === "ai" ? "✨ by AI" : "by admin"}
              </span>
            </div>
          ) : (
            <span className="text-sm text-zinc-500">No one yet</span>
          )}
        </div>
        {canAssign && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {ticket.assignedToId ? "Reassign" : "Assign"}
          </button>
        )}
      </div>

      {open && canAssign && (
        <>
          {/* click-away */}
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[91] mt-2 max-h-64 overflow-y-auto rounded-lg border border-white/[0.1] bg-[#0e0e16] p-1">
            {agents.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">
                No assignable admins.
              </p>
            ) : (
              agents.map((a) => {
                const isCurrent = ticket.assignedToId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => assign(a.id)}
                    disabled={!!saving}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-zinc-300">
                      {initialsOf(a.name || a.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-white">
                          {a.name || "Unnamed"}
                        </span>
                        <RoleChip role={a.role} />
                      </span>
                      <span className="block truncate text-[10px] text-zinc-500">
                        {a.email}
                      </span>
                    </span>
                    {saving === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
                    ) : isCurrent ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : null}
                  </button>
                );
              })
            )}
            {ticket.assignedToId && (
              <button
                onClick={() => assign(null)}
                disabled={!!saving}
                className="mt-1 w-full rounded-md border border-red-500/25 bg-red-500/10 py-1.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {saving === "__clear__" ? "Removing…" : "Unassign"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function GarageAdminTicketsPage() {
  const [statusFilter, setStatusFilter] = useState<AdminTicketStatus | undefined>(
    undefined,
  );
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [showNew, setShowNew] = useState(false);
  const { canDoAction } = useAdminAccess();
  const canWrite =
    canDoAction("support_tickets", "reply-ticket") ||
    canDoAction("support_tickets", "set-status");

  // Shared header search — filters this table server-side (debounced).
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    try {
      const qs = new URLSearchParams();
      // The board shows every status as a column, so it never filters by status.
      if (statusFilter && view === "list") qs.set("status", statusFilter);
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const query = qs.toString();
      const data = await garageAdminApi<{ tickets: AdminTicket[] }>(
        `/garage-admin/tickets${query ? `?${query}` : ""}`,
      );
      setTickets(data.tickets);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, view]);

  // Persist an in-place status change (used by the board's drag-and-drop) with
  // an optimistic update, rolling back to a reload on failure.
  const moveTicket = async (id: string, status: AdminTicketStatus) => {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t._id === id ? { ...t, status } : t)));
    try {
      await adminTicketsApi.update(id, { status });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't move ticket");
      setTickets(prev);
    }
  };

  const grouped = useMemo(() => {
    const active = tickets.filter(
      (t) => t.status === "open" || t.status === "in_progress",
    );
    const closed = tickets.filter(
      (t) => t.status === "resolved" || t.status === "closed",
    );
    return { active, closed };
  }, [tickets]);

  if (openId) {
    return (
      <DetailView
        ticketId={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support tickets</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every user-filed ticket across Garage.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* List / Board view toggle */}
          <div className="inline-flex items-center rounded-lg border border-white/[0.1] p-0.5">
            {(
              [
                { key: "list", label: "List", Icon: ListIcon },
                { key: "board", label: "Board", Icon: LayoutGrid },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === key
                    ? "bg-[#6384ff]/20 text-[#9fb5ff]"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {canWrite && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6384ff] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7a96ff]"
            >
              <Plus className="h-3.5 w-3.5" />
              New ticket
            </button>
          )}
        </div>
      </header>

      {showNew && (
        <NewTicketDialog
          onClose={() => setShowNew(false)}
          onCreated={(t) => {
            setShowNew(false);
            load();
            setOpenId(t._id);
          }}
        />
      )}

      {/* Status filter — list view only; the board shows all statuses as columns */}
      {view === "list" && (
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        {(["open", "in_progress", "resolved", "closed", undefined] as const).map(
          (s) => {
            const active = s === statusFilter;
            const label = s ? STATUS_META[s].label : "All";
            const count = s
              ? tickets.filter((t) => t.status === s).length
              : tickets.length;
            return (
              <button
                key={s ?? "all"}
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-[#6384ff]/15 text-[#9fb5ff] border-[#6384ff]/40"
                    : "border-white/[0.08] text-zinc-400 hover:bg-white/[0.04]"
                }`}
              >
                {label}
                {!loading && (
                  <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/80">
                    {count}
                  </span>
                )}
              </button>
            );
          },
        )}
      </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : view === "board" ? (
        <KanbanBoard
          tickets={tickets}
          onOpen={setOpenId}
          onMove={moveTicket}
        />
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-sm text-zinc-500">
          No tickets match this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.active.length > 0 && (
            <Section
              label={`Active (${grouped.active.length})`}
              tickets={grouped.active}
              onOpen={setOpenId}
            />
          )}
          {grouped.closed.length > 0 && (
            <Section
              label="Resolved / closed"
              tickets={grouped.closed}
              onOpen={setOpenId}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Raise a ticket by hand, outside any chat — for issues an admin takes by
 * phone/email/in person. The email is matched to a Garage user server-side (or
 * filed as a guest), then the AI auto-assigns it.
 */
function NewTicketDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: AdminTicket) => void;
}) {
  const [forEmail, setForEmail] = useState("");
  const [forName, setForName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit =
    forEmail.trim() && title.trim() && description.trim() && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const t = await adminTicketsApi.create({
        forEmail: forEmail.trim(),
        forName: forName.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        priority,
        category: category.trim() || undefined,
      });
      toast.success("Ticket created");
      onCreated(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-[520px] max-w-full overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e16] p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-white">New ticket</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Raise a ticket on a member&apos;s behalf. The AI will auto-assign it.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Member email *
              </span>
              <input
                type="email"
                value={forEmail}
                onChange={(e) => setForEmail(e.target.value)}
                placeholder="member@email.com"
                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Name (for guests)
              </span>
              <input
                value={forName}
                onChange={(e) => setForName(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
              Subject *
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Short summary of the issue"
              className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
              Description *
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="What's going on?"
              className="w-full resize-y rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm leading-relaxed text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Priority
              </span>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value as "low" | "medium" | "high" | "urgent",
                  )
                }
                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white outline-none focus:border-[#6384ff]/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Category
              </span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="General"
                className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#6384ff] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#7a96ff] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create ticket
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Kanban board — one column per status, drag a card to another column to change
 * its status (persisted via the same PATCH the detail view uses). Native HTML5
 * drag-and-drop, so no extra dependency.
 */
function KanbanBoard({
  tickets,
  onOpen,
  onMove,
}: {
  tickets: AdminTicket[];
  onOpen: (id: string) => void;
  onMove: (id: string, status: AdminTicketStatus) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<AdminTicketStatus | null>(null);
  const columns: AdminTicketStatus[] = [
    "open",
    "in_progress",
    "resolved",
    "closed",
  ];
  const byStatus = (s: AdminTicketStatus) =>
    tickets.filter((t) => t.status === s);

  const drop = (status: AdminTicketStatus) => {
    if (dragId) {
      const t = tickets.find((x) => x._id === dragId);
      if (t && t.status !== status) onMove(dragId, status);
    }
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((s) => {
        const meta = STATUS_META[s];
        const items = byStatus(s);
        return (
          <div
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(s);
            }}
            onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
            onDrop={() => drop(s)}
            className={`flex min-h-[120px] flex-col rounded-xl border p-2 transition ${
              overCol === s
                ? "border-[#6384ff]/50 bg-[#6384ff]/[0.06]"
                : "border-white/[0.08] bg-white/[0.02]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1.5 py-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.pill}`}
              >
                {meta.label}
              </span>
              <span className="text-[11px] text-zinc-500">{items.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((t) => (
                <BoardCard
                  key={t._id}
                  ticket={t}
                  dragging={dragId === t._id}
                  onOpen={() => onOpen(t._id)}
                  onDragStart={() => setDragId(t._id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                />
              ))}
              {items.length === 0 && (
                <p className="px-1.5 py-6 text-center text-[11px] text-zinc-600">
                  Nothing here
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({
  ticket,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  ticket: AdminTicket;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition ${
        dragging
          ? "border-[#6384ff]/50 opacity-50"
          : ticket.hasUnreadForAdmin
            ? "border-[#6384ff]/40 bg-[#6384ff]/[0.06] hover:bg-[#6384ff]/[0.1]"
            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <p className="flex-1 text-xs font-medium text-white line-clamp-2">
          {ticket.title}
        </p>
        {(ticket.priority === "high" || ticket.priority === "urgent") && (
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide ${
              ticket.priority === "urgent"
                ? "bg-red-500/15 text-red-300 border-red-500/30"
                : "bg-orange-500/15 text-orange-300 border-orange-500/30"
            }`}
          >
            {ticket.priority}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{ticket.userName}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <AssigneeChip ticket={ticket} />
        {ticket.aiGenerated ? (
          <span className="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-medium text-violet-300">
            ✨ AI
          </span>
        ) : (
          ticket.source === "chat" && (
            <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[8px] font-medium text-sky-300">
              Chat
            </span>
          )
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  tickets,
  onOpen,
}: {
  label: string;
  tickets: AdminTicket[];
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2 px-1">
        {label}
      </p>
      <div className="flex flex-col gap-2">
        {tickets.map((t) => (
          <Row key={t._id} ticket={t} onOpen={() => onOpen(t._id)} />
        ))}
      </div>
    </div>
  );
}

function Row({
  ticket,
  onOpen,
}: {
  ticket: AdminTicket;
  onOpen: () => void;
}) {
  const meta = STATUS_META[ticket.status];
  const Icon = meta.icon;
  return (
    <button
      onClick={onOpen}
      className={`group flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition hover:bg-white/[0.05] ${
        ticket.hasUnreadForAdmin
          ? "border-[#6384ff]/40 bg-[#6384ff]/[0.06]"
          : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          ticket.hasUnreadForAdmin ? "bg-[#6384ff]/15" : "bg-white/[0.06]"
        }`}
      >
        <Icon className="h-4 w-4 text-[#9fb5ff]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-sm truncate ${
              ticket.hasUnreadForAdmin
                ? "font-semibold text-white"
                : "font-medium text-white"
            }`}
          >
            {ticket.title}
          </p>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${meta.pill}`}
          >
            {meta.label}
          </span>
          {ticket.isGuest && (
            <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-300 border-amber-500/30">
              Guest
            </span>
          )}
          {ticket.aiGenerated ? (
            <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wide bg-violet-500/15 text-violet-300 border-violet-500/30">
              ✨ Created using AI
            </span>
          ) : (
            ticket.source === "chat" && (
              <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wide bg-sky-500/15 text-sky-300 border-sky-500/30">
                From chat
              </span>
            )
          )}
          {(ticket.priority === "high" || ticket.priority === "urgent") && (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
                ticket.priority === "urgent"
                  ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : "bg-orange-500/15 text-orange-300 border-orange-500/30"
              }`}
            >
              {ticket.priority}
            </span>
          )}
          {ticket.hasUnreadForAdmin && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#9fb5ff]">
              <AlertCircle className="h-3 w-3" />
              New
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 truncate">
          {ticket.messages.length > 0
            ? ticket.messages[ticket.messages.length - 1].body
            : ticket.description}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
          <span>{formatTimeAgo(ticket.lastActivityAt)}</span>
          <span>·</span>
          <span className="truncate">{ticket.userName}</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline truncate">{ticket.userEmail}</span>
          <span>·</span>
          <span>
            {ticket.messages.length} repl
            {ticket.messages.length === 1 ? "y" : "ies"}
          </span>
          <span>·</span>
          <AssigneeChip ticket={ticket} />
        </div>
      </div>
    </button>
  );
}

function DetailView({
  ticketId,
  onBack,
}: {
  ticketId: string;
  onBack: () => void;
}) {
  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  // "support_tickets: view" reads the queue; replying and changing status are
  // now separately grantable writes (page-manage still covers both).
  const { canDoAction } = useAdminAccess();
  const canReply = canDoAction("support_tickets", "reply-ticket");
  const canSetStatus = canDoAction("support_tickets", "set-status");
  const agents = useAssignableAgents();
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = async (silent = false) => {
    try {
      const t = await adminTicketsApi.get(ticketId);
      setTicket(t);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    const id = setInterval(() => load(true), 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !body.trim()) return;
    setSending(true);
    try {
      const updated = await adminTicketsApi.reply(ticket._id, body.trim());
      setTicket(updated);
      setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: AdminTicketStatus) => {
    if (!ticket || updating) return;
    setUpdating(true);
    try {
      const updated = await adminTicketsApi.update(ticket._id, { status });
      setTicket(updated);
      toast.success("Status updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#6384ff]" />
      </div>
    );
  }
  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to queue
        </button>
        <p className="text-sm text-red-300">{error || "Couldn't open ticket."}</p>
      </div>
    );
  }

  const meta = STATUS_META[ticket.status];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 pb-32">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </button>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">{ticket.title}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              #{ticket._id.slice(-6).toUpperCase()} ·{" "}
              {format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ticket.isGuest && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-300 border-amber-500/30">
                Guest
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.pill}`}
            >
              {meta.label}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-zinc-500">From</span>
            <span className="text-white">{ticket.userName}</span>
          </span>
          <a
            href={`mailto:${ticket.userEmail}`}
            className="inline-flex items-center gap-1 text-[#9fb5ff] hover:text-[#bccdff]"
          >
            <Mail className="h-3 w-3" />
            {ticket.userEmail}
          </a>
        </div>
      </div>

      {/* Assignee */}
      <AssigneePicker
        ticket={ticket}
        agents={agents}
        canAssign={canSetStatus}
        onChanged={setTicket}
      />

      {/* Status controls */}
      {canSetStatus && (
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
          Status
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_META) as AdminTicketStatus[]).map((s) => {
            const active = s === ticket.status;
            return (
              <button
                key={s}
                disabled={updating}
                onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  active
                    ? "bg-[#6384ff]/20 text-[#9fb5ff] border-[#6384ff]/40"
                    : "border-white/[0.1] text-zinc-400 hover:bg-white/[0.04]"
                }`}
              >
                Mark {STATUS_META[s].label.toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Original post */}
      <MessageBubble
        role="user"
        name={ticket.userName}
        body={ticket.description}
        attachments={ticket.attachments}
        createdAt={ticket.createdAt}
        highlight
      />

      {ticket.messages.length > 0 && (
        <div className="my-4 flex items-center gap-2">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            {ticket.messages.length} repl
            {ticket.messages.length === 1 ? "y" : "ies"}
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
      )}
      <div className="flex flex-col gap-3">
        {ticket.messages.map((m) => (
          <MessageBubble
            key={m._id}
            role={m.authorRole}
            name={m.authorName}
            body={m.body}
            attachments={m.attachments}
            createdAt={m.createdAt}
          />
        ))}
      </div>

      {canReply && ticket.status !== "closed" && (
        <form
          onSubmit={sendReply}
          className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
        >
          <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
            Reply as admin
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Reply to the user…"
            className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50 leading-relaxed resize-y"
          />
          <div className="mt-2 flex items-center justify-between">
            {ticket.isGuest ? (
              <p className="text-[10px] text-zinc-500">
                Guest ticket — they can&apos;t see thread replies yet; consider
                also emailing them.
              </p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6384ff] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7a96ff] disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send reply
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  name,
  body,
  attachments,
  createdAt,
  highlight = false,
}: {
  role: "user" | "admin";
  name: string;
  body: string;
  attachments: { key: string; url?: string; name?: string; contentType?: string }[];
  createdAt: string;
  highlight?: boolean;
}) {
  const isAdmin = role === "admin";
  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isAdmin ? "bg-[#6384ff]/15" : "bg-white/[0.06]"
        }`}
      >
        {isAdmin ? (
          <Sparkles className="h-3.5 w-3.5 text-[#9fb5ff]" />
        ) : (
          <span className="text-[11px] font-semibold text-zinc-300">
            {(name || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white truncate">{name}</span>
          {isAdmin && (
            <span className="rounded-full bg-[#6384ff]/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#9fb5ff]">
              Admin
            </span>
          )}
          <span className="text-[10px] text-zinc-600">
            {format(new Date(createdAt), "MMM d · h:mm a")}
          </span>
        </div>
        <div
          className={`mt-1.5 rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            highlight
              ? "border-white/[0.1] bg-white/[0.04] text-zinc-100"
              : isAdmin
                ? "border-[#6384ff]/20 bg-[#6384ff]/[0.06] text-zinc-100"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-200"
          }`}
        >
          {body}
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => {
              const isImg = a.contentType?.startsWith("image/") && a.url;
              return isImg ? (
                <a
                  key={a.key}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-white/[0.1] hover:border-white/[0.2] transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.name || ""}
                    className="max-h-60 max-w-[260px] object-cover"
                  />
                </a>
              ) : (
                <a
                  key={a.key}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.06]"
                >
                  <span className="truncate max-w-[160px]">
                    {a.name || a.key.split("/").pop()}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const diffMin = Math.round((Date.now() - t) / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}
