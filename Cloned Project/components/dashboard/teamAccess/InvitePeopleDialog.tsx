"use client";

/**
 * Invite people — multi-email entry plus per-module Admin / No access toggles.
 *
 * One constraint shapes this whole dialog: `POST /rbac/grants` and
 * `/rbac/grants/bulk` take **user ids**, not emails (`{ modules, userId }` /
 * `{ modules, userIds }` — see src/routes/rbac.ts). So every address typed here
 * has to resolve to somebody already in the office before it can be granted
 * anything. Addresses that don't resolve are surfaced as such instead of being
 * dropped on the floor — inviting a stranger into the org is the `/invites`
 * flow (Office Settings → Invitees), a different system.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Clock3,
  Loader2,
  Mail,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createBulkGrants,
  isValidEmail,
  notifyRbacChanged,
  type MemberRow,
  type ModuleKey,
  type RbacError,
  type RbacModule,
} from "@/lib/rbac-api";
import { MemberAvatar, moduleIcon } from "./shared";

/** What happened when we tried to match a typed address to the org roster. */
type ChipState = "ok" | "invalid" | "unknown" | "not-assignable" | "self";

type Chip = {
  /** Raw text as typed, lowercased for matching. */
  value: string;
  state: ChipState;
  member?: MemberRow;
};

const CHIP_COPY: Record<ChipState, string | null> = {
  ok: null,
  invalid: "Not a valid email",
  unknown: "Not in this office yet",
  "not-assignable": "Founders and guests can't be assigned modules",
  self: "You can't assign modules to yourself",
};

function classify(raw: string, members: MemberRow[]): Chip {
  const value = raw.trim().toLowerCase();
  if (!isValidEmail(value)) return { value, state: "invalid" };

  const member = members.find((m) => (m.email || "").toLowerCase() === value);
  if (!member) return { value, state: "unknown" };
  if (member.isSelf) return { value, state: "self", member };
  if (!member.editable) return { value, state: "not-assignable", member };
  return { value, state: "ok", member };
}

/* ------------------------------------------------------------------ */
/* Binary segmented control                                            */
/* ------------------------------------------------------------------ */

