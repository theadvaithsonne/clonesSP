"use client";

// A11 / F2 · Pipeline kanban.
//
// One frosted-glass column per stage on the app's normal dark background.
// Cards are "liquid glass" too: a translucent gradient with a soft blur, a
// bright rim and a specular highlight. Dragging lifts a see-through glass copy (DragOverlay) that tilts
// with the pointer so the board stays visible through it, while the card's
// slot moves live into the hovered column — the dashed ghost shows exactly
// where it will land and the other cards spring out of the way. Dropping on a
// Hired stage springs the card back and opens the hire confirmation instead.

import React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  CircleDot,
  ClipboardCheck,
  FileSignature,
  MessagesSquare,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { CATEGORY_META, SOURCE_LABELS } from "../../constants";
import { ErrorState, FilterMenu, LoadingBlock, SearchInput, errorMessage } from "../../ui";
import type { PipelineCard, PipelineResponse, Stage, StageCategory } from "../../types";

type Columns = Record<string, PipelineCard[]>;

const STAGE_ICONS: Record<StageCategory, LucideIcon> = {
  applied: CircleDot,
  screening: ScanSearch,
  assessment: ClipboardCheck,
  interview: MessagesSquare,
  offer: FileSignature,
  hired: BadgeCheck,
};

// The pointer decides the column; fall back to overlap so fast flicks still land.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

// A soft overshoot so the card "settles" into its slot.
const dropAnimation: DropAnimation = {
  duration: 280,
  easing: "cubic-bezier(0.2, 0.9, 0.3, 1.15)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } }),
};

