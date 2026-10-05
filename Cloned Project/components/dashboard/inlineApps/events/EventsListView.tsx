"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  MapPin,
  Plus,
  Search,
  Ticket,
  Users,
  Loader2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, GOLD } from "./ui";
import { listEvents } from "./api";
import type { EventProgram, EventStatus } from "./types";

const FILTERS: Array<{ value: "" | EventStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Live" },
  { value: "completed", label: "Past" },
];

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#22222b", fg: "#9fa0b8", label: "Draft" },
  published: { bg: "#1f2d1f", fg: "#4ade80", label: "Live" },
  ongoing: { bg: "#2d2a1f", fg: "#FACC15", label: "Happening now" },
  completed: { bg: "#22222b", fg: "#7c7d94", label: "Completed" },
  cancelled: { bg: "#3a1f1f", fg: "#f87171", label: "Cancelled" },
};

export default function EventsListView({
  onCreate,
  onOpen,
}: {
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"" | EventStatus>("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEvents({ status: status || undefined, search });
      setEvents(res.events || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load events");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="flex h-full flex-col bg-[#0c0c0e]">
      {/* No page title: the sidebar switcher and the bottom bar already say
          where you are, so a heading here is chrome that eats vertical space. */}
      <header className="border-b border-[#1c1c24] px-8 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events"
              className="w-64 rounded-lg border border-[#2a2a35] bg-[#141418] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#4f5065] focus:border-[#4a4a5c] focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value || "all"}
                type="button"
                onClick={() => setStatus(f.value)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs transition-colors",
                  status === f.value
                    ? "bg-[#1f1f28] text-white"
                    : "text-[#7c7d94] hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button className="ml-auto" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Create event
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" strokeWidth={1.25} />}
            title={search || status ? "Nothing matches that" : "No events yet"}
            description={
              search || status
                ? "Try a different filter or search term."
                : "Set up your first event — details, venue and tickets in three steps."
            }
            action={
              !search && !status ? (
                <Button onClick={onCreate}>
                  <Plus className="h-4 w-4" />
                  Create event
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((e) => {
              const badge = STATUS_STYLE[e.status] || STATUS_STYLE.draft;
              return (
                <Card
                  key={e._id}
                  onClick={() => onOpen(e._id)}
                  className="group cursor-pointer overflow-hidden transition-colors hover:border-[#3a3a48]"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1a1a22]">
                    {e.bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.bannerUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          background: `radial-gradient(120% 90% at 20% 0%, ${GOLD}18 0%, transparent 60%), #16161d`,
                        }}
                      />
                    )}
                    <span
                      className="absolute left-3 top-3 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3 className="line-clamp-1 font-medium text-white">{e.name}</h3>
                    <div className="mt-2.5 space-y-1.5 text-xs text-[#7c7d94]">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(e.startsAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        {e.format === "virtual" ? (
                          <>
                            <Globe className="h-3.5 w-3.5" />
                            Online
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3.5 w-3.5" />
                            {e.venue?.city || e.venue?.name || "Venue TBC"}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-4 border-t border-[#1c1c24] pt-4 text-xs">
                      <span className="flex items-center gap-1.5 text-[#c7c7da]">
                        <Ticket className="h-3.5 w-3.5" style={{ color: GOLD }} />
                        {e.ticketsSold ?? 0}/{e.totalCapacity}
                      </span>
                      <span className="flex items-center gap-1.5 text-[#c7c7da]">
                        <Users className="h-3.5 w-3.5" />
                        {e.registrations ?? 0}
                      </span>
                      {(e.pendingApproval ?? 0) > 0 && (
                        <span
                          className="ml-auto rounded-md px-2 py-0.5"
                          style={{ background: `${GOLD}1f`, color: GOLD }}
                        >
                          {e.pendingApproval} to review
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