function AccessToggle({
  value,
  onChange,
  size = "md",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-white/10 bg-[#121216] p-0.5",
        size === "sm" && "scale-95"
      )}
    >
      {[
        { on: true, label: "Admin" },
        { on: false, label: "No access" },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.on)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
            value === opt.on
              ? opt.on
                ? "bg-[#EF4444]/15 text-[#F87171]"
                : "bg-white/[0.07] text-zinc-300"
              : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              value === opt.on
                ? opt.on
                  ? "bg-[#F87171]"
                  : "bg-zinc-400"
                : "border border-zinc-600"
            )}
          />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export default function InvitePeopleDialog({
  open,
  modules,
  members,
  onClose,
  onInvited,
}: {
  open: boolean;
  /** Catalog from `GET /rbac/modules` — never hardcoded. */
  modules: RbacModule[];
  /** Full org roster, used to resolve typed emails to user ids. */
  members: MemberRow[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Record<ModuleKey, boolean>>({});
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  /** Highlighted roster suggestion, for arrow-key + Enter selection. */
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /* --- reset whenever the dialog reopens --------------------------- */
  useEffect(() => {
    if (!open) return;
    setChips([]);
    setDraft("");
    setNote("");
    setPicked(Object.fromEntries(modules.map((m) => [m.key, false])));
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [open, modules]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, sending]);

  /* --- the global bottom dock would sit on top of this modal -------- */
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(open ? "bottom-tab:hide" : "bottom-tab:show")
    );
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [open]);

  /* --- chip entry --------------------------------------------------- */

  const addChips = useCallback(
    (raw: string) => {
      // Handles both typing one address and pasting a whole column of them.
      const parts = raw
        .split(/[\s,;]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (!parts.length) return;
      setChips((prev) => {
        const seen = new Set(prev.map((c) => c.value));
        const next = [...prev];
        for (const part of parts) {
          const chip = classify(part, members);
          if (seen.has(chip.value)) continue;
          seen.add(chip.value);
          next.push(chip);
        }
        return next;
      });
      setDraft("");
    },
    [members]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setActiveIdx((i) =>
        e.key === "ArrowDown"
          ? Math.min(suggestions.length - 1, i + 1)
          : Math.max(0, i - 1)
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      // A highlighted roster hit wins over the raw text — typing "br" and
      // hitting Enter should pick brock@…, not chip the literal "br".
      const hit = suggestions[activeIdx];
      if (hit) addChips(hit.email);
      else if (draft.trim()) addChips(draft);
      return;
    }

    // Space is only a delimiter once the draft is already a whole address.
    // Otherwise it would break searching the roster by full name.
    const isDelimiter =
      e.key === "," ||
      e.key === ";" ||
      (e.key === " " && isValidEmail(draft));
    if (isDelimiter && draft.trim()) {
      e.preventDefault();
      addChips(draft);
      return;
    }

    if (e.key === "Backspace" && !draft && chips.length) {
      setChips((prev) => prev.slice(0, -1));
    }
  };

  const removeChip = (value: string) =>
    setChips((prev) => prev.filter((c) => c.value !== value));

  /* --- roster suggestions ------------------------------------------- */

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const already = new Set(chips.map((c) => c.value));
    return members
      .filter(
        (m) =>
          m.editable &&
          !m.isSelf &&
          !already.has((m.email || "").toLowerCase()) &&
          ((m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [draft, members, chips]);

  // Retyping restarts the highlight at the top of the fresh list.
  useEffect(() => {
    setActiveIdx(0);
  }, [draft]);

  /* --- derived ------------------------------------------------------ */

  const validChips = chips.filter((c) => c.state === "ok");

  /**
   * What the chipped people already have, per module. The backend would just
   * return these under `skipped: ALREADY_GRANTED` / `alreadyPending`, but that
   * is a silent no-op after the fact — better to say so before sending.
   */
  const moduleState = useMemo(() => {
    const map: Record<
      ModuleKey,
      { granted: number; pending: number; total: number; settled: boolean }
    > = {};
    for (const m of modules) {
      let granted = 0;
      let pending = 0;
      for (const c of validChips) {
        if (c.member?.permissions?.[m.key] === true) granted++;
        else if (c.member?.pending?.[m.key]) pending++;
      }
      const total = validChips.length;
      map[m.key] = {
        granted,
        pending,
        total,
        // Nothing left to offer: everyone chipped either holds it already or
        // has an unanswered offer for it.
        settled: total > 0 && granted + pending === total,
      };
    }
    return map;
  }, [modules, validChips]);

  const selectable = modules.filter((m) => !moduleState[m.key]?.settled);
  const pickedModules = selectable.filter((m) => picked[m.key]).map((m) => m.key);
  const allAdmin =
    selectable.length > 0 && selectable.every((m) => picked[m.key]);
  const canSend = validChips.length > 0 && pickedModules.length > 0 && !sending;

  const setAllModules = (on: boolean) =>
    setPicked((prev) => {
      const next = { ...prev };
      for (const m of selectable) next[m.key] = on;
      return next;
    });

  // Chipping someone who already holds a module shouldn't leave it armed.
  useEffect(() => {
    setPicked((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const m of modules) {
        if (moduleState[m.key]?.settled && next[m.key]) {
          next[m.key] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [moduleState, modules]);

  /* --- submit ------------------------------------------------------- */

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const userIds = validChips.map((c) => c.member!.userId);
      const res = await createBulkGrants(userIds, pickedModules);

      if (res.createdCount > 0) {
        toast.success(
          `${res.createdCount} invite${res.createdCount === 1 ? "" : "s"} sent`,
          { description: "Each expires in 24 hours if it goes unanswered." }
        );
      }
      // Bulk never fails wholesale — say who was left out and why.
      if (res.skipped.length) {
        const reasons = Array.from(new Set(res.skipped.map((s) => s.reason)));
        toast.info(`${res.skipped.length} skipped`, {
          description: reasons.join(", "),
        });
      }
      if (!res.createdCount && !res.skipped.length) {
        toast.info("Nothing to send — they already hold those modules.");
      }

      notifyRbacChanged();
      onInvited();
      onClose();
    } catch (err) {
      toast.error((err as RbacError)?.message || "Couldn't send the invites.");
    } finally {
      setSending(false);
    }
  };

  const blockedCount = chips.length - validChips.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !sending && onClose()}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl border border-brand/20 bg-brand/10 p-2.5">
                  <UserPlus className="h-5 w-5 text-brand" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">Invite people</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Invite new members to collaborate in your operator console.
                  </p>
                </div>
              </div>
              <button
                onClick={() => !sending && onClose()}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Email chips */}
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Email addresses
              </label>
              <div
                onClick={() => inputRef.current?.focus()}
                className="flex min-h-[48px] flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#1c1c24] p-2 focus-within:border-brand/40 cursor-text"
              >
                {chips.map((chip) => {
                  const bad = chip.state !== "ok";
                  return (
                    <span
                      key={chip.value}
                      title={CHIP_COPY[chip.state] || undefined}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
                        bad
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                          : "border-white/10 bg-white/[0.05] text-zinc-200"
                      )}
                    >
                      {chip.member ? (
                        <MemberAvatar
                          name={chip.member.name}
                          email={chip.member.email}
                          src={chip.member.profilePicture}
                          size={16}
                        />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      {chip.member?.name || chip.value}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeChip(chip.value);
                        }}
                        className="rounded p-0.5 transition-colors hover:bg-white/10 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  onBlur={() => {
                    // Only commit raw text on blur when there is no roster hit
                    // to pick. Suggestion rows suppress blur via onMouseDown,
                    // but this keeps a stray blur from chipping a half-typed
                    // fragment like "br" while the list is still open.
                    if (suggestions.length === 0 && draft.trim()) addChips(draft);
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (/[\s,;]/.test(text)) {
                      e.preventDefault();
                      addChips(text);
                    }
                  }}
                  placeholder={chips.length ? "" : "name@company.com, another@company.com"}
                  className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              {/* Roster suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#1c1c24]">
                  {suggestions.map((m, i) => {
                    const held = Object.entries(m.permissions || {})
                      .filter(([, v]) => v === true)
                      .map(([k]) => modules.find((x) => x.key === k)?.label || k);
                    const waiting = Object.keys(m.pending || {}).map(
                      (k) => modules.find((x) => x.key === k)?.label || k
                    );

                    return (
                      <button
                        key={m.userId}
                        type="button"
                        // Blur fires before click, so without this the raw draft
                        // ("br") gets chipped and the click never lands on the row.
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => addChips(m.email)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer",
                          i === activeIdx ? "bg-white/[0.07]" : "hover:bg-white/5"
                        )}
                      >
                        <MemberAvatar
                          name={m.name}
                          email={m.email}
                          src={m.profilePicture}
                          size={24}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-white">
                            {m.name || m.email}
                          </span>
                          <span className="block truncate text-[11px] text-zinc-500">
                            {m.email}
                          </span>
                        </span>
                        {/* What they already hold, so you don't re-offer it */}
                        {(held.length > 0 || waiting.length > 0) && (
                          <span className="flex shrink-0 flex-wrap justify-end gap-1">
                            {held.map((label) => (
                              <span
                                key={`h-${label}`}
                                className="rounded-full border border-[#EF4444]/30 bg-[#EF4444]/10 px-1.5 py-0.5 text-[9px] text-[#F87171]"
                              >
                                {label}
                              </span>
                            ))}
                            {waiting.map((label) => (
                              <span
                                key={`w-${label}`}
                                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300"
                              >
                                {label} · pending
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Chip problems */}
              {blockedCount > 0 && (
                <div className="mt-2 space-y-1">
                  {Array.from(
                    new Set(
                      chips.filter((c) => c.state !== "ok").map((c) => c.state)
                    )
                  ).map((state) => (
                    <p
                      key={state}
                      className="flex items-start gap-1.5 text-[11px] text-rose-300"
                    >
                      <AlertCircle className="mt-px h-3 w-3 shrink-0" />
                      <span>
                        {CHIP_COPY[state]}
                        {state === "unknown" && (
                          <span className="text-zinc-500">
                            {" "}
                            — add them under Office Settings → Invitees first,
                            then grant modules here.
                          </span>
                        )}
                      </span>
                    </p>
                  ))}
                </div>
              )}

              {/* Modules */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Assign modules
                </label>
                <AccessToggle
                  value={allAdmin}
                  onChange={setAllModules}
                  size="sm"
                />
              </div>

              <div className="mt-2 space-y-1.5">
                {modules.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-[#1c1c24] px-4 py-3 text-xs text-zinc-500">
                    Loading modules…
                  </p>
                ) : (
                  modules.map((m) => {
                    const Icon = moduleIcon(m.key);
                    const on = !!picked[m.key];
                    const st = moduleState[m.key];
                    const many = (st?.total ?? 0) > 1;

                    // Everyone chipped already holds it or already has an
                    // unanswered offer — nothing to send, so say what's there.
                    const settledNote = !st?.settled
                      ? null
                      : st.pending === st.total
                        ? many
                          ? `All ${st.total} already invited`
                          : "Invite already sent"
                        : st.granted === st.total
                          ? many
                            ? `All ${st.total} already admins`
                            : "Already admin"
                          : "Already covered";

                    return (
                      <div
                        key={m.key}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1c1c24] px-4 py-2.5",
                          st?.settled && "opacity-60"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              on ? "text-[#F87171]" : "text-zinc-500"
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-white">
                              {m.label}
                            </span>
                            {/* Partial overlap still sends — just flag the skips */}
                            {!st?.settled &&
                              (st?.granted ?? 0) + (st?.pending ?? 0) > 0 && (
                                <span className="block text-[10px] text-zinc-500">
                                  {st!.granted > 0 && `${st!.granted} already admin`}
                                  {st!.granted > 0 && st!.pending > 0 && " · "}
                                  {st!.pending > 0 && `${st!.pending} pending`}
                                </span>
                              )}
                          </span>
                        </span>

                        {settledNote ? (
                          <span className="shrink-0 rounded-lg border border-[#EF4444]/25 bg-[#EF4444]/10 px-2.5 py-1 text-[11px] font-medium text-[#F87171]">
                            {settledNote}
                          </span>
                        ) : (
                          <AccessToggle
                            value={on}
                            onChange={(next) =>
                              setPicked((prev) => ({ ...prev, [m.key]: next }))
                            }
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Personal note.
                  NOTE: `POST /rbac/grants/bulk` accepts `{ modules, userIds }`
                  only — there is no field to carry this, and the notification
                  the backend raises is templated. The text is collected per the
                  spec but is NOT delivered anywhere today; wiring it needs a
                  backend change, which is out of scope here. */}
              <label className="mb-2 mt-6 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Personal note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add a personal note (optional)"
                className="w-full resize-none rounded-xl border border-white/10 bg-[#1c1c24] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand/40 focus:outline-none"
              />

              {/* 24h notice */}
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[11px] leading-relaxed text-amber-200/80">
                  <span className="font-medium text-amber-200">
                    Invitations expire in 24 hours.
                  </span>{" "}
                  Access stays off until the person accepts. If the window
                  closes you can resend from the table to restart the clock.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
              <span className="max-w-[55%] text-[11px] text-zinc-500">
                {validChips.length > 0 && selectable.length === 0
                  ? "Everything is already granted or invited — change access from the table."
                  : validChips.length > 0 && pickedModules.length > 0
                    ? `${validChips.length} × ${pickedModules.length} module${pickedModules.length === 1 ? "" : "s"}`
                    : "Add a recipient and pick at least one module"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => !sending && onClose()}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!canSend}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : validChips.length > 0 ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Send {validChips.length || ""} invite
                  {validChips.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
