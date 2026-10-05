"use client";

// Tickets and add-ons.
//
// Both are rows in `event_ticket_tiers`, separated by `kind`. They share the
// inventory counter, the sales window, the pricing rules and the checkout
// path — the only real difference is where a buyer meets them, so giving
// add-ons their own collection would have meant maintaining two of everything.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GripVertical,
  Loader2,
  PackagePlus,
  Pause,
  Pencil,
  Play,
  Plus,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  CapacityMeter,
  Card,
  EmptyState,
  GOLD,
  Modal,
  Select,
  TextArea,
  TextInput,
  Toggle,
  formatMoney,
  fromLocalInput,
  toLocalInput,
  useConfirm,
  useConsoleAction,
} from "../ui";
import {
  CommissionPlanSection,
  saveCommissionPlan,
} from "@/components/dashboard/CommissionPlanSection";
import { getCombPlanForItem } from "@/lib/feed-api";
import DateTimeField from "../DateTimeField";
import RegistrationFormBuilder from "./RegistrationFormBuilder";
import {
  createTicket,
  deleteTicket,
  listTickets,
  reorderTickets,
  updateTicket,
} from "../api";
import type { TicketTier } from "../types";

type Tab = "ticket" | "addon" | "form";

/** Per-tab copy, so the shared form and empty state read correctly in both. */
const COPY: Record<
  "ticket" | "addon",
  {
    tab: string;
    singular: string;
    addLabel: string;
    emptyTitle: string;
    emptyBody: string;
    namePlaceholder: string;
    descPlaceholder: string;
  }
> = {
  ticket: {
    tab: "Ticket types",
    singular: "ticket type",
    addLabel: "Add ticket type",
    emptyTitle: "No ticket types",
    emptyBody: "Add at least one tier before you publish.",
    namePlaceholder: "VIP pass",
    descPlaceholder: "Front-row seating and access to the speaker lounge.",
  },
  addon: {
    tab: "Add-ons",
    singular: "add-on",
    addLabel: "Add an add-on",
    emptyTitle: "No add-ons",
    emptyBody:
      "Extras a buyer can tack on to their ticket — a workshop seat, a t-shirt, an airport transfer.",
    namePlaceholder: "Workshop seat",
    descPlaceholder: "Hands-on lab, 20 seats, laptop required.",
  },
};

/** Dot colour per row, by position — matches the track dots on the agenda. */
const DOT_COLORS = ["#34d399", "#FBD10D", "#a78bfa", "#60a5fa", "#f472b6", "#fb923c"];

function saleWindow(t: TicketTier): string {
  const fmt = (d?: string) =>
    d
      ? new Date(d)
          .toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          .toUpperCase()
      : null;
  const from = fmt(t.salesStart);
  const to = fmt(t.salesEnd);
  if (!from && !to) return "ON SALE ALWAYS";
  return `ON SALE ${from || "NOW"} → ${to || "EVENT START"}`;
}

interface Draft {
  name: string;
  description: string;
  perks: string;
  price: string;
  currency: string;
  quantity: string;
  salesStart: string;
  salesEnd: string;
  isVisible: boolean;
}

const emptyDraft: Draft = {
  name: "",
  description: "",
  perks: "",
  price: "0",
  currency: "USD",
  quantity: "100",
  salesStart: "",
  salesEnd: "",
  isVisible: true,
};

function draftFrom(t: TicketTier): Draft {
  return {
    name: t.name,
    description: t.description || "",
    perks: (t.perks || []).join("\n"),
    price: String(t.price),
    currency: t.currency,
    quantity: String(t.quantity),
    salesStart: toLocalInput(t.salesStart),
    salesEnd: toLocalInput(t.salesEnd),
    isVisible: t.isVisible,
  };
}

