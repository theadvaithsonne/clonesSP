"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  LifeBuoy,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { ticketsApi, type Ticket, type TicketStatus } from "@/lib/api/tickets";

const STATUS_META: Record<
  TicketStatus,
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

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await ticketsApi.listMine();
      setTickets(data.tickets);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    // Light polling — admin replies show up without manual refresh.
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#08080e] text-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-8 pb-32">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-[#6384ff]" />
              Support
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              File an issue — we&apos;ll reply right here.
            </p>
          </div>
          <Link
            href="/tickets/new"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#6384ff] px-3 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#7a96ff]"
          >
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </header>

        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            Couldn&apos;t load your tickets — try refreshing.
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-[#6384ff]/70 mb-3" />
            <p className="text-sm text-zinc-300 mb-1">No support tickets yet</p>
            <p className="text-xs text-zinc-500">
              Click <span className="text-zinc-300">New ticket</span> to ask
              the team anything — a screenshot helps if it&apos;s a UI issue.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map((t) => (
              <Row key={t._id} ticket={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ ticket }: { ticket: Ticket }) {
  const meta = STATUS_META[ticket.status];
  const Icon = meta.icon;
  return (
    <Link
      href={`/tickets/${ticket._id}`}
      className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:bg-white/[0.05] ${
        ticket.hasUnreadForUser
          ? "border-[#6384ff]/40 bg-[#6384ff]/[0.06]"
          : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          ticket.hasUnreadForUser ? "bg-[#6384ff]/15" : "bg-white/[0.06]"
        }`}
      >
        <Icon className="h-4 w-4 text-[#9fb5ff]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-sm truncate ${
              ticket.hasUnreadForUser
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
          {ticket.hasUnreadForUser && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#9fb5ff]">
              <AlertCircle className="h-3 w-3" />
              New reply
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 truncate">
          {ticket.messages.length > 0
            ? ticket.messages[ticket.messages.length - 1].body
            : ticket.description}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
          <span>{formatTimeAgo(ticket.lastActivityAt)}</span>
          <span>·</span>
          <span>
            {ticket.messages.length} repl
            {ticket.messages.length === 1 ? "y" : "ies"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
        />
      ))}
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

// Loader2 imported but not used unless we ever surface inline spinners — keep
// it available without flagging unused-imports.
const _Loader2 = Loader2;
