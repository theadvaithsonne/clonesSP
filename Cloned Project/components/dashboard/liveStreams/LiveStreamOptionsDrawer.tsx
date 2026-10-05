"use client";

/**
 * Per-row action drawer for the founder Live Streams grid.
 *
 * Everything a founder can do to one stream, in one place, so the table's
 * cells stay pure data. The drawer is callback-driven — it owns presentation
 * and its own sub-panels (Links, Email Reminders, WhatsApp Reminders) and
 * hands the rest back to the page, which already holds the modals and the
 * mutations.
 *
 * Start is deliberately conditional: it renders only while the stream's
 * backend status is `not_started`. Offering "Start" on a row the table itself
 * labels Active or Completed is the contradiction most likely to cost a
 * founder a live session. An `active` row gets Join instead — the way back
 * into a stream that is still live after the host's tab or browser closed.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import type { FounderStreamRow } from "@/lib/feed-api";
import { DrawerCard, DrawerListSkeleton, DrawerShell } from "./DrawerShell";

export interface LiveStreamOptionsHandlers {
  onStart: (row: FounderStreamRow) => void;
  /**
   * Rejoin a stream that is live right now — offered only on `active` rows.
   * Distinct from `onStart`: starting rotates the session / generates the
   * meeting, joining must do neither.
   */
  onJoin?: (row: FounderStreamRow) => void;
  onAnalytics: (row: FounderStreamRow) => void;
  onEdit: (row: FounderStreamRow) => void;
  /**
   * Edit THIS session only — offered on recurring session rows, which are the
   * only rows that have a session to edit. Separate from `onEdit`, which opens
   * the series and would apply a change to every session under it.
   */
  onEditSession?: (row: FounderStreamRow) => void;
  onDelete: (row: FounderStreamRow) => void;
  /** Undo a delete. Only offered on rows whose status is already `deleted`. */
  onRestore: (row: FounderStreamRow) => void;
  onEarnGpt: (row: FounderStreamRow) => void;
  onFunnels: (row: FounderStreamRow) => void;
  /** Copy targets for the Links sub-panel. */
  links: {
    join: (row: FounderStreamRow) => string;
    checkout: (row: FounderStreamRow) => string;
    affiliate: (row: FounderStreamRow) => string;
  };
}

type Panel = "root" | "links" | "email" | "whatsapp";

/**
 * Reminder schedules are configured here but NOT yet delivered — there is no
 * workshop-reminder scheduler in the backend. The config is kept per stream in
 * localStorage so a founder's setup survives a reload, and the panel says
 * plainly that nothing is being sent. A silent "Saved" on a reminder that
 * never fires is worse than no feature at all.
 */
const REMINDER_KEY = (workshopId: string, channel: "email" | "whatsapp") =>
  `live-stream-reminders:${channel}:${workshopId}`;

const OFFSET_OPTIONS = [
  { id: "1w", label: "1 week before" },
  { id: "1d", label: "1 day before" },
  { id: "1h", label: "1 hour before" },
  { id: "15m", label: "15 minutes before" },
  { id: "start", label: "When it goes live" },
];

interface ReminderConfig {
  enabled: boolean;
  offsets: string[];
  message: string;
}

const DEFAULT_REMINDER: ReminderConfig = {
  enabled: false,
  offsets: ["1d", "1h"],
  message: "",
};

function readReminder(
  workshopId: string,
  channel: "email" | "whatsapp",
): ReminderConfig {
  try {
    const raw = localStorage.getItem(REMINDER_KEY(workshopId, channel));
    if (!raw) return { ...DEFAULT_REMINDER };
    return { ...DEFAULT_REMINDER, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_REMINDER };
  }
}

/**
 * Artwork ships as pre-coloured SVGs in /public/options_svg — white glyphs,
 * with delete.svg already drawn in #FF2D55. They're rendered as <img> rather
 * than inlined so the colours stay exactly as designed; nothing here tints
 * them, which is why the delete row needs no icon override.
 */
function OptionIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      title={alt}
      className="h-[22px] w-[22px] shrink-0 object-contain"
    />
  );
}

