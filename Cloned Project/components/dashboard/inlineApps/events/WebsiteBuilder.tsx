"use client";

// The visual Event Web Builder.
//
// Three panes, same shape as the NetworkMail editor: a block library on the
// left, a live canvas in the middle, and an inspector on the right. The canvas
// renders `EventSiteRenderer` — the exact component the public page uses — so
// what the founder sees here is what ships.
//
// Draft vs live: everything edited here is the draft. "Publish to live site"
// snapshots it server-side; until then the public page keeps serving the last
// published version.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Loader2,
  Minimize2,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import EventSiteRenderer, {
  type PublicTier,
} from "@/components/events/site/EventSiteRenderer";
import {
  Button,
  GOLD,
  Select,
  TextArea,
  TextInput,
  useConfirm,
} from "./ui";
import {
  getWebsite,
  publishWebsite,
  resetWebsite,
  saveWebsite,
} from "./api";
import type {
  EventBlock,
  EventBlockType,
  EventProgram,
  EventSiteData,
  EventTheme,
} from "./types";

const BLOCK_LIBRARY: Array<{
  type: EventBlockType;
  label: string;
  blurb: string;
  /** Blocks that only make sense once. */
  unique?: boolean;
}> = [
  { type: "hero", label: "Hero", blurb: "Banner, title, countdown, CTA", unique: true },
  { type: "about", label: "About event", blurb: "Overview and host details" },
  { type: "agenda", label: "Agenda schedule", blurb: "Days, stages, sessions" },
  { type: "speakers", label: "Speaker showcase", blurb: "Photo cards and bios" },
  { type: "sponsors", label: "Sponsors", blurb: "Tiered logo wall" },
  { type: "tickets", label: "Tickets / pricing", blurb: "Tier cards with CTAs" },
  { type: "venue_map", label: "Venue & map", blurb: "Address, pin, directions" },
  { type: "faq", label: "FAQ", blurb: "Expandable questions" },
  { type: "cta_banner", label: "CTA banner", blurb: "Closing conversion push" },
  { type: "footer", label: "Footer", blurb: "Small print and links", unique: true },
];

const DEFAULT_CONTENT: Record<EventBlockType, Record<string, any>> = {
  hero: { headline: "", subheadline: "", ctaLabel: "Get tickets", showCountdown: true },
  about: { eyebrow: "", heading: "About the event", body: "", highlights: [] },
  agenda: { eyebrow: "Agenda preview", heading: "What's on", subheading: "" },
  speakers: { eyebrow: "Speakers", heading: "Featured speakers", subheading: "" },
  sponsors: { eyebrow: "Support", heading: "Our sponsors", subheading: "" },
  tickets: { eyebrow: "Pricing", heading: "Tickets", subheading: "", note: "" },
  venue_map: { eyebrow: "Location", heading: "The Venue", subheading: "" },
  faq: { eyebrow: "FAQ", heading: "Frequently asked questions", items: [] },
  cta_banner: { headline: "Get your ticket", body: "", ctaLabel: "Get tickets" },
  footer: { note: "", links: [] },
};

/**
 * The two surface palettes the renderer understands.
 *
 * Dark is deliberately not `#0c0c0e`: that exact value is the server's default
 * for a site nobody has themed, and the renderer reads it as "unset, use the
 * light template". A picked dark needs a value that means something.
 */
const LEGACY_DEFAULT_BG = "#0c0c0e";

const THEME_PRESETS: Array<{ label: string; background: string }> = [
  { label: "Light", background: "#FFFFFF" },
  { label: "Dark", background: "#0B0B0F" },
];