export default function TicketsSection({
  eventId,
  capacity,
  onChanged,
}: {
  eventId: string;
  /** The event's total capacity — ticket quantities can't list more seats. */
  capacity?: number;
  onChanged?: () => void;
}) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TicketTier | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("ticket");
  /**
   * Total affiliate payout per tier id, as a percentage of the sale.
   *
   * A tier can carry its own plan, which the invoice engine now prefers over
   * the event's — so the row has to say which tiers actually pay out, or a
   * founder has no way to tell one from the next.
   */
  const [commissionPct, setCommissionPct] = useState<Record<string, number>>({});
  const { confirm, confirmDialog } = useConfirm();

  // The form tab has no tier copy, but the tier modal's props are evaluated on
  // every render — so this must never be undefined.
  const copy = COPY[tab === "form" ? "ticket" : tab];
  // One fetch feeds both tier tabs; the split is client-side so switching is
  // instant.
  const rows = useMemo(
    () =>
      tab === "form"
        ? []
        : tiers.filter((t) => (t.kind || "ticket") === tab),
    [tiers, tab]
  );

  // ── Capacity ───────────────────────────────────────────────────────────
  // Admission tiers only: an add-on is an extra, not a seat.
  const isAdmission = (t: Pick<TicketTier, "kind">) => (t.kind || "ticket") === "ticket";
  const listedSeats = tiers.filter(isAdmission).reduce((n, t) => n + t.quantity, 0);
  const draftIsAdmission = editing ? isAdmission(editing) : tab !== "addon";
  const draftQty = Math.max(0, parseInt(draft.quantity || "0", 10) || 0);
  /** Seats this tier may take: capacity less every other admission tier. */
  const seatsAvailable =
    capacity == null
      ? null
      : capacity - (listedSeats - (editing && isAdmission(editing) ? editing.quantity : 0));
  // Only growth is blocked, so an event already over (from before this rule)
  // can still have a tier renamed or trimmed.
  const exceedsCapacity =
    draftIsAdmission &&
    seatsAvailable != null &&
    draftQty > seatsAvailable &&
    draftQty > (editing?.quantity ?? 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTickets(eventId);
      setTiers(res.tiers || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * One lookup per tier. There are a handful of rows on any real event, and
   * the alternative is a new batch endpoint for a badge.
   */
  useEffect(() => {
    let alive = true;
    const ids = tiers.map((t) => t._id);
    if (!ids.length) return;
    void Promise.all(
      ids.map(async (id) => {
        try {
          const res = await getCombPlanForItem("event", id);
          const plan: any = res?.plan;
          if (!plan?.isActive) return [id, 0] as const;
          const total = (plan.levels || []).reduce(
            (sum: number, l: any) => sum + (Number(l.percentage) || 0),
            0
          );
          return [id, total] as const;
        } catch {
          // A failed lookup shows no badge rather than a wrong one.
          return [id, 0] as const;
        }
      })
    ).then((pairs) => {
      if (alive) setCommissionPct(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [tiers]);

  function openCreate() {
    setDraft(emptyDraft);
    setEditing(null);
    setCreating(true);
  }

  // The add action lives in the bottom bar, not on the page.
  useConsoleAction("tickets:add", openCreate);

  function openEdit(t: TicketTier) {
    setDraft(draftFrom(t));
    setEditing(t);
    setCreating(true);
  }

  async function save() {
    if (exceedsCapacity) {
      toast.error(
        `Only ${Math.max(0, seatsAvailable ?? 0)} seats are left under the event's capacity of ${capacity}`
      );
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      perks: draft.perks
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      price: Math.max(0, Number(draft.price) || 0),
      currency: draft.currency,
      quantity: Math.max(1, parseInt(draft.quantity || "1", 10)),
      // A row's kind is fixed by the tab it was created on; editing never
      // moves a sold add-on into the admission list.
      kind: editing?.kind || (tab === "form" ? "ticket" : tab),
      salesStart: fromLocalInput(draft.salesStart),
      salesEnd: fromLocalInput(draft.salesEnd),
      isVisible: draft.isVisible,
    };
    try {
      if (editing) {
        await updateTicket(eventId, editing._id, payload);
      } else {
        const created = await createTicket(eventId, payload);
        // The plan needs something to attach to, so a brand-new tier saves it
        // once the row exists — same deferred contract the create wizard uses.
        const newId = (created as any)?.tier?._id;
        if (newId) {
          try {
            await saveCommissionPlan(newId);
          } catch {
            toast.error("Ticket saved, but the commission plan did not");
          }
        }
      }
      toast.success(
        editing ? `${copy.singular} updated` : `${copy.singular} added`
      );
      setCreating(false);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Could not save the ticket");
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(t: TicketTier) {
    try {
      await updateTicket(eventId, t._id, { isPaused: !t.isPaused });
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not update sales");
    }
  }

  async function remove(t: TicketTier) {
    const ok = await confirm({
      title: `Delete "${t.name}"?`,
      message:
        "This ticket type and its settings are removed for good. Nobody has bought one yet, so no attendee is affected.",
    });
    if (!ok) return;
    try {
      await deleteTicket(eventId, t._id);
      toast.success("Ticket deleted");
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Could not delete the ticket");
    }
  }

  /**
   * `nextRows` is the reordered rows of the ACTIVE tab only. They are folded
   * back into the full list in place, so dragging a ticket never disturbs the
   * add-ons' order (or vice versa).
   */
  async function commitReorder(nextRows: TicketTier[]) {
    let cursor = 0;
    const merged = tiers.map((t) =>
      (t.kind || "ticket") === tab ? nextRows[cursor++] : t
    );
    setTiers(merged);
    try {
      await reorderTickets(
        eventId,
        merged.map((t) => t._id)
      );
    } catch {
      // Server order is authoritative — pull it back if the write failed.
      toast.error("Could not save the new order");
      await load();
    }
  }

  return (
    <div className="px-8 py-8">
      {/* Admission and extras are different questions, so they get different
          tabs rather than one long list with a badge on each row. */}
      <div className="mb-6 flex items-center gap-1 border-b border-[#1c1c24]">
        {(["ticket", "addon", "form"] as Tab[]).map((k) => {
          const active = k === tab;
          const count =
            k === "form"
              ? 0
              : tiers.filter((t) => (t.kind || "ticket") === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={[
                "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
                active
                  ? "text-white"
                  : "border-transparent text-[#7c7d94] hover:text-[#c7c7da]",
              ].join(" ")}
              style={active ? { borderColor: GOLD } : undefined}
            >
              {k === "form" ? "Registration form" : COPY[k].tab}
              {count > 0 && (
                <span className="ml-1.5 text-xs text-[#61627a]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "ticket" && capacity != null && !loading && (
        <div className="mb-5">
          <CapacityMeter
            listed={listedSeats}
            capacity={capacity}
            fix="Lower a ticket type's quantity, or raise the capacity in the event's details."
          />
        </div>
      )}

      {/* The form the buyer fills in after picking a ticket — it belongs with
          the tickets, not on a page of its own. */}
      {tab === "form" ? (
        <RegistrationFormBuilder eventId={eventId} />
      ) : loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={
            tab === "addon" ? (
              <PackagePlus className="h-10 w-10" strokeWidth={1.25} />
            ) : (
              <Ticket className="h-10 w-10" strokeWidth={1.25} />
            )
          }
          title={copy.emptyTitle}
          description={copy.emptyBody}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {copy.addLabel}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((t, i) => {
            const pct = t.percentSold ?? 0;
            const dot = DOT_COLORS[i % DOT_COLORS.length];
            return (
              <Card
                key={t._id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === i) return;
                  const next = [...rows];
                  const [moved] = next.splice(dragIndex, 1);
                  next.splice(i, 0, moved);
                  setDragIndex(null);
                  void commitReorder(next);
                }}
                className="group overflow-hidden transition-colors hover:border-[#33333f]"
              >
                {/* Row 1 — name, with a colour dot so a row is identifiable at
                    a glance in a long list. */}
                <div className="flex items-start gap-3 px-5 pt-5">
                  <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-[#33333f] transition-colors group-hover:text-[#61627a]" />
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: dot }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-white">{t.name}</h3>
                      {!t.isVisible && (
                        <span className="rounded bg-[#22222b] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#7c7d94]">
                          Hidden
                        </span>
                      )}
                      {t.isPaused && (
                        <span className="rounded bg-[#3a2a1f] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#fbbf24]">
                          Paused
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-[#7c7d94]">
                        {t.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2 — the four numbers that matter, on one baseline so
                    they can be compared down the column between rows. */}
                <div className="flex flex-wrap gap-x-10 gap-y-3 px-5 pt-4">
                  {[
                    {
                      label: "Price",
                      value: t.price > 0 ? formatMoney(t.price, t.currency) : "Free",
                      tone: "#ffffff",
                    },
                    { label: "Sold", value: String(t.soldCount), tone: "#ffffff" },
                    {
                      label: "Remaining",
                      value: String(t.remaining ?? t.quantity - t.soldCount),
                      tone: "#9fa0b8",
                    },
                    {
                      label: "Revenue",
                      value: formatMoney(
                        t.revenue ?? t.soldCount * t.price,
                        t.currency
                      ),
                      // Money earned is the one number worth colouring.
                      tone: "#4ade80",
                    },
                    {
                      label: "Affiliate",
                      value:
                        commissionPct[t._id] > 0
                          ? `${commissionPct[t._id]}%`
                          : "None",
                      tone: commissionPct[t._id] > 0 ? "#FBD10D" : "#4f5065",
                    },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="text-[10px] uppercase tracking-widest text-[#4f5065]">
                        {stat.label}
                      </div>
                      <div
                        className="mt-1 text-lg font-semibold tabular-nums leading-none"
                        style={{ color: stat.tone }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 3 — inventory bar, then the sales window in mono so the
                    two dates line up between rows. */}
                <div className="mt-4">
                  <div className="h-1 overflow-hidden bg-[#1c1c24]">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, background: dot }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="font-mono text-[10px] tracking-wide text-[#4f5065]">
                      {saleWindow(t)}
                    </span>
                    <span className="flex items-center gap-3">
                      {/* Seats reserved by an unpaid checkout. They are out of
                          "remaining" but they are not sales, so say so rather
                          than quietly folding them into SOLD. */}
                      {(t.held ?? 0) > 0 && (
                        <span
                          className="text-[10px] tabular-nums text-[#fbbf24]"
                          title={`${t.held} seat${t.held === 1 ? "" : "s"} held by an unpaid checkout. Released automatically after 30 minutes.`}
                        >
                          {t.held} held
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums text-[#4f5065]">
                        {pct}% sold
                      </span>
                    </span>
                  </div>
                </div>

                {/* Row 4 — actions, on their own rule. Labelled, because three
                    bare icons stacked next to the progress bar were the thing
                    that read as broken. */}
                <div className="flex items-center justify-end gap-1 border-t border-[#1f1f28] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => togglePause(t)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#9fa0b8] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {t.isPaused ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                    {t.isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#9fa0b8] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  {t.soldCount === 0 && (t.held ?? 0) === 0 ? (
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#9fa0b8] transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : (
                    // Deleting a tier someone has already paid for would orphan
                    // their ticket, and deleting one mid-checkout would break
                    // that buyer's invoice. Matches the backend guard exactly,
                    // so the button is never offered only to 409.
                    <span
                      className="px-2.5 py-1.5 text-xs text-[#3a3a48]"
                      title={
                        t.soldCount > 0
                          ? "Tiers with sales can't be deleted — pause or hide instead"
                          : "A checkout is in progress on this tier"
                      }
                    >
                      {t.soldCount > 0 ? "Sold" : "In checkout"}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={editing ? `Edit ${copy.singular}` : `New ${copy.singular}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={!draft.name.trim() || exceedsCapacity}
              onClick={save}
            >
              {editing ? "Save changes" : copy.addLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label={tab === "addon" ? "Add-on name" : "Ticket name"}
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={copy.namePlaceholder}
          />
          <TextArea
            label="Description"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder={copy.descPlaceholder}
          />
          <TextArea
            label="Perks"
            hint="One per line"
            rows={3}
            value={draft.perks}
            onChange={(e) => setDraft({ ...draft, perks: e.target.value })}
            placeholder={"Reserved seating\nAfter-party access\nSwag bag"}
          />
          <div className="grid grid-cols-3 gap-3">
            <TextInput
              label="Price"
              type="number"
              min={0}
              step="0.01"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
            <Select
              label="Currency"
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
              options={["USD", "INR", "EUR", "GBP", "AED"].map((c) => ({
                value: c,
                label: c,
              }))}
            />
            <TextInput
              label="Quantity"
              type="number"
              min={1}
              max={draftIsAdmission && seatsAvailable != null ? Math.max(1, seatsAvailable) : undefined}
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            />
          </div>
          {draftIsAdmission && seatsAvailable != null && (
            <p
              className={`-mt-2 text-xs ${
                exceedsCapacity ? "text-[#f87171]" : "text-[#61627a]"
              }`}
            >
              {exceedsCapacity
                ? `Only ${Math.max(0, seatsAvailable)} of the event's ${capacity} seats are left to list. Lower the quantity, or raise the capacity in the event's details.`
                : `${Math.max(0, seatsAvailable)} of the event's ${capacity} seats available for this ticket type.`}
            </p>
          )}

          {/* Affiliate payout for THIS tier, directly under the price it is a
              percentage of. A plan set here beats the one on the event as a
              whole, so an organizer can pay 20% on a VIP pass and nothing on
              general admission; leaving it off falls back to the event's plan
              rather than paying nobody.

              `CommissionPlanSection` renders nothing at all when `isPaid` is
              false, so a free tier gets an explicit line instead — an empty
              gap reads as a missing feature. */}
          {Number(draft.price) > 0 ? (
            <CommissionPlanSection
              itemType="event"
              itemId={editing?._id}
              itemName={`${draft.name.trim() || copy.singular} (Ticket Tier)`}
              isPaid
            />
          ) : (
            <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] px-5 py-4">
              <p className="text-sm font-semibold text-white">
                Affiliate commission
              </p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                There is nothing to pay a commission on while this{" "}
                {copy.singular.toLowerCase()} is free. Set a price above to
                configure a payout for it.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <DateTimeField
              label="Sales start"
              placeholder="On save"
              value={draft.salesStart}
              onChange={(v) => setDraft({ ...draft, salesStart: v })}
            />
            <DateTimeField
              label="Sales end"
              placeholder="Event start"
              min={draft.salesStart || undefined}
              value={draft.salesEnd}
              onChange={(v) => setDraft({ ...draft, salesEnd: v })}
            />
          </div>
          <div className="border-t border-[#1c1c24] pt-3">
            <Toggle
              checked={draft.isVisible}
              onChange={(v) => setDraft({ ...draft, isVisible: v })}
              label="Visible on site"
              description={
                tab === "addon"
                  ? "Hidden add-ons stay purchasable through a direct link."
                  : "Hidden tiers can still be sold through a direct link."
              }
            />
          </div>
          {editing && editing.soldCount > 0 && (
            <p className="text-xs text-[#61627a]">
              {editing.soldCount} already sold — quantity cannot go below that.
            </p>
          )}
        </div>
      </Modal>

      {confirmDialog}
    </div>
  );
}