export function LiveStreamOptionsDrawer({
  row,
  onClose,
  handlers,
  loading,
}: {
  /** The row whose options are open; null closes the drawer. */
  row: FounderStreamRow | null;
  onClose: () => void;
  handlers: LiveStreamOptionsHandlers;
  /**
   * Show placeholders instead of the action list.
   *
   * The row arrives from the table synchronously, so this is normally false —
   * it exists for the case where the drawer is opened from a deep link and the
   * row still has to be fetched. Passed through rather than assumed, because a
   * drawer that renders "Start" against a half-loaded row would offer an
   * action the status hasn't been checked for.
   */
  loading?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>("root");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (row) {
      setPanel("root");
      setSearching(false);
      setQuery("");
    }
  }, [row?._id]);

  const items = useMemo(() => {
    if (!row) return [];
    // Order, titles and subtitles are the Figma's, verbatim. They read as
    // instructions rather than labels ("This action cannot be undone"), which
    // is the point — the drawer is where a founder does the irreversible
    // things, so each row says what it will do before they tap it.
    // A deleted stream can't be started, and its Delete row would be a no-op.
    // Restore takes that slot so the delete stays reversible now that the
    // Trash page (the old way back) is gone.
    const deleted = row.status === "deleted";
    const all = [
      ...(row.status === "not_started"
        ? [
            {
              id: "start",
              title: "Start",
              description: "This would initiate the live stream.",
              icon: "/options_svg/start.svg",
              run: () => {
                handlers.onStart(row);
                onClose();
              },
            },
          ]
        : []),
      ...(row.status === "active" && handlers.onJoin
        ? [
            {
              id: "join",
              title: "Join",
              description: "This live stream is running — rejoin it as host.",
              icon: "/options_svg/start.svg",
              run: () => {
                handlers.onJoin!(row);
                onClose();
              },
            },
          ]
        : []),
      {
        id: "links",
        title: "Links",
        description: "Copy affiliate links for joining this live stream",
        icon: "/options_svg/share.svg",
        run: () => setPanel("links"),
      },
      {
        id: "email",
        title: "Email Reminders",
        description: "Configure email reminders for all the enrollees",
        icon: "/options_svg/emailreminder.svg",
        run: () => setPanel("email"),
      },
      {
        id: "whatsapp",
        title: "WhatsApp Reminders",
        description: "Configure WhatsApp reminders for all the enrollees",
        icon: "/options_svg/whatsapp.svg",
        run: () => setPanel("whatsapp"),
      },
      {
        id: "profile",
        title: "View Profile",
        description: "View in-depth analytics on this one live stream",
        icon: "/options_svg/profile_info.svg",
        run: () => {
          handlers.onAnalytics(row);
          onClose();
        },
      },
      // Edit means "edit what this row IS". On a session row that is the one
      // session — opening the series form there would apply a title change to
      // all 45 of them, which is the mistake this drawer must not make easy.
      // The series form stays reachable from Series Level Options in the table
      // header, whose row carries no `sessionDate` and so lands on `onEdit`.
      row.sessionDate && handlers.onEditSession
        ? {
            id: "edit",
            title: "Edit",
            description: "Title, timing, speaker and cover — this session only",
            icon: "/options_svg/edit.svg",
            run: () => {
              handlers.onEditSession!(row);
              onClose();
            },
          }
        : {
            id: "edit",
            title: "Edit",
            description: "The meta data of this live stream",
            icon: "/options_svg/edit.svg",
            run: () => {
              handlers.onEdit(row);
              onClose();
            },
          },
      {
        id: "earngpt",
        title: "Train EarnGPT",
        description: "Who you want your live stream to be referred to",
        icon: "/options_svg/train_earngpt.svg",
        run: () => {
          handlers.onEarnGpt(row);
          onClose();
        },
      },
      {
        id: "funnel",
        title: "Post Enrollment/Attendee Funnel",
        description: "Create a sequence of steps after someone enrolls",
        icon: "/options_svg/postenrollment.svg",
        run: () => {
          handlers.onFunnels(row);
          onClose();
        },
      },
      deleted
        ? {
            id: "restore",
            title: "Restore",
            description: "Bring this live stream back into circulation",
            icon: "/options_svg/start.svg",
            run: () => {
              handlers.onRestore(row);
              onClose();
            },
          }
        : {
            id: "delete",
            title: "Delete",
            description: "This action cannot be undone",
            icon: "/options_svg/delete.svg",
            destructive: true,
            run: () => {
              handlers.onDelete(row);
              onClose();
            },
          },
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((i) =>
      `${i.title} ${i.description}`.toLowerCase().includes(q),
    );
  }, [row, query, handlers, onClose]);

  const title =
    panel === "root"
      ? "Options"
      : panel === "links"
        ? "Links"
        : panel === "email"
          ? "Email Reminders"
          : "WhatsApp Reminders";

  return (
    <DrawerShell
      open={!!row}
      title={title}
      onBack={() => (panel === "root" ? onClose() : setPanel("root"))}
      onClose={onClose}
      // Search only makes sense against the nine actions, not inside a
      // sub-panel's form.
      searching={searching}
      onToggleSearch={panel === "root" ? () => setSearching((v) => !v) : undefined}
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search actions…"
      loading={loading}
      skeleton={<DrawerListSkeleton rows={9} />}
    >
      {!row ? null : panel === "root" ? (
        <DrawerCard>
          {items.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-white/45">
              No actions match that search.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.run}
                className="flex w-full cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
              >
                <OptionIcon src={item.icon} alt={item.title} />
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[15px] font-semibold ${
                      (item as any).destructive
                        ? "text-[#EF4444]"
                        : "text-white"
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="truncate text-[13px] text-white/45">
                    {item.description}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </button>
            ))
          )}
        </DrawerCard>
      ) : panel === "links" ? (
        <LinksPanel row={row} links={handlers.links} />
      ) : (
        <RemindersPanel row={row} channel={panel} />
      )}
    </DrawerShell>
  );
}

