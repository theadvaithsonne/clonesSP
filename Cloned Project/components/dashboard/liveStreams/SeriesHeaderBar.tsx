"use client";

/**
 * The chip row above the recurring table.
 *
 * Every row below it is a session of ONE series, so the facts that don't vary
 * session to session belong here rather than in a column that would repeat the
 * same value 45 times: which series, its status, the communities it went to
 * and — for an enrol-once series — the price and the affiliate split, since
 * those are bought once for the whole series rather than per session.
 *
 * A per-session series deliberately does NOT get the price chip: each session
 * is its own sale, so the price can differ row to row and stays in the table.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { FounderSeriesHeader } from "@/lib/feed-api";
import { Avatar, currencyFlag, formatPrice, statusMeta } from "./founderStreamCells";

/** Shared chip shell — same height and rim as the filter button next to it. */
const CHIP =
  "rim-light rim-light-strong flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/[0.03] px-3 text-[13px] text-zinc-200";

export function SeriesHeaderBar({
  header,
  onOpenSwitch,
}: {
  header: FounderSeriesHeader;
  /** The series chip is also the view switcher — its caret opens the same
   *  two-step panel the One Time view uses. */
  onOpenSwitch: () => void;
}) {
  const meta = statusMeta(header.status);
  const StatusIcon = meta.icon;
  const paid = !header.payment.isFree;
  // Price and commission are series-wide only when the series is bought once.
  const showSeriesPrice = header.enrollmentType === "once";

  return (
    <>
      <button
        type="button"
        onClick={onOpenSwitch}
        title="Switch view or pick a different recurring series"
        className={`${CHIP} max-w-[420px] transition-colors hover:bg-white/[0.06]`}
      >
        {/* The stream's own cover art, not the host's face: the chip names a
            live stream, and a founder who hosts every series would otherwise
            see the same picture on all of them. */}
        <Avatar
          src={header.thumbnail}
          name={header.title}
          className="h-[22px] w-[22px]"
          rounded="rounded-[6px]"
        />
        <span className="truncate">
          {header.title}
          <span className="text-zinc-500"> | </span>
          {header.enrollmentType === "per_session"
            ? "Enrollment Per Session"
            : "Enrollment One Time"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      </button>

      <span className={CHIP}>
        <StatusIcon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
        <span className="whitespace-nowrap">{meta.label}</span>
      </span>

      <CommunitiesChip communities={header.communities} />

      {showSeriesPrice &&
        (paid ? (
          <>
            <span className={CHIP}>
              <span>{currencyFlag(header.payment.currency)}</span>
              <span className="whitespace-nowrap">
                {formatPrice(header.payment.price, header.payment.currency)}{" "}
                {header.payment.currency}
              </span>
            </span>
            {/* No plan at all ⇒ no chip. A plan that pays 0% still gets one,
                because "0%" is a decision and blank is not. */}
            {header.commission && (
              <span className={CHIP}>
                <span className="whitespace-nowrap">
                  {header.commission.percent}% (
                  {formatPrice(
                    header.commission.amount,
                    header.payment.currency,
                  )}
                  ) Commission
                </span>
              </span>
            )}
          </>
        ) : (
          <span className={CHIP}>
            <span className="whitespace-nowrap">Free</span>
          </span>
        ))}
    </>
  );
}

/** "Series Level Options" — the drawer for the series itself, as opposed to a
 *  row's tick, which opens the drawer for one session. */
export function SeriesOptionsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CHIP} transition-colors hover:bg-white/[0.06]`}
    >
      <MoreHorizontal className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="whitespace-nowrap">Series Level Options</span>
    </button>
  );
}

/**
 * "N Communities" with the full list behind a click.
 *
 * A count rather than the names: a series published to five communities would
 * otherwise push every other chip off the row. Rendered through a portal for
 * the same reason the table cell's popover is — the toolbar clips.
 */
function CommunitiesChip({
  communities,
}: {
  communities: FounderSeriesHeader["communities"];
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!communities.length) {
    return (
      <span className={`${CHIP} text-zinc-500`}>
        <span className="whitespace-nowrap">No Communities</span>
      </span>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setAnchor({ top: r.bottom + 6, left: r.left });
          setOpen((v) => !v);
        }}
        className={`${CHIP} transition-colors hover:bg-white/[0.06]`}
      >
        <span className="whitespace-nowrap">
          {communities.length} Communit{communities.length === 1 ? "y" : "ies"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      </button>

      {open &&
        anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[131] max-h-64 w-56 overflow-y-auto rounded-xl border border-[#2E2E2E] bg-[#161618] p-1.5 shadow-2xl shadow-black/70"
              style={{ top: anchor.top, left: anchor.left }}
            >
              {communities.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05]"
                >
                  <Avatar
                    src={c.icon}
                    name={c.title}
                    className="h-5 w-5"
                    rounded="rounded-[6px]"
                  />
                  <span className="truncate text-[13px] text-white/85">
                    {c.title}
                  </span>
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
