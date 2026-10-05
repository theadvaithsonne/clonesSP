"use client";

// Alerts & Promotions — Admin → Others → Alerts & Promotions.
//
// Authors the dialogs and banners users see on the login screen and inside the
// app. Five choices make up an announcement: where it shows, how big it is,
// text vs. image + text, which visual template, and where its button goes.
//
// The preview pane renders the SAME component the app renders
// (components/announcements/AnnouncementCard), so what an admin approves here
// is literally what ships — no second mock to drift out of sync.
//
// Super admin only. Backend: garagenew-backend routes/garageAdminAnnouncements.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BellRing,
  CalendarClock,
  Gift,
  ImageIcon,
  Info,
  Loader2,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  Rocket,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import AnnouncementPreviewStage from "@/components/garage-admin/AnnouncementPreviewStage";
import {
  DEEP_LINK_TARGETS,
  ICON_OPTIONS,
  SIZE_OPTIONS,
  SURFACE_OPTIONS,
  TEMPLATE_OPTIONS,
  emptyAnnouncementDraft,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementIcon,
  type AnnouncementSize,
  type AnnouncementSurface,
  type AnnouncementTemplate,
} from "@/lib/announcements";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  resetAnnouncementDismissals,
  updateAnnouncement,
  uploadAnnouncementImage,
} from "@/lib/admin-api/announcements";

/**
 * Glyphs for the icon picker. Mirrors GLYPHS in
 * components/announcements/AnnouncementCard — kept as a second, tiny map
 * rather than exported from there so the card file stays free of
 * console-only concerns. "none" has no glyph; the picker draws a Ban instead.
 */
const ICON_GLYPHS: Record<AnnouncementIcon, LucideIcon | null> = {
  megaphone: Megaphone,
  bell: BellRing,
  alert: TriangleAlert,
  info: Info,
  sparkle: Sparkles,
  gift: Gift,
  rocket: Rocket,
  bolt: Zap,
  calendar: CalendarClock,
  lock: Lock,
  wrench: Wrench,
  none: null,
};

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <p className="text-sm font-medium text-white">{children}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/** A radio rendered as a selectable tile — the pattern the console uses for
 *  every "pick exactly one of a handful" choice. */
function ChoiceTile({
  selected,
  title,
  hint,
  onClick,
}: {
  selected: boolean;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-brand bg-brand/10"
          : "border-[#262626] bg-[#1a1a1a] hover:border-[#333333]",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          selected ? "text-brand" : "text-white",
        )}
      >
        {title}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{hint}</p>}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/**
 * A one-line plain-text summary of a rich-text body, for the list rows.
 * Tags are stripped rather than rendered — a row is a label, not a preview,
 * and running markup through the list would let a stray <ul> reflow it.
 */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Error-toast text. Nothing here throws anything but Error, but the catch
 *  binding is `unknown` and this keeps the six call sites one line each. */
function msg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#262626] bg-[#1f1f1f] px-2 py-0.5 text-[11px] text-neutral-400">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// datetime-local <-> ISO
// ---------------------------------------------------------------------------

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const ALL_DEEP_LINKS = DEEP_LINK_TARGETS.flatMap((g) => g.items);