/* ── Links ──────────────────────────────────────────────────────────────── */

function LinksPanel({
  row,
  links,
}: {
  row: FounderStreamRow;
  links: LiveStreamOptionsHandlers["links"];
}) {
  const entries = [
    {
      id: "join",
      label: "Join link",
      hint: "Send this to someone already enrolled",
      value: links.join(row),
    },
    {
      id: "checkout",
      label: "Checkout link",
      hint: "Takes a buyer straight to payment",
      value: links.checkout(row),
    },
    {
      id: "affiliate",
      label: "Affiliate link",
      hint: "Your referral link — commissions attribute to you",
      value: links.affiliate(row),
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((e) => (
        <div
          key={e.id}
          className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5"
        >
          <div className="text-[14px] font-semibold text-white">{e.label}</div>
          <div className="text-[12px] text-white/45">{e.hint}</div>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              readOnly
              value={e.value}
              onFocus={(ev) => ev.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#26262A] bg-black/40 px-2.5 text-[12px] text-white/70 outline-none"
            />
            <CopyButton value={e.value} label={e.label} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the text and copy manually");
        }
      }}
      className="grid h-9 w-9 shrink-0 place-items-center rim-light rim-light-strong rounded-lg bg-white/[0.04] text-white/80 transition hover:bg-white/[0.1]"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#22C55E]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

/* ── Reminders ──────────────────────────────────────────────────────────── */

function RemindersPanel({
  row,
  channel,
}: {
  row: FounderStreamRow;
  channel: "email" | "whatsapp";
}) {
  const [config, setConfig] = useState<ReminderConfig>({ ...DEFAULT_REMINDER });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setConfig(readReminder(row.workshopId, channel));
    setDirty(false);
  }, [row.workshopId, channel]);

  const save = () => {
    try {
      localStorage.setItem(
        REMINDER_KEY(row.workshopId, channel),
        JSON.stringify(config),
      );
      setDirty(false);
      toast.success("Reminder schedule saved on this device");
    } catch {
      toast.error("Couldn't save the reminder schedule");
    }
  };

  const toggleOffset = (id: string) => {
    setDirty(true);
    setConfig((c) => ({
      ...c,
      offsets: c.offsets.includes(id)
        ? c.offsets.filter((o) => o !== id)
        : [...c.offsets, id],
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Nothing is scheduled server-side yet — say so here rather than let a
          green "Saved" imply messages are going out. */}
      <div className="rounded-2xl border border-brand/25 bg-brand/[0.06] px-4 py-3 text-[12px] leading-relaxed text-brand/90">
        This schedule is saved on this device only. Automatic{" "}
        {channel === "email" ? "email" : "WhatsApp"} delivery for live streams
        isn&apos;t live yet, so nothing is sent from here.
      </div>

      <label className="flex items-center justify-between rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5">
        <span>
          <span className="block text-[14px] font-semibold text-white">
            Enable reminders
          </span>
          <span className="block text-[12px] text-white/45">
            Applies to everyone enrolled in this stream
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => {
            setDirty(true);
            setConfig((c) => ({ ...c, enabled: !c.enabled }));
          }}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            config.enabled ? "bg-brand" : "bg-white/[0.14]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${
              config.enabled ? "left-[22px] bg-black" : "left-0.5 bg-zinc-400"
            }`}
          />
        </button>
      </label>

      <div className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5">
        <div className="text-[14px] font-semibold text-white">Send at</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {OFFSET_OPTIONS.map((o) => {
            const on = config.offsets.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleOffset(o.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  on
                    ? "bg-brand text-brand-foreground"
                    : "bg-[rgba(114,114,114,0.32)] text-white/70 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5">
        <div className="text-[14px] font-semibold text-white">Message</div>
        <div className="text-[12px] text-white/45">
          Leave blank to use the default reminder copy.
        </div>
        <textarea
          value={config.message}
          onChange={(e) => {
            setDirty(true);
            setConfig((c) => ({ ...c, message: e.target.value }));
          }}
          rows={4}
          placeholder={`Hi {{name}}, "${row.title}" starts soon.`}
          className="mt-2.5 w-full resize-none rounded-lg border border-[#26262A] bg-black/40 p-2.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-brand/40"
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!dirty}
        className="h-11 rounded-xl bg-brand text-[14px] font-semibold text-brand-foreground transition enabled:hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] disabled:opacity-40"
      >
        {dirty ? "Save schedule" : "Saved"}
      </button>
    </div>
  );
}