export default function PipelineBoard({
  jobId,
  refreshKey,
  onOpen,
  onHireDrop,
  onShowOutcome,
}: {
  jobId: string;
  refreshKey: number;
  onOpen: (applicationId: string, ordered: string[]) => void;
  onHireDrop: (applicationId: string, ordered: string[]) => void;
  onShowOutcome: (status: "rejected" | "withdrawn") => void;
}) {
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [source, setSource] = React.useState("");
  const [minMatch, setMinMatch] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [sort, setSort] = React.useState("");
  const [data, setData] = React.useState<PipelineResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [columns, setColumns] = React.useState<Columns>({});
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Latest columns for the drag handlers, which run outside React's render.
  const columnsRef = React.useRef<Columns>({});
  columnsRef.current = columns;
  const origin = React.useRef<{ column: string; snapshot: Columns } | null>(null);
  const justDropped = React.useRef(0);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await jobsApi.getPipeline(jobId, {
        q: q || undefined,
        source: source || undefined,
        minMatch: minMatch ? Number(minMatch) : undefined,
        tag: tag || undefined,
        sort: sort || undefined,
      });
      setData(res);
      // Never swap the board out from under an active drag.
      if (!origin.current) setColumns(Object.fromEntries(res.columns.map((c) => [c.stage.id, c.applications])));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the pipeline."));
    }
  }, [jobId, q, source, minMatch, tag, sort]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  const stages = React.useMemo(() => data?.columns.map((c) => c.stage) || [], [data]);
  const ordered = React.useMemo(() => stages.flatMap((s) => (columns[s.id] || []).map((c) => c._id)), [stages, columns]);

  const columnOf = (id: string, cols: Columns = columnsRef.current) =>
    Object.keys(cols).find((k) => cols[k].some((c) => c._id === id));

  const byOrder = React.useCallback(
    (a: PipelineCard, b: PipelineCard) =>
      sort === "applied"
        ? String(b.appliedAt || "").localeCompare(String(a.appliedAt || ""))
        : b.matchScore - a.matchScore,
    [sort]
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const column = columnOf(id);
    if (!column) return;
    origin.current = { column, snapshot: columnsRef.current };
    setActiveId(id);
  };

  // Move the card's slot into the hovered column as it's dragged, at the
  // position it will really take (columns are sorted, not hand-ordered).
  const onDragOver = (e: DragOverEvent) => {
    if (!e.over) return;
    const id = String(e.active.id);
    const to = String(e.over.id);
    setColumns((prev) => {
      const from = columnOf(id, prev);
      if (!from || from === to || !(to in prev)) return prev;
      const card = prev[from].find((c) => c._id === id);
      if (!card) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((c) => c._id !== id),
        [to]: [...prev[to], card].sort(byOrder),
      };
    });
  };

  const settle = () => {
    origin.current = null;
    setActiveId(null);
    justDropped.current = Date.now();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const start = origin.current;
    const finalColumn = columnOf(id);
    settle();
    if (!start) return;
    if (!e.over || !finalColumn) {
      setColumns(start.snapshot);
      return;
    }
    if (finalColumn === start.column) return;

    const stage = stages.find((s) => s.id === finalColumn);
    const card = start.snapshot[start.column]?.find((c) => c._id === id);
    if (!stage || !card) {
      setColumns(start.snapshot);
      return;
    }
    if (stage.category === "hired") {
      // Hiring needs a joining date — spring back and ask for it.
      setColumns(start.snapshot);
      onHireDrop(id, ordered);
      return;
    }
    try {
      await jobsApi.moveApplication(id, { stageId: stage.id });
      toast.success(`${card.name} → ${stage.name}`);
      load();
    } catch (err) {
      setColumns(start.snapshot);
      toast.error(errorMessage(err, "Couldn't move the candidate."));
    }
  };

  const onDragCancel = () => {
    const start = origin.current;
    settle();
    if (start) setColumns(start.snapshot);
  };

  const activeCard = React.useMemo(() => {
    if (!activeId) return null;
    for (const list of Object.values(columns)) {
      const hit = list.find((c) => c._id === activeId);
      if (hit) return hit;
    }
    return null;
  }, [activeId, columns]);

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }
  if (!data) return <LoadingBlock label="Loading candidates…" />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-8 py-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search candidates" />
        <FilterMenu
          label="Source"
          value={source}
          onChange={setSource}
          options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterMenu
          label="Match"
          value={minMatch}
          onChange={setMinMatch}
          options={[
            { value: "80", label: "80%+" },
            { value: "60", label: "60%+" },
          ]}
        />
        <FilterMenu label="Tags" value={tag} onChange={setTag} options={data.tags.map((t) => ({ value: t, label: t }))} />
        <div className="ml-auto">
          <FilterMenu
            label="Sort"
            value={sort}
            allLabel="Match score"
            onChange={setSort}
            options={[{ value: "applied", label: "Newest applicants" }]}
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="relative flex min-h-0 flex-1 gap-3 overflow-x-auto px-8 py-5">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              cards={columns[stage.id] || []}
              activeId={activeId}
              onOpen={(id) => {
                if (Date.now() - justDropped.current < 250) return;
                onOpen(id, ordered);
              }}
            />
          ))}
          <Outcomes outcomes={data.outcomes} onShowOutcome={onShowOutcome} />
        </div>
        <DragOverlay dropAnimation={dropAnimation} zIndex={200}>
          {activeCard ? <LiftedCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  cards,
  activeId,
  onOpen,
}: {
  stage: Stage;
  cards: PipelineCard[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const color = CATEGORY_META[stage.category].color;
  const Icon = STAGE_ICONS[stage.category];
  const dragging = !!activeId;
  return (
    <section
      ref={setNodeRef}
      className="relative flex w-[276px] shrink-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-2xl backdrop-saturate-150 transition-[border-color,box-shadow,background] duration-300 ease-out"
      style={{
        // Frosted glass: a translucent white film (lightly tinted with the
        // stage colour) over the dark page, with a bright rim.
        borderColor: isOver ? `color-mix(in srgb, ${color} 55%, transparent)` : "rgba(255,255,255,0.09)",
        background: `linear-gradient(180deg, color-mix(in srgb, ${color} ${isOver ? 12 : 6}%, rgba(255,255,255,0.05)) 0px, rgba(255,255,255,0.025) 240px)`,
        boxShadow: isOver
          ? `0 0 0 1px color-mix(in srgb, ${color} 22%, transparent), 0 18px 48px -16px color-mix(in srgb, ${color} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)`
          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px -18px rgba(0,0,0,0.8)",
      }}
    >
      {/* Specular sheen across the top-left of the glass. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(140% 45% at 0% 0%, rgba(255,255,255,0.07), transparent 60%)" }}
      />
      <span aria-hidden className="relative h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 35%, transparent))` }} />
      <header className="relative flex items-center justify-between px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" style={{ color }} />
          <span className="truncate text-[13px] font-semibold text-white">{stage.name}</span>
          <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[11px] tabular-nums text-white/60">{cards.length}</span>
        </div>
      </header>
      <div className="relative min-h-[140px] flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
        {cards.map((card, i) => (
          <DraggableCard key={card._id} card={card} index={i} ghost={card._id === activeId} onOpen={() => onOpen(card._id)} />
        ))}
        {!cards.length && (
          <div
            className="flex h-24 items-center justify-center rounded-xl border border-dashed text-xs transition-colors duration-200"
            style={{
              borderColor: isOver ? `color-mix(in srgb, ${color} 60%, transparent)` : dragging ? "rgba(255,255,255,0.12)" : "transparent",
              color: isOver ? color : "rgba(255,255,255,0.35)",
              background: isOver ? `color-mix(in srgb, ${color} 8%, transparent)` : "transparent",
            }}
          >
            {isOver ? "Drop here" : dragging ? "Drag here" : "Empty"}
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  card,
  index,
  ghost,
  onOpen,
}: {
  card: PipelineCard;
  index: number;
  ghost: boolean;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card._id, disabled: card.status !== "active" });
  return (
    <motion.div
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 40, mass: 0.7 },
        default: { type: "spring", stiffness: 420, damping: 32, delay: Math.min(index, 8) * 0.025 },
      }}
    >
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className={card.status === "active" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
      >
        <GlassCard card={card} variant={ghost ? "ghost" : "rest"} />
      </div>
    </motion.div>
  );
}

/** The copy that follows the pointer — lifts, tilts and stays see-through. */
function LiftedCard({ card }: { card: PipelineCard }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 1, rotate: 0 }}
      animate={reduce ? undefined : { scale: 1.035, rotate: -1.6 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className="cursor-grabbing"
    >
      <GlassCard card={card} variant="lifted" />
    </motion.div>
  );
}

const VARIANT_CLASS: Record<"rest" | "lifted" | "ghost", string> = {
  rest: [
    "border border-white/[0.09] backdrop-blur-xl backdrop-saturate-150",
    "bg-[linear-gradient(150deg,rgba(255,255,255,0.085),rgba(255,255,255,0.025))]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.35)]",
    "transition-[transform,border-color,box-shadow] duration-200 ease-out",
    "hover:-translate-y-px hover:border-white/[0.18]",
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_28px_-10px_rgba(0,0,0,0.7)]",
  ].join(" "),
  lifted: [
    "border border-white/[0.26] backdrop-blur-[5px] backdrop-saturate-[1.8]",
    "bg-[linear-gradient(150deg,rgba(255,255,255,0.17),rgba(255,255,255,0.045))]",
    "shadow-[0_28px_60px_-14px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(255,255,255,0.08)]",
  ].join(" "),
  // Colours for the ghost come from GHOST_STYLE (colour-mix values read more
  // reliably as inline styles than as arbitrary Tailwind classes).
  ghost: "border border-dashed",
};

const GHOST_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--brand) 7%, transparent)",
  borderColor: "color-mix(in srgb, var(--brand) 55%, transparent)",
};