function newBlockId(type: string) {
  return `${type}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function WebsiteBuilder({
  eventId,
  publicUrl,
  onExit,
}: {
  eventId: string;
  publicUrl: string;
  /** Leaves full-screen mode and returns to the event console. */
  onExit?: () => void;
}) {
  const [event, setEvent] = useState<EventProgram | null>(null);
  const [data, setData] = useState<EventSiteData | null>(null);
  const [blocks, setBlocks] = useState<EventBlock[]>([]);
  const [theme, setTheme] = useState<EventTheme>({
    primaryColor: GOLD,
    backgroundColor: "#FFFFFF",
    font: "Inter",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWebsite(eventId);
      setEvent(res.event);
      setData(res.data);
      setBlocks(
        [...(res.config.blocks || [])].sort((a, b) => a.order - b.order)
      );
      // The server stamps every new site with a near-black background nobody
      // chose. The renderer reads that value as "unset" and draws the light
      // template, so show the same thing in the picker rather than a hex that
      // does not match the canvas.
      const bg = (res.config.theme?.backgroundColor || "").toLowerCase();
      setTheme(
        !bg || bg === LEGACY_DEFAULT_BG
          ? { ...res.config.theme, backgroundColor: "#FFFFFF" }
          : res.config.theme
      );
      setSelectedId((prev) => prev || res.config.blocks?.[0]?.id || null);
      setDirty(false);
      loadedOnce.current = true;
    } catch (err: any) {
      toast.error(err?.message || "Could not load the website builder");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => blocks.find((b) => b.id === selectedId) || null,
    [blocks, selectedId]
  );

  function mutate(next: EventBlock[]) {
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setDirty(true);
  }

  function patchBlock(id: string, patch: Partial<EventBlock>) {
    mutate(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function patchContent(id: string, contentPatch: Record<string, any>) {
    mutate(
      blocks.map((b) =>
        b.id === id ? { ...b, content: { ...b.content, ...contentPatch } } : b
      )
    );
  }

  function addBlock(type: EventBlockType) {
    const meta = BLOCK_LIBRARY.find((b) => b.type === type);
    if (meta?.unique && blocks.some((b) => b.type === type)) {
      toast.error(`Only one ${meta.label} block per page`);
      return;
    }
    const block: EventBlock = {
      id: newBlockId(type),
      type,
      order: blocks.length,
      isVisible: true,
      content: { ...DEFAULT_CONTENT[type] },
      styles: {},
    };
    // Footer always stays last — a block dropped after it would render below
    // the page's own small print.
    const footerIndex = blocks.findIndex((b) => b.type === "footer");
    const next =
      footerIndex >= 0 && type !== "footer"
        ? [...blocks.slice(0, footerIndex), block, ...blocks.slice(footerIndex)]
        : [...blocks, block];
    mutate(next);
    setSelectedId(block.id);
  }

  function removeBlock(id: string) {
    mutate(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function move(id: string, delta: number) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
  }

  async function save(silent = false) {
    setSaving(true);
    try {
      await saveWebsite(eventId, blocks, theme);
      setDirty(false);
      if (!silent) toast.success("Draft saved");
    } catch (err: any) {
      toast.error(err?.message || "Could not save the draft");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      // Always persist the draft first, so publishing can't ship a stale
      // snapshot of edits that were never saved.
      await saveWebsite(eventId, blocks, theme);
      const res = await publishWebsite(eventId);
      setDirty(false);
      toast.success(
        res.eventPublished
          ? "Website is live"
          : "Website published — publish the event itself to make the page reachable"
      );
    } catch (err: any) {
      toast.error(err?.message || "Could not publish the website");
    } finally {
      setPublishing(false);
    }
  }

  async function reset() {
    const ok = await confirm({
      title: "Reset to the default layout?",
      message:
        "Every block, edit and theme change on this page goes back to how it started. Anything already published stays live until you publish again.",
      confirmLabel: "Reset layout",
    });
    if (!ok) return;
    try {
      await resetWebsite(eventId);
      await load();
      toast.success("Layout reset");
    } catch (err: any) {
      toast.error(err?.message || "Could not reset the layout");
    }
  }

  if (loading || !event || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0c0c0e]">
        <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0c0c0e]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1c1c24] px-6 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" style={{ color: GOLD }} />
          <h1 className="text-sm font-semibold text-white">Event website</h1>
          {dirty && (
            <span className="rounded bg-[#2d2a1f] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#FACC15]">
              Unsaved
            </span>
          )}
        </div>

        <div className="ml-4 flex items-center gap-1 rounded-lg border border-[#26262f] p-0.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={[
              "rounded-md p-1.5 transition-colors",
              viewport === "desktop"
                ? "bg-[#1f1f28] text-white"
                : "text-[#7c7d94] hover:text-white",
            ].join(" ")}
            title="Desktop"
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={[
              "rounded-md p-1.5 transition-colors",
              viewport === "mobile"
                ? "bg-[#1f1f28] text-white"
                : "text-[#7c7d94] hover:text-white",
            ].join(" ")}
            title="Mobile"
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={reset} title="Reset to default layout">
            <RotateCcw className="h-4 w-4" />
          </Button>
          {onExit && (
            <Button
              variant="secondary"
              onClick={async () => {
                if (dirty) {
                  const ok = await confirm({
                    title: "Leave with unsaved changes?",
                    message:
                      "Your edits since the last save are discarded. Save first to keep them.",
                    confirmLabel: "Leave anyway",
                  });
                  if (!ok) return;
                }
                onExit();
              }}
            >
              <Minimize2 className="h-4 w-4" />
              Exit builder
            </Button>
          )}
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
          </a>
          <Button variant="secondary" loading={saving} onClick={() => save()}>
            <Save className="h-4 w-4" />
            Save draft
          </Button>
          <Button loading={publishing} onClick={publish}>
            <Upload className="h-4 w-4" />
            Publish to live site
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Block library + outline */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[#1c1c24]">
          <div className="border-b border-[#1c1c24] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4f5065]">
            Page outline
          </div>
          <div className="max-h-[45%] overflow-y-auto p-2">
            {blocks.map((b, i) => {
              const meta = BLOCK_LIBRARY.find((x) => x.type === b.type);
              const active = b.id === selectedId;
              return (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setDragId(b.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragId || dragId === b.id) return;
                    const from = blocks.findIndex((x) => x.id === dragId);
                    const next = [...blocks];
                    const [moved] = next.splice(from, 1);
                    next.splice(i, 0, moved);
                    mutate(next);
                    setDragId(null);
                  }}
                  onClick={() => setSelectedId(b.id)}
                  className={[
                    "group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-[#1a1a22] text-white"
                      : "text-[#9fa0b8] hover:bg-[#15151b] hover:text-white",
                  ].join(" ")}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-[#3a3a48]" />
                  <span className="flex-1 truncate">{meta?.label || b.type}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      patchBlock(b.id, { isVisible: !b.isVisible });
                    }}
                    className="shrink-0 text-[#4f5065] hover:text-white"
                    title={b.isVisible ? "Hide section" : "Show section"}
                  >
                    {b.isVisible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-y border-[#1c1c24] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4f5065]">
            Add a section
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {BLOCK_LIBRARY.map((b) => {
              const used = b.unique && blocks.some((x) => x.type === b.type);
              return (
                <button
                  key={b.type}
                  type="button"
                  disabled={!!used}
                  onClick={() => addBlock(b.type)}
                  className="mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#15151b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4f5065]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[#c7c7da]">
                      {b.label}
                    </span>
                    <span className="block truncate text-[11px] text-[#61627a]">
                      {b.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Canvas */}
        <div className="min-w-0 flex-1 overflow-y-auto bg-[#080809] p-6">
          <div
            className={[
              "mx-auto overflow-hidden rounded-xl border border-[#26262f] shadow-2xl transition-all",
              viewport === "mobile" ? "w-[390px]" : "w-full max-w-[1200px]",
            ].join(" ")}
          >
            <EventSiteRenderer
              event={event}
              blocks={blocks}
              theme={theme}
              tiers={data.tiers as unknown as PublicTier[]}
              speakers={data.speakers}
              sessions={data.sessions}
              sponsors={data.sponsors}
              onSelectBlock={setSelectedId}
              selectedBlockId={selectedId}
              showHidden
              compact={viewport === "mobile"}
            />
          </div>
        </div>

        {/* Inspector */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#1c1c24]">
          <div className="border-b border-[#1c1c24] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4f5065]">
            {selected
              ? BLOCK_LIBRARY.find((b) => b.type === selected.type)?.label ||
                selected.type
              : "Inspector"}
          </div>

          <div className="p-4">
            {selected ? (
              <BlockInspector
                block={selected}
                tiers={data.tiers}
                onPatch={(patch) => patchBlock(selected.id, patch)}
                onPatchContent={(patch) => patchContent(selected.id, patch)}
                onMoveUp={() => move(selected.id, -1)}
                onMoveDown={() => move(selected.id, 1)}
                onRemove={() => removeBlock(selected.id)}
              />
            ) : (
              <p className="text-sm text-[#61627a]">
                Pick a section on the canvas to edit it.
              </p>
            )}
          </div>

          <div className="border-t border-[#1c1c24] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4f5065]">
            Theme
          </div>
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-1.5 text-xs font-medium text-[#c7c7da]">
                Surface
              </div>
              <div className="flex gap-2">
                {THEME_PRESETS.map((preset) => {
                  const active =
                    theme.backgroundColor?.toLowerCase() ===
                    preset.background.toLowerCase();
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setTheme({ ...theme, backgroundColor: preset.background });
                        setDirty(true);
                      }}
                      className={[
                        "flex-1 rounded-lg border py-2 text-xs transition-colors",
                        active
                          ? "border-[#FACC15] text-white"
                          : "border-[#2a2a35] text-[#9fa0b8] hover:text-white",
                      ].join(" ")}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-[#61627a]">
                Every section colour follows the background — a light background
                gives the light template, a dark one inverts it.
              </p>
            </div>
            <ColorField
              label="Accent colour"
              value={theme.primaryColor}
              onChange={(v) => {
                setTheme({ ...theme, primaryColor: v });
                setDirty(true);
              }}
            />
            <ColorField
              label="Background"
              value={theme.backgroundColor}
              onChange={(v) => {
                setTheme({ ...theme, backgroundColor: v });
                setDirty(true);
              }}
            />
            <Select
              label="Font"
              value={theme.font}
              onChange={(e) => {
                setTheme({ ...theme, font: e.target.value });
                setDirty(true);
              }}
              options={[
                { value: "Inter", label: "Inter" },
                { value: "Georgia", label: "Georgia" },
                { value: "ui-serif", label: "Serif" },
                { value: "ui-monospace", label: "Mono" },
              ]}
            />
          </div>
        </aside>
      </div>

      {confirmDialog}
    </div>
  );
}

// ── Inspector ────────────────────────────────────────────────────────────

/**
 * Alignment and spacing, for any block.
 *
 * Both are stored on `block.styles` and applied by the renderer's SectionShell,
 * so the builder canvas and the public page can't disagree. Leaving either
 * unset means "as designed" — the renderer only overrides once a choice has
 * been made, which is why every existing site keeps its current look.
 */
function LayoutControls({
  block,
  onPatch,
}: {
  block: EventBlock;
  onPatch: (patch: Partial<EventBlock>) => void;
}) {
  const styles = block.styles || {};
  const setStyle = (patch: Record<string, string | undefined>) => {
    const next = { ...styles, ...patch };
    // Drop emptied keys so "as designed" is a real state, not a magic value.
    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });
    onPatch({ styles: next });
  };

  const ALIGNMENTS = [
    { value: "left", label: "Left", icon: AlignLeft },
    { value: "center", label: "Centre", icon: AlignCenter },
    { value: "right", label: "Right", icon: AlignRight },
  ] as const;

  const SPACING = [
    { value: "none", label: "None" },
    { value: "tight", label: "Tight" },
    { value: "normal", label: "Normal" },
    { value: "roomy", label: "Roomy" },
  ] as const;

  return (
    <div className="space-y-3 rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#61627a]">
        Layout
      </div>

      <div>
        <div className="mb-1.5 text-[11px] text-[#9fa0b8]">Text alignment</div>
        <div className="flex gap-1">
          {ALIGNMENTS.map((a) => {
            const Icon = a.icon;
            const active = styles.textAlign === a.value;
            return (
              <button
                key={a.value}
                type="button"
                title={a.label}
                onClick={() =>
                  setStyle({ textAlign: active ? undefined : a.value })
                }
                className={[
                  "flex flex-1 items-center justify-center rounded-md border py-1.5 transition-colors",
                  active
                    ? "border-transparent text-[#141418]"
                    : "border-[#2a2a35] text-[#9fa0b8] hover:text-white",
                ].join(" ")}
                style={active ? { background: GOLD } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] text-[#9fa0b8]">Vertical spacing</div>
        <div className="grid grid-cols-4 gap-1">
          {SPACING.map((sp) => {
            const active = styles.paddingY === sp.value;
            return (
              <button
                key={sp.value}
                type="button"
                onClick={() =>
                  setStyle({ paddingY: active ? undefined : sp.value })
                }
                className={[
                  "rounded-md border py-1.5 text-[11px] transition-colors",
                  active
                    ? "border-transparent font-medium text-[#141418]"
                    : "border-[#2a2a35] text-[#9fa0b8] hover:text-white",
                ].join(" ")}
                style={active ? { background: GOLD } : undefined}
              >
                {sp.label}
              </button>
            );
          })}
        </div>
      </div>

      {(styles.textAlign || styles.paddingY) && (
        <button
          type="button"
          onClick={() => setStyle({ textAlign: undefined, paddingY: undefined })}
          className="text-[11px] text-[#61627a] transition-colors hover:text-white"
        >
          Reset to the section default
        </button>
      )}
    </div>
  );
}

function BlockInspector({
  block,
  tiers,
  onPatch,
  onPatchContent,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: EventBlock;
  tiers: EventSiteData["tiers"];
  onPatch: (patch: Partial<EventBlock>) => void;
  onPatchContent: (patch: Record<string, any>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const c = block.content || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          className="rounded-lg border border-[#2a2a35] p-2 text-[#9fa0b8] hover:bg-white/5 hover:text-white"
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          className="rounded-lg border border-[#2a2a35] p-2 text-[#9fa0b8] hover:bg-white/5 hover:text-white"
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPatch({ isVisible: !block.isVisible })}
          className="rounded-lg border border-[#2a2a35] p-2 text-[#9fa0b8] hover:bg-white/5 hover:text-white"
          title={block.isVisible ? "Hide" : "Show"}
        >
          {block.isVisible ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded-lg border border-[#2a2a35] p-2 text-[#9fa0b8] hover:bg-[#f87171]/10 hover:text-[#f87171]"
          title="Remove section"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Layout applies to every section, so it sits above the per-type
          content fields rather than being repeated inside each of them. */}
      <LayoutControls block={block} onPatch={onPatch} />

      {block.type === "hero" && (
        <>
          <TextInput
            label="Headline"
            value={c.headline || ""}
            onChange={(e) => onPatchContent({ headline: e.target.value })}
            placeholder="Falls back to the event name"
          />
          <TextArea
            label="Subheadline"
            rows={3}
            value={c.subheadline || ""}
            onChange={(e) => onPatchContent({ subheadline: e.target.value })}
          />
          <TextInput
            label="Button label"
            value={c.ctaLabel || ""}
            onChange={(e) => onPatchContent({ ctaLabel: e.target.value })}
          />
          <TextInput
            label="Secondary button"
            hint="Leave empty to show only the ticket button"
            value={c.secondaryCtaLabel || ""}
            onChange={(e) => onPatchContent({ secondaryCtaLabel: e.target.value })}
          />
          {c.secondaryCtaLabel && (
            <TextInput
              label="Secondary button link"
              value={c.secondaryCtaHref || ""}
              placeholder="#about"
              onChange={(e) => onPatchContent({ secondaryCtaHref: e.target.value })}
            />
          )}
          <CheckRow
            label="Show countdown"
            checked={c.showCountdown !== false}
            onChange={(v) => onPatchContent({ showCountdown: v })}
          />
          <p className="text-[11px] leading-5 text-[#61627a]">
            The date, city and format line above the title comes from the PLAN
            tab. Speaker companies fill the logo strip underneath.
          </p>
        </>
      )}

      {block.type === "about" && (
        <>
          <TextInput
            label="Eyebrow"
            hint="Small label above the heading"
            value={c.eyebrow || ""}
            onChange={(e) => onPatchContent({ eyebrow: e.target.value })}
          />
          <TextInput
            label="Heading"
            value={c.heading || ""}
            onChange={(e) => onPatchContent({ heading: e.target.value })}
          />
          <TextArea
            label="Body"
            rows={7}
            value={c.body || ""}
            onChange={(e) => onPatchContent({ body: e.target.value })}
          />
          <TextInput
            label="Image URL"
            hint="Falls back to the event banner"
            value={c.imageUrl || ""}
            onChange={(e) => onPatchContent({ imageUrl: e.target.value })}
          />
          <TextArea
            label="Highlight badges"
            hint="One per line"
            rows={3}
            value={(c.highlights || []).join("\n")}
            onChange={(e) =>
              onPatchContent({
                highlights: e.target.value.split("\n").filter((x) => x.trim()),
              })
            }
          />
        </>
      )}

      {["agenda", "speakers", "sponsors", "tickets", "venue_map"].includes(
        block.type
      ) && (
        <>
          <TextInput
            label="Eyebrow"
            hint="Small label above the heading"
            value={c.eyebrow || ""}
            onChange={(e) => onPatchContent({ eyebrow: e.target.value })}
          />
          <TextInput
            label="Heading"
            value={c.heading || ""}
            onChange={(e) => onPatchContent({ heading: e.target.value })}
          />
          <TextArea
            label="Subheading"
            rows={2}
            value={c.subheading || ""}
            onChange={(e) => onPatchContent({ subheading: e.target.value })}
          />

          {block.type === "tickets" && (
            <>
              <Select
                label="Highlight a tier"
                hint="Adds the 'Most popular' badge"
                value={c.popularTierId || ""}
                onChange={(e) => onPatchContent({ popularTierId: e.target.value })}
                options={[
                  { value: "", label: "No highlight" },
                  ...tiers
                    .filter((t) => (t.kind || "ticket") === "ticket")
                    .map((t) => ({ value: t._id, label: t.name })),
                ]}
              />
              <TextArea
                label="Footnote"
                hint="Shown under the cards — group discounts, refunds…"
                rows={2}
                value={c.note || ""}
                onChange={(e) => onPatchContent({ note: e.target.value })}
              />
            </>
          )}

          {block.type === "sponsors" && (
            <>
              <TextInput
                label="Link label"
                hint="Optional line under the logo wall"
                value={c.ctaLabel || ""}
                onChange={(e) => onPatchContent({ ctaLabel: e.target.value })}
              />
              {c.ctaLabel && (
                <TextInput
                  label="Link URL"
                  value={c.ctaHref || ""}
                  placeholder="mailto:sponsors@…"
                  onChange={(e) => onPatchContent({ ctaHref: e.target.value })}
                />
              )}
            </>
          )}

          <p className="text-[11px] leading-5 text-[#61627a]">
            The content of this section comes from the PLAN and SELL tabs — edit
            it there and it updates here.
          </p>
        </>
      )}

      {block.type === "faq" && (
        <>
          <TextInput
            label="Eyebrow"
            hint="Small label above the heading"
            value={c.eyebrow || ""}
            onChange={(e) => onPatchContent({ eyebrow: e.target.value })}
          />
          <TextInput
            label="Heading"
            value={c.heading || ""}
            onChange={(e) => onPatchContent({ heading: e.target.value })}
          />
          <div className="space-y-3">
            {(c.items || []).map((item: any, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-[#26262f] bg-[#101014] p-3"
              >
                <TextInput
                  label={`Question ${i + 1}`}
                  value={item.q || ""}
                  onChange={(e) => {
                    const items = [...(c.items || [])];
                    items[i] = { ...items[i], q: e.target.value };
                    onPatchContent({ items });
                  }}
                />
                <TextArea
                  label="Answer"
                  rows={3}
                  className="mt-2"
                  value={item.a || ""}
                  onChange={(e) => {
                    const items = [...(c.items || [])];
                    items[i] = { ...items[i], a: e.target.value };
                    onPatchContent({ items });
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    onPatchContent({
                      items: (c.items || []).filter((_: any, x: number) => x !== i),
                    })
                  }
                  className="mt-2 text-[11px] text-[#7c7d94] hover:text-[#f87171]"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onPatchContent({ items: [...(c.items || []), { q: "", a: "" }] })
              }
              className="w-full rounded-lg border border-dashed border-[#2a2a35] py-2.5 text-xs text-[#9fa0b8] hover:border-[#3a3a48] hover:text-white"
            >
              Add question
            </button>
          </div>
        </>
      )}

      {block.type === "cta_banner" && (
        <>
          <TextInput
            label="Headline"
            value={c.headline || ""}
            onChange={(e) => onPatchContent({ headline: e.target.value })}
          />
          <TextArea
            label="Body"
            rows={3}
            value={c.body || ""}
            onChange={(e) => onPatchContent({ body: e.target.value })}
          />
          <TextInput
            label="Button label"
            value={c.ctaLabel || ""}
            onChange={(e) => onPatchContent({ ctaLabel: e.target.value })}
          />
        </>
      )}

      {block.type === "footer" && (
        <>
          <TextArea
            label="Small print"
            rows={3}
            value={c.note || ""}
            onChange={(e) => onPatchContent({ note: e.target.value })}
          />
          <TextArea
            label="Links"
            hint="Label|https://… — or Column|Label|https://… to group them"
            rows={6}
            value={(c.links || [])
              .map((l: any) =>
                l.group ? `${l.group}|${l.label}|${l.href}` : `${l.label}|${l.href}`
              )
              .join("\n")}
            onChange={(e) =>
              onPatchContent({
                links: e.target.value
                  .split("\n")
                  .map((line) => line.split("|").map((part) => part.trim()))
                  .filter((parts) => parts.filter(Boolean).length >= 2)
                  .map((parts) =>
                    // Three columns means the first is the group heading; two
                    // keeps the old flat shape, which renders in the bottom bar.
                    parts.length >= 3
                      ? {
                          group: parts[0],
                          label: parts[1],
                          href: parts[2] || "#",
                        }
                      : { label: parts[0], href: parts[1] || "#" }
                  ),
              })
            }
          />
        </>
      )}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm text-[#c7c7da]">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "" : "bg-[#2a2a35]",
        ].join(" ")}
        style={checked ? { background: GOLD } : undefined}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full transition-transform",
            checked ? "translate-x-[18px] bg-[#141418]" : "translate-x-0.5 bg-[#7c7d94]",
          ].join(" ")}
        />
      </button>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-[#c7c7da]">{label}</div>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border border-[#2a2a35] bg-[#141418]"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-[#2a2a35] bg-[#141418] px-3 font-mono text-sm text-white focus:border-[#4a4a5c] focus:outline-none"
        />
      </div>
    </div>
  );
}