function Editor({
  initial,
  editingId,
  onCancel,
  onSaved,
}: {
  initial: AnnouncementDraft;
  editingId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<AnnouncementDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Which page the preview draws behind the card. Only reachable when the
  // surface is "everywhere"; otherwise the surface itself decides.
  const [previewSurface, setPreviewSurface] = useState<
    "pre-login" | "post-login"
  >(initial.surface === "pre-login" ? "pre-login" : "post-login");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = useCallback(
    <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  const setCta = useCallback(
    (patch: Partial<AnnouncementDraft["cta"]>) =>
      setDraft((d) => ({ ...d, cta: { ...d.cta, ...patch } })),
    [],
  );

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAnnouncementImage(file);
      setDraft((d) => ({ ...d, imageUrl: url, contentType: "image-text" }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(msg(e, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!draft.title.trim()) {
      toast.error("Give the announcement a title");
      return;
    }
    if (draft.contentType === "image-text" && !draft.imageUrl) {
      toast.error("Upload an image, or switch to text-only");
      return;
    }
    if (draft.cta.enabled && !draft.comingSoon) {
      if (!draft.cta.label.trim()) {
        toast.error("Give the button a label");
        return;
      }
      if (!draft.cta.href.trim()) {
        toast.error("Pick a page or enter a URL for the button");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) await updateAnnouncement(editingId, draft);
      else await createAnnouncement(draft);
      toast.success(editingId ? "Announcement updated" : "Announcement created");
      onSaved();
    } catch (e) {
      toast.error(msg(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  // An off-platform URL always opens in a new tab; forcing the checkbox tells
  // the admin that rather than silently ignoring their choice.
  const externalHref = /^https?:\/\//i.test(draft.cta.href.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          All announcements
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-brand font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId ? "Save changes" : "Create announcement"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------------- */}
        {/* Form                                                              */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-4">
          <Section title="Content">
            <div>
              <FieldLabel hint="Small line above the title. Optional.">
                Eyebrow
              </FieldLabel>
              <Input
                value={draft.eyebrow}
                onChange={(e) => set("eyebrow", e.target.value)}
                placeholder="New"
                maxLength={60}
                className="border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
              />
            </div>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Taskroom just got a lot faster"
                maxLength={140}
                className="border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
              />
            </div>
            <div>
              <FieldLabel hint="Bold, italic, bullet and numbered lists, and links. Stored as HTML and sanitised before it is ever rendered.">
                Body
              </FieldLabel>
              <RichTextEditor
                value={draft.body}
                onChange={(html) => set("body", html)}
                placeholder="What changed, and why it matters."
                minHeight="140px"
                theme="admin"
              />
              {draft.body.length > 8000 && (
                <p className="mt-2 text-[11px] text-red-400">
                  Too long — {draft.body.length.toLocaleString()} characters of
                  markup, and the limit is 8,000. Trim the copy or drop some
                  formatting.
                </p>
              )}
            </div>

            <div>
              <FieldLabel hint="Image + Text uploads to S3 and shows above (or beside) the copy.">
                Content type
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceTile
                  selected={draft.contentType === "text"}
                  title="Text only"
                  hint="Title + body"
                  onClick={() => set("contentType", "text")}
                />
                <ChoiceTile
                  selected={draft.contentType === "image-text"}
                  title="Image + Text"
                  hint="Uploaded image"
                  onClick={() => set("contentType", "image-text")}
                />
              </div>

              {draft.contentType === "image-text" && (
                <div className="mt-3 rounded-lg border border-[#262626] bg-[#1a1a1a] p-3">
                  {draft.imageUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={draft.imageUrl}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded object-cover"
                      />
                      <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                        {draft.imageUrl}
                      </p>
                      <button
                        type="button"
                        onClick={() => set("imageUrl", "")}
                        className="rounded p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white"
                        aria-label="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="grid h-14 w-20 shrink-0 place-items-center rounded bg-[#1f1f1f] text-neutral-600">
                        <ImageIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-neutral-400">
                          PNG, JPG, GIF or WebP.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                          className="mt-2 h-8 border-[#333333] bg-transparent text-xs text-white hover:bg-white/5"
                        >
                          {uploading ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-3.5 w-3.5" />
                          )}
                          {uploading ? "Uploading…" : "Upload image"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={pickImage}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </Section>

          <Section title="Placement & style">
            <div>
              <FieldLabel hint="Which screens the dialog is allowed to appear on.">
                Where to display
              </FieldLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SURFACE_OPTIONS.map((o) => (
                  <ChoiceTile
                    key={o.value}
                    selected={draft.surface === o.value}
                    title={o.label}
                    hint={o.hint}
                    onClick={() => set("surface", o.value as AnnouncementSurface)}
                  />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel hint="How wide the dialog is. Top Banner is a strip, not a modal.">
                Dialog size
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SIZE_OPTIONS.map((o) => (
                  <ChoiceTile
                    key={o.value}
                    selected={draft.size === o.value}
                    title={o.label}
                    hint={o.hint}
                    onClick={() => set("size", o.value as AnnouncementSize)}
                  />
                ))}
              </div>
              {draft.contentType === "image-text" && (
                <p className="mt-2 text-[11px] text-neutral-500">
                  With an image the card splits: text on the left, image on the
                  right (stacked only on narrow phones).
                </p>
              )}
            </div>

            <div>
              <FieldLabel hint="How the card looks. What it is FOR is said by the eyebrow, icon and copy.">
                Template
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TEMPLATE_OPTIONS.map((o) => (
                  <ChoiceTile
                    key={o.value}
                    selected={draft.template === o.value}
                    title={o.label}
                    hint={o.hint}
                    onClick={() =>
                      set("template", o.value as AnnouncementTemplate)
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel hint="Sits in the glass badge on the card. Independent of the template.">
                Icon
              </FieldLabel>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {ICON_OPTIONS.map((o) => {
                  const Glyph = ICON_GLYPHS[o.value];
                  const selected = draft.icon === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      title={o.label}
                      aria-pressed={selected}
                      onClick={() => set("icon", o.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-colors",
                        selected
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-[#262626] bg-[#1a1a1a] text-neutral-400 hover:border-[#333333] hover:text-white",
                      )}
                    >
                      {Glyph ? (
                        <Glyph className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <Ban className="h-4 w-4" strokeWidth={1.75} />
                      )}
                      <span className="text-[10px] leading-none">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section title="Button">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">
                  Show a CTA button
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Deep-links into the app, or out to any URL.
                </p>
              </div>
              <Switch
                checked={draft.cta.enabled}
                onCheckedChange={(v) => setCta({ enabled: v })}
              />
            </div>

            {draft.cta.enabled && (
              <div className="space-y-4 border-t border-[#262626] pt-4">
                <div>
                  <FieldLabel>Button label</FieldLabel>
                  <Input
                    value={draft.cta.label}
                    onChange={(e) => setCta({ label: e.target.value })}
                    placeholder="Open Taskroom"
                    maxLength={60}
                    className="border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
                  />
                </div>

                <div>
                  <FieldLabel>Destination</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <ChoiceTile
                      selected={draft.cta.kind === "page"}
                      title="App page"
                      hint="Pick from the sidebar"
                      onClick={() => setCta({ kind: "page", href: "" })}
                    />
                    <ChoiceTile
                      selected={draft.cta.kind === "url"}
                      title="Custom URL"
                      hint="Anything else"
                      onClick={() => setCta({ kind: "url", href: "" })}
                    />
                  </div>

                  {draft.cta.kind === "page" ? (
                    <select
                      value={draft.cta.href}
                      onChange={(e) => setCta({ href: e.target.value })}
                      className="mt-3 w-full rounded-md border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-[#404040]"
                    >
                      <option value="">Select a page…</option>
                      {DEEP_LINK_TARGETS.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.items.map((item) => (
                            <option key={item.href} value={item.href}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={draft.cta.href}
                      onChange={(e) => setCta({ href: e.target.value })}
                      placeholder="https://garage.app/pricing"
                      className="mt-3 border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
                    />
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={draft.cta.newTab || externalHref}
                    disabled={externalHref}
                    onChange={(e) => setCta({ newTab: e.target.checked })}
                    className="h-4 w-4 accent-brand"
                  />
                  Open in a new tab
                  {externalHref && (
                    <span className="text-xs text-neutral-500">
                      (always, for external links)
                    </span>
                  )}
                </label>
              </div>
            )}

            <div className="space-y-3 border-t border-[#262626] pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Coming soon</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Adds the badge and makes the button inert, for teasing
                    something that hasn&apos;t shipped.
                  </p>
                </div>
                <Switch
                  checked={draft.comingSoon}
                  onCheckedChange={(v) => set("comingSoon", v)}
                />
              </div>
              {draft.comingSoon && (
                <Input
                  value={draft.comingSoonLabel}
                  onChange={(e) => set("comingSoonLabel", e.target.value)}
                  placeholder="Coming Soon"
                  maxLength={40}
                  className="border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
                />
              )}
            </div>
          </Section>

          <Section title="Publishing">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Live</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Off keeps it a draft. Nothing is shown to users until this is
                  on.
                </p>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => set("enabled", v)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel hint="Blank = immediately">Starts</FieldLabel>
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft.startsAt)}
                  onChange={(e) =>
                    set("startsAt", fromLocalInput(e.target.value))
                  }
                  className="border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
                />
              </div>
              <div>
                <FieldLabel hint="Blank = never expires">Ends</FieldLabel>
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft.endsAt)}
                  onChange={(e) => set("endsAt", fromLocalInput(e.target.value))}
                  className="border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
                />
              </div>
            </div>

            <div>
              <FieldLabel hint="Higher wins when several are live on the same surface.">
                Priority
              </FieldLabel>
              <Input
                type="number"
                value={draft.priority}
                onChange={(e) =>
                  set("priority", Number(e.target.value) || 0)
                }
                min={-100}
                max={100}
                className="w-32 border-[#262626] bg-[#1a1a1a] text-white placeholder:text-neutral-600"
              />
            </div>
          </Section>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Live preview — the real card, over a schematic of the real page   */}
        {/* ---------------------------------------------------------------- */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Preview
              </p>
              <div className="flex items-center gap-1.5">
                <Chip>
                  {SIZE_OPTIONS.find((o) => o.value === draft.size)?.label}
                </Chip>
                {/* "Everywhere" lands on both pages, so the admin needs to be
                    able to look at either one. For a single-surface
                    announcement there is nothing to choose. */}
                {draft.surface === "everywhere" ? (
                  <div className="flex overflow-hidden rounded-md border border-[#262626]">
                    {(["pre-login", "post-login"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPreviewSurface(s)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] transition-colors",
                          previewSurface === s
                            ? "bg-brand font-semibold text-brand-foreground"
                            : "bg-[#1a1a1a] text-neutral-400 hover:text-white",
                        )}
                      >
                        {s === "pre-login" ? "Login" : "Dashboard"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Chip>
                    {draft.surface === "pre-login"
                      ? "Login screen"
                      : "Dashboard"}
                  </Chip>
                )}
              </div>
            </div>

            <AnnouncementPreviewStage
              data={draft}
              surface={
                draft.surface === "everywhere"
                  ? previewSurface
                  : (draft.surface as "pre-login" | "post-login")
              }
            />

            <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
              The card is the exact component users see; the page behind it is a
              schematic, drawn to scale, so you can judge how much of the screen
              it takes. &ldquo;Not now&rdquo; and the X close it for that
              browsing session; &ldquo;Don&apos;t show this again&rdquo; retires
              it for that user for good — until you hit &ldquo;Show
              again&rdquo; on the list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List + page shell
// ---------------------------------------------------------------------------

function statusOf(a: Announcement): { label: string; className: string } {
  if (!a.enabled)
    return { label: "Draft", className: "bg-[#262626] text-neutral-400" };
  const now = Date.now();
  if (a.startsAt && new Date(a.startsAt).getTime() > now)
    return { label: "Scheduled", className: "bg-sky-500/15 text-sky-300" };
  if (a.endsAt && new Date(a.endsAt).getTime() < now)
    return { label: "Expired", className: "bg-[#262626] text-neutral-500" };
  return { label: "Live", className: "bg-brand/15 text-brand" };
}

export default function AnnouncementsConsole() {
  const { ready, isSuperAdmin } = useAdminAccess();

  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<
    { kind: "list" } | { kind: "edit"; id: string | null; draft: AnnouncementDraft }
  >({ kind: "list" });
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAnnouncements());
    } catch (e) {
      toast.error(msg(e, "Failed to load announcements"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && isSuperAdmin) load();
    else if (ready) setLoading(false);
  }, [ready, isSuperAdmin, load]);

  // Every editable field, explicitly. A field missed here silently reverts
  // to its default the next time an admin toggles or edits the row — the
  // same failure mode the auth store's setUser has hit twice (see CLAUDE.md).
  const toDraft = (a: Announcement): AnnouncementDraft => ({
    title: a.title,
    body: a.body,
    eyebrow: a.eyebrow,
    surface: a.surface,
    size: a.size,
    contentType: a.contentType,
    imageUrl: a.imageUrl,
    template: a.template,
    icon: a.icon ?? "megaphone",
    cta: { ...a.cta },
    comingSoon: a.comingSoon,
    comingSoonLabel: a.comingSoonLabel,
    enabled: a.enabled,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    priority: a.priority,
  });

  async function toggleEnabled(a: Announcement) {
    setBusyId(a.id);
    try {
      await updateAnnouncement(a.id, { ...toDraft(a), enabled: !a.enabled });
      toast.success(!a.enabled ? "Announcement is live" : "Announcement paused");
      await load();
    } catch (e) {
      toast.error(msg(e, "Failed to update"));
    } finally {
      setBusyId(null);
    }
  }

  async function showAgain(a: Announcement) {
    setBusyId(a.id);
    try {
      await resetAnnouncementDismissals(a.id);
      toast.success("Everyone who dismissed it will see it again");
      await load();
    } catch (e) {
      toast.error(msg(e, "Failed to reset"));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setBusyId(target.id);
    try {
      await deleteAnnouncement(target.id);
      toast.success("Announcement deleted");
      await load();
    } catch (e) {
      toast.error(msg(e, "Failed to delete"));
    } finally {
      setBusyId(null);
    }
  }

  const liveCount = useMemo(
    () => rows.filter((a) => statusOf(a).label === "Live").length,
    [rows],
  );

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[#262626] bg-[#141414] p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-brand" />
        <p className="text-sm font-medium text-white">Super admin only</p>
        <p className="mt-1 text-xs text-neutral-500">
          Alerts &amp; Promotions go in front of every user on the platform, so
          authoring them is not delegatable.
        </p>
      </div>
    );
  }

  if (mode.kind === "edit") {
    return (
      <div className="px-4 sm:px-0">
        <Editor
          initial={mode.draft}
          editingId={mode.id}
          onCancel={() => setMode({ kind: "list" })}
          onSaved={() => {
            setMode({ kind: "list" });
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 sm:px-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400 sm:text-sm">
            Dialogs and banners shown on the login screen and inside the app.
            {rows.length > 0 && (
              <span className="text-neutral-500">
                {" "}
                · {liveCount} live of {rows.length}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() =>
            setMode({ kind: "edit", id: null, draft: emptyAnnouncementDraft() })
          }
          className="bg-brand font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          New announcement
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#262626] bg-[#141414] py-16 text-center">
          <Megaphone className="mx-auto mb-3 h-7 w-7 text-neutral-600" />
          <p className="text-sm font-medium text-white">Nothing published</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
            Create an announcement to put a dialog or banner in front of users
            on the login screen, the dashboard, or both.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const status = statusOf(a);
            const surface = SURFACE_OPTIONS.find((o) => o.value === a.surface);
            const size = SIZE_OPTIONS.find((o) => o.value === a.size);
            const template = TEMPLATE_OPTIONS.find(
              (o) => o.value === a.template,
            );
            const linkLabel =
              ALL_DEEP_LINKS.find((t) => t.href === a.cta.href)?.label ||
              a.cta.href;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-[#262626] bg-[#141414] p-4"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {a.contentType === "image-text" && a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-16 shrink-0 place-items-center rounded bg-[#1f1f1f] text-neutral-600">
                      <Megaphone className="h-4 w-4" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {a.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                      {a.comingSoon && <Chip>Coming soon</Chip>}
                    </div>
                    {a.body && (
                      <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                        {plainText(a.body)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip>{surface?.label}</Chip>
                      <Chip>{size?.label}</Chip>
                      <Chip>{template?.label}</Chip>
                      {a.priority !== 0 && <Chip>Priority {a.priority}</Chip>}
                      {a.cta.enabled && !a.comingSoon && linkLabel && (
                        <Chip>→ {linkLabel}</Chip>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {busyId === a.id ? (
                      <Loader2 className="mx-2 h-4 w-4 animate-spin text-neutral-500" />
                    ) : (
                      <>
                        <Switch
                          checked={a.enabled}
                          onCheckedChange={() => toggleEnabled(a)}
                          aria-label={a.enabled ? "Pause" : "Publish"}
                        />
                        <button
                          type="button"
                          title="Show again to everyone who dismissed it"
                          onClick={() => showAgain(a)}
                          className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() =>
                            setMode({
                              kind: "edit",
                              id: a.id,
                              draft: toDraft(a),
                            })
                          }
                          className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setPendingDelete(a)}
                          className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent className="border-[#262626] bg-[#141414] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              &ldquo;{pendingDelete?.title}&rdquo; will be removed for good. If
              you only want to stop showing it, pause it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#333333] bg-transparent text-white hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