function GlassCard({ card, variant }: { card: PipelineCard; variant: "rest" | "lifted" | "ghost" }) {
  const chips = [...card.skills, ...card.tags].slice(0, 3);
  const matchColor = card.matchScore >= 80 ? "#4ade80" : card.matchScore >= 60 ? "#fbbf24" : "#a1a1aa";
  return (
    <div
      className={`relative overflow-hidden rounded-xl px-3 py-2.5 ${VARIANT_CLASS[variant]}`}
      style={variant === "ghost" ? GHOST_STYLE : undefined}
    >
      {variant !== "ghost" && (
        <>
          {/* Specular highlight across the top-left, like light on glass. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,0.12), transparent 55%)" }}
          />
          {variant === "lifted" && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(90% 80% at 100% 100%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 60%)" }}
            />
          )}
        </>
      )}
      <div className={`relative ${variant === "ghost" ? "opacity-25" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.1] text-[10px] font-semibold text-white/80">
            {card.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              card.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{card.name}</span>
          {card.isNew && variant === "rest" && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" title="New" />
          )}
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ color: matchColor, background: `color-mix(in srgb, ${matchColor} 12%, transparent)` }}
          >
            {card.matchScore}%
          </span>
        </div>
        <div className="mt-1.5 truncate pl-8 text-[11px] text-white/55">{card.context || SOURCE_LABELS[card.source]}</div>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 pl-8">
            {chips.map((c) => (
              <span key={c} className="rounded-md border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/60">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Outcomes({
  outcomes,
  onShowOutcome,
}: {
  outcomes: PipelineResponse["outcomes"];
  onShowOutcome: (status: "rejected" | "withdrawn") => void;
}) {
  return (
    <div className="w-40 shrink-0 space-y-2">
      <div className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-white/40">Outcomes</div>
      {(
        [
          ["rejected", "Rejected", "#f87171"],
          ["withdrawn", "Withdrawn", "#a1a1aa"],
        ] as const
      ).map(([key, label, color]) => (
        <button
          key={key}
          type="button"
          onClick={() => onShowOutcome(key)}
          className="relative w-full overflow-hidden rounded-xl border border-white/[0.09] bg-[linear-gradient(150deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-3 py-3 text-left backdrop-blur-xl transition-[transform,border-color] duration-200 hover:-translate-y-px hover:border-white/[0.18]"
        >
          <div className="text-[11px]" style={{ color }}>
            {label}
          </div>
          <div className="text-xl font-semibold tabular-nums text-white">{outcomes[key]}</div>
        </button>
      ))}
    </div>
  );
}
